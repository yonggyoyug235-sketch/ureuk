import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { loginEvents } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  const history = await db
    .select({ id: loginEvents.id, loggedInAt: loginEvents.loggedInAt, ip: loginEvents.ip })
    .from(loginEvents)
    .where(eq(loginEvents.userId, user.id))
    .orderBy(desc(loginEvents.loggedInAt))
    .limit(10);

  return NextResponse.json({
    user: {
      ...user,
      createdAt: user.createdAt?.getTime() ?? null,
      lastLoginAt: user.lastLoginAt?.getTime() ?? null,
      previousLoginAt: user.previousLoginAt?.getTime() ?? null,
    },
    loginHistory: history.map((h) => ({ ...h, loggedInAt: h.loggedInAt.getTime() })),
  });
}
