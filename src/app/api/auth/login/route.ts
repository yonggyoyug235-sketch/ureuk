import { NextResponse } from "next/server";
import { eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginEvents, users } from "@/db/schema";
import { createSession, requestMeta, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!identifier || !password) {
    return NextResponse.json({ error: "아이디(또는 이메일)와 비밀번호를 입력하세요." }, { status: 400 });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.username, identifier), eq(users.email, identifier.toLowerCase())))
    .limit(1);

  // 아이디가 없을 때와 비밀번호가 틀렸을 때를 구분해서 알려주지 않는다.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const now = new Date();
  const meta = await requestMeta();

  // 직전 로그인 시각을 previous_login_at으로 밀어 넣고, 이번 로그인 시각을 기록한다.
  await db
    .update(users)
    .set({
      previousLoginAt: user.lastLoginAt,
      lastLoginAt: now,
      loginCount: sql`${users.loginCount} + 1`,
    })
    .where(eq(users.id, user.id));

  // 로그인 이력 한 줄 추가
  await db.insert(loginEvents).values({
    userId: user.id,
    loggedInAt: now,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  await createSession(user.id);

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      lastLoginAt: now.getTime(),
      previousLoginAt: user.lastLoginAt?.getTime() ?? null,
      loginCount: user.loginCount + 1,
    },
  });
}
