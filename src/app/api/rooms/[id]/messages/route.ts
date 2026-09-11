import { NextResponse } from "next/server";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { messages, roomMembers, rooms, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/**
 * GET ?after=<messageId> — 그 id 이후 새 메시지만 (폴링용)
 * GET (파라미터 없음)     — 최근 50개
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const roomId = Number((await ctx.params).id);
  if (!Number.isInteger(roomId)) return NextResponse.json({ error: "잘못된 방입니다." }, { status: 400 });

  const afterParam = new URL(req.url).searchParams.get("after");
  const after = afterParam ? Number(afterParam) : null;

  const base = db
    .select({
      id: messages.id,
      body: messages.body,
      createdAt: messages.createdAt,
      userId: messages.userId,
      username: users.username,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.userId));

  const rows =
    after !== null && Number.isInteger(after)
      ? await base
          .where(and(eq(messages.roomId, roomId), gt(messages.id, after)))
          .orderBy(asc(messages.id))
          .limit(200)
      : (
          await base.where(eq(messages.roomId, roomId)).orderBy(desc(messages.id)).limit(PAGE_SIZE)
        ).reverse();

  return NextResponse.json({
    messages: rows.map((m) => ({
      ...m,
      createdAt: m.createdAt.getTime(),
      mine: m.userId === user.id,
    })),
  });
}

/** 메시지 보내기 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const roomId = Number((await ctx.params).id);
  if (!Number.isInteger(roomId)) return NextResponse.json({ error: "잘못된 방입니다." }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "빈 메시지는 보낼 수 없습니다." }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: "메시지가 너무 깁니다." }, { status: 400 });

  const [room] = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!room) return NextResponse.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });

  // 메시지를 보내면 자동으로 참여자가 된다.
  await db.insert(roomMembers).values({ roomId, userId: user.id }).onConflictDoNothing();

  const [saved] = await db
    .insert(messages)
    .values({ roomId, userId: user.id, body: text })
    .returning();

  return NextResponse.json(
    {
      message: {
        id: saved.id,
        body: saved.body,
        createdAt: saved.createdAt.getTime(),
        userId: user.id,
        username: user.username,
        mine: true,
      },
    },
    { status: 201 },
  );
}
