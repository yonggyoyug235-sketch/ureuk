# 우륵 채팅

Next.js 15(App Router) + SQLite 기반 채팅 앱. **DB 접근은 전부 서버(Route Handler)에서만** 일어나고, 브라우저는 fetch로 API만 호출합니다.

## 스택

| 항목 | 선택 | 이유 |
| --- | --- | --- |
| 프레임워크 | Next.js 15 App Router | Vercel 네이티브. Route Handler가 곧 서버 사이드 DB 계층 |
| DB | SQLite (libSQL) | 로컬은 파일, 프로덕션은 Turso — SQL·스키마·코드 동일 |
| ORM | Drizzle | SQLite 스키마를 TS로 정의하고 `drizzle-kit push`로 반영 |
| 인증 | bcryptjs + jose(JWT) | httpOnly 쿠키 세션, 외부 서비스 의존 없음 |

### 왜 파일 SQLite를 그대로 Vercel에 못 올리나

Vercel의 서버리스 파일시스템은 **휘발성**입니다. `data/app.db`에 쓴 내용은 배포·콜드스타트마다 사라지고, 동시에 뜬 인스턴스끼리 공유되지도 않습니다. 그래서 같은 SQLite를 네트워크 너머로 쓰는 **Turso(libSQL)** 를 프로덕션 대상으로 잡았습니다. 바꾸는 건 환경변수 두 개뿐입니다.

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # AUTH_SECRET을 32자 이상 임의 문자열로 교체
npm run db:push              # 스키마를 data/app.db에 반영
npm run dev                  # http://localhost:3000
```

## 데이터 모델

`src/db/schema.ts`

- **users** — `username`, `email`, `password_hash`, `created_at`, `last_login_at`, `previous_login_at`, `login_count`
- **login_events** — 로그인할 때마다 한 줄씩. `logged_in_at`, `ip`, `user_agent`
- **rooms** — `name`(고유), `description`, `created_by`, `created_at`
- **room_members** — `(room_id, user_id)` 고유. 방에 글을 쓰면 자동 등록
- **messages** — `room_id`, `user_id`, `body`, `created_at`

### 로그인 타임스탬프 기록 방식

로그인이 성공하면 `POST /api/auth/login`이 두 가지를 합니다.

1. `users.last_login_at`을 지금으로 갱신하고, 직전 값을 `previous_login_at`으로 밀어 넣고, `login_count`를 1 올립니다.
2. `login_events`에 시각·IP·User-Agent를 한 줄 남깁니다.

그래서 사이드바에 "이번 로그인 / 지난 로그인 / 누적 N회"가 바로 뜨고, `GET /api/me`로 최근 10회 이력을 조회할 수 있습니다.

## API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/api/auth/signup` | 가입 (아이디·이메일 중복 검사, 즉시 로그인) |
| POST | `/api/auth/login` | 로그인 + 타임스탬프 기록 |
| POST | `/api/auth/logout` | 세션 쿠키 삭제 |
| GET | `/api/me` | 내 정보 + 최근 로그인 이력 10건 |
| GET·POST | `/api/rooms` | 방 목록(참여자·메시지 수 포함) / 방 생성 |
| GET·POST | `/api/rooms/[id]` | 방 정보+참여자 / 방 입장 |
| GET | `/api/rooms/[id]/messages` | 최근 50개, 또는 `?after=<id>`로 새 메시지만 |
| POST | `/api/rooms/[id]/messages` | 메시지 전송 |

실시간은 `?after=<마지막 id>` 커서 폴링(2초)으로 구현했습니다. WebSocket이나 장시간 SSE는 서버리스에서 커넥션을 오래 붙들어야 해 Vercel에 부적합합니다.

## Vercel 배포

환경변수를 등록하지 않으면 **빌드는 통과하지만 사이트를 열 때 500**이 납니다. 아래 둘 중 하나를 택하세요.

### 방법 A — Vercel Marketplace (Windows 권장, CLI 불필요)

1. Vercel 프로젝트 → **Storage** 탭 → **Create Database** → Marketplace에서 **Turso** 선택
2. DB를 만들고 프로젝트에 연결하면 `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`이 자동 주입됩니다
3. **Settings → Environment Variables**에서 `AUTH_SECRET`만 직접 추가 (32자 이상)

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

4. 스키마를 원격 DB에 반영 — 주입된 값을 로컬로 내려받아 push 합니다

   ```bash
   npm i -g vercel
   vercel link
   vercel env pull .env.local
   npx drizzle-kit push
   ```

5. Deployments → 최신 배포 → **Redeploy**

### 방법 B — Turso 직접 생성

Turso CLI는 Windows에서 WSL이 필요합니다. WSL이 없으면 [app.turso.tech](https://app.turso.tech) 웹 대시보드에서 DB와 토큰을 만드세요. CLI를 쓸 수 있다면:

```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth signup
turso db create ureuk-chat
turso db show ureuk-chat --url      # libsql://...
turso db tokens create ureuk-chat   # 토큰
```

받은 값을 `.env.local`에 넣고 `npx drizzle-kit push`로 스키마를 반영한 뒤, Vercel **Settings → Environment Variables**에 세 개를 등록하고 Redeploy 합니다.

| 키 | 값 |
| --- | --- |
| `DATABASE_URL` | `libsql://ureuk-chat-<org>.turso.io` |
| `DATABASE_AUTH_TOKEN` | 위에서 만든 토큰 |
| `AUTH_SECRET` | 32자 이상 임의 문자열 |

`TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`과 `DATABASE_URL`/`DATABASE_AUTH_TOKEN` 둘 다 인식하며, 앞쪽이 우선합니다 (`src/lib/db-env.ts`).

> 저장소가 public입니다. 토큰과 `AUTH_SECRET`은 절대 커밋하지 말고 Vercel 대시보드에만 넣으세요.

## 검증한 것

프로덕션 빌드(`next build`, 타입체크 포함) 통과 후 실제 서버에 대해 확인:

- 가입 → 아이디/이메일 중복 409, 한글 아이디 정상
- 로그인 2회 → `last_login_at` 갱신, `previous_login_at`에 직전 값, `login_count` 증가, `login_events` 2건
- 방 생성 → 목록에 참여자 수·메시지 수 집계
- 메시지 전송/조회, `?after=` 커서로 신규분만 반환
- 비로그인 상태의 `/api/rooms`, `/api/rooms/[id]/messages` → 401
