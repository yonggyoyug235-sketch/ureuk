/**
 * DB 접속 정보를 환경변수에서 읽는다.
 *
 * Vercel Marketplace의 Turso 연동은 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN을 주입하고,
 * 직접 등록하는 경우엔 보통 DATABASE_URL / DATABASE_AUTH_TOKEN을 쓴다. 둘 다 받는다.
 */
export function resolveDbEnv() {
  const url =
    process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "file:./data/app.db";
  const authToken =
    process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN || undefined;
  return { url, authToken };
}
