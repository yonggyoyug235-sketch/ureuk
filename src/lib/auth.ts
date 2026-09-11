import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export const SESSION_COOKIE = "ureuk_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7일

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET 환경변수가 없거나 32자 미만입니다. .env.local을 확인하세요.");
  }
  return new TextEncoder().encode(secret);
}

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId: number) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** 쿠키의 세션을 검증하고 DB에서 사용자를 읽어온다. 없으면 null. */
export async function getCurrentUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let uid: number;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    uid = Number(payload.uid);
  } catch {
    return null;
  }
  if (!Number.isFinite(uid)) return null;

  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      previousLoginAt: users.previousLoginAt,
      loginCount: users.loginCount,
    })
    .from(users)
    .where(eq(users.id, uid))
    .limit(1);

  return user ?? null;
}

/** API 라우트용: 로그인 안 되어 있으면 던진다. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("로그인이 필요합니다.");
  }
}

export async function requestMeta() {
  const h = await headers();
  return {
    ip:
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      null,
    userAgent: h.get("user-agent"),
  };
}
