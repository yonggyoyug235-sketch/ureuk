import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ChatShell from "../chat-shell";

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const roomId = Number((await params).id);
  if (!Number.isInteger(roomId)) notFound();

  return (
    <ChatShell
      user={{
        id: user.id,
        username: user.username,
        email: user.email,
        lastLoginAt: user.lastLoginAt?.getTime() ?? null,
        previousLoginAt: user.previousLoginAt?.getTime() ?? null,
        loginCount: user.loginCount,
      }}
      roomId={roomId}
    />
  );
}
