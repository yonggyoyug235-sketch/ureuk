import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword } from "@/lib/auth";
import { validateSignup } from "@/lib/validate";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = validateSignup(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { username, email, password } = parsed.value;

  const existing = await db
    .select({ id: users.id, username: users.username, email: users.email })
    .from(users)
    .where(or(eq(users.username, username), eq(users.email, email)))
    .limit(1);

  if (existing.length > 0) {
    const clash = existing[0].username === username ? "아이디" : "이메일";
    return NextResponse.json({ error: `이미 사용 중인 ${clash}입니다.` }, { status: 409 });
  }

  const [created] = await db
    .insert(users)
    .values({ username, email, passwordHash: await hashPassword(password) })
    .returning({ id: users.id, username: users.username });

  // 가입 직후 바로 로그인 상태로 만든다. 로그인 타임스탬프는 /login에서만 기록하므로
  // 여기서는 세션만 발급하고 lastLoginAt은 비워 둔다.
  await createSession(created.id);

  return NextResponse.json({ user: created }, { status: 201 });
}
