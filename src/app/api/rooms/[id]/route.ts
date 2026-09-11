import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { roomMembers, rooms, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/** 방 정보 + 참여자 목록 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const roomId = Number((await ctx.params).id);
  if (!Number.isInteger(roomId)) return NextResponse.json({ error: "잘못된 방입니다." }, { status: 400 });

  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!room) return NextResponse.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });

  const members = await db
    .select({ id: users.id, username: users.username, joinedAt: roomMembers.joinedAt })
    .from(roomMembers)
    .innerJoin(users, eq(users.id, roomMembers.userId))
    .where(eq(roomMembers.roomId, roomId));

  return NextResponse.json({
    room: { ...room, createdAt: room.createdAt.getTime() },
    members: members.map((m) => ({ ...m, joinedAt: m.joinedAt.getTime() })),
  });
}

/** 방 입장 (참여자 등록) */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const roomId = Number((await ctx.params).id);
  if (!Number.isInteger(roomId)) return NextResponse.json({ error: "잘못된 방입니다." }, { status: 400 });

  const [room] = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!room) return NextResponse.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });

  await db.insert(roomMembers).values({ roomId, userId: user.id }).onConflictDoNothing();

  return NextResponse.json({ ok: true });
}
