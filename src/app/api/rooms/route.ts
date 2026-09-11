import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { roomMembers, rooms, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

/** 방 목록 + 각 방의 참여자 수 / 메시지 수 / 마지막 활동 시각 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const list = await db
    .select({
      id: rooms.id,
      name: rooms.name,
      description: rooms.description,
      createdAt: rooms.createdAt,
      owner: users.username,
      memberCount: sql<number>`(select count(*) from room_members where room_members.room_id = ${rooms.id})`,
      messageCount: sql<number>`(select count(*) from messages where messages.room_id = ${rooms.id})`,
      lastMessageAt: sql<number | null>`(select max(created_at) from messages where messages.room_id = ${rooms.id})`,
      joined: sql<number>`(select count(*) from room_members where room_members.room_id = ${rooms.id} and room_members.user_id = ${user.id})`,
    })
    .from(rooms)
    .innerJoin(users, eq(users.id, rooms.createdBy))
    .orderBy(desc(rooms.createdAt));

  return NextResponse.json({
    rooms: list.map((r) => ({
      ...r,
      createdAt: r.createdAt.getTime(),
      joined: r.joined > 0,
    })),
  });
}

/** 방 만들기 — 만든 사람은 자동으로 참여 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : null;

  if (name.length < 1 || name.length > 40) {
    return NextResponse.json({ error: "방 이름은 1~40자여야 합니다." }, { status: 400 });
  }

  const dupe = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.name, name)).limit(1);
  if (dupe.length > 0) {
    return NextResponse.json({ error: "같은 이름의 방이 이미 있습니다." }, { status: 409 });
  }

  const [room] = await db
    .insert(rooms)
    .values({ name, description: description || null, createdBy: user.id })
    .returning();

  await db.insert(roomMembers).values({ roomId: room.id, userId: user.id });

  return NextResponse.json({ room: { ...room, createdAt: room.createdAt.getTime() } }, { status: 201 });
}
