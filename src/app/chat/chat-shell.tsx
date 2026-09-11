"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatDateTime, formatRelative, formatTime } from "@/lib/format";

type SessionUser = {
  id: number;
  username: string;
  email: string;
  lastLoginAt: number | null;
  previousLoginAt: number | null;
  loginCount: number;
};

type RoomSummary = {
  id: number;
  name: string;
  description: string | null;
  owner: string;
  memberCount: number;
  messageCount: number;
  lastMessageAt: number | null;
  joined: boolean;
};

type ChatMessage = {
  id: number;
  body: string;
  createdAt: number;
  userId: number;
  username: string;
  mine: boolean;
};

const POLL_MS = 2000;
const NBSP = " ";

export default function ChatShell({
  user,
  roomId,
}: {
  user: SessionUser;
  roomId: number | null;
}) {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [newRoom, setNewRoom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // 서버(UTC)와 브라우저(로컬 TZ)의 시간 포맷이 달라 hydration이 깨지는 걸 막는다.
  const [mounted, setMounted] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);

  useEffect(() => setMounted(true), []);

  const loadRooms = useCallback(async () => {
    const res = await fetch("/api/rooms");
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok) setRooms(data.rooms ?? []);
  }, [router]);

  useEffect(() => {
    void loadRooms();
    const t = setInterval(loadRooms, 10000);
    return () => clearInterval(t);
  }, [loadRooms]);

  // 방을 바꾸면 메시지를 처음부터 다시 읽고, 이후에는 마지막 id 뒤쪽만 폴링한다.
  useEffect(() => {
    if (roomId === null) {
      setMessages([]);
      lastIdRef.current = 0;
      return;
    }

    let cancelled = false;
    lastIdRef.current = 0;
    setMessages([]);

    async function poll() {
      const after = lastIdRef.current;
      const url = after
        ? `/api/rooms/${roomId}/messages?after=${after}`
        : `/api/rooms/${roomId}/messages`;

      const res = await fetch(url);
      if (!res.ok || cancelled) return;

      const data = (await res.json()) as { messages: ChatMessage[] };
      if (cancelled || data.messages.length === 0) return;

      lastIdRef.current = Math.max(
        lastIdRef.current,
        data.messages[data.messages.length - 1].id,
      );
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...data.messages.filter((m) => !seen.has(m.id))];
      });
    }

    void poll();
    const t = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [roomId]);

  // 새 메시지가 오면 맨 아래로
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || roomId === null || sending) return;

    setSending(true);
    setError(null);

    const res = await fetch(`/api/rooms/${roomId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);

    if (!res.ok) {
      setError(data.error ?? "메시지를 보내지 못했습니다.");
      return;
    }

    setDraft("");
    // 폴링이 돌기 전에 즉시 화면에 반영
    setMessages((prev) =>
      prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message],
    );
    lastIdRef.current = Math.max(lastIdRef.current, data.message.id);
    void loadRooms();
  }, [draft, roomId, sending, loadRooms]);

  async function createRoom(e: React.FormEvent) {
    e.preventDefault();
    const name = newRoom.trim();
    if (!name) return;

    setError(null);
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? "방을 만들지 못했습니다.");
      return;
    }

    setNewRoom("");
    await loadRooms();
    router.push(`/chat/${data.room.id}`);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const activeRoom = rooms.find((r) => r.id === roomId) ?? null;

  return (
    <div className={`shell${roomId === null ? " list-mode" : ""}`}>
      <aside className="sidebar">
        <header>
          <strong>우륵 채팅</strong>
          <form onSubmit={createRoom} style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <input
              value={newRoom}
              onChange={(e) => setNewRoom(e.target.value)}
              placeholder="새 방 이름"
              maxLength={40}
            />
            <button type="submit" disabled={!newRoom.trim()}>
              +
            </button>
          </form>
        </header>

        <div className="rooms">
          {rooms.length === 0 && (
            <p className="small muted" style={{ padding: 12 }}>
              아직 방이 없습니다. 위에서 첫 방을 만들어 보세요.
            </p>
          )}
          {rooms.map((r) => (
            <Link
              key={r.id}
              href={`/chat/${r.id}`}
              className={`room-item${r.id === roomId ? " active" : ""}`}
            >
              <div># {r.name}</div>
              <div className="meta">
                {r.memberCount}명 · 메시지 {r.messageCount}
                {mounted && r.lastMessageAt ? ` · ${formatRelative(r.lastMessageAt)}` : ""}
              </div>
            </Link>
          ))}
        </div>

        <div className="userbox">
          <div>
            <strong>{user.username}</strong> <span className="muted small">{user.email}</span>
          </div>
          <div className="muted small">
            {!mounted
              ? NBSP
              : user.lastLoginAt
                ? `이번 로그인: ${formatDateTime(user.lastLoginAt)}`
                : "가입 후 첫 접속입니다."}
          </div>
          <div className="muted small">
            {mounted && user.previousLoginAt
              ? `지난 로그인: ${formatDateTime(user.previousLoginAt)}`
              : NBSP}
          </div>
          <div className="muted small">누적 로그인 {user.loginCount}회</div>
          <button className="ghost" onClick={logout} style={{ marginTop: 4 }}>
            로그아웃
          </button>
        </div>
      </aside>

      <section className="main">
        {roomId !== null ? (
          <>
            <header>
              <strong># {activeRoom?.name ?? "…"}</strong>
              {activeRoom?.description && (
                <span className="muted small">{activeRoom.description}</span>
              )}
              <span className="muted small" style={{ marginLeft: "auto" }}>
                {activeRoom ? `${activeRoom.memberCount}명 참여 중` : ""}
              </span>
            </header>

            <div className="messages" ref={listRef}>
              {messages.length === 0 ? (
                <p className="empty">첫 메시지를 남겨 보세요.</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`row${m.mine ? " mine" : ""}`}>
                    <div className="bubble">
                      <div className="who">{m.username}</div>
                      <div>{m.body}</div>
                      <div className="time">{mounted ? formatTime(m.createdAt) : NBSP}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {error && (
              <div className="error" style={{ margin: "0 20px" }}>
                {error}
              </div>
            )}

            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="메시지를 입력하세요 (Enter 전송 · Shift+Enter 줄바꿈)"
                maxLength={2000}
              />
              <button type="submit" disabled={sending || !draft.trim()}>
                전송
              </button>
            </form>
          </>
        ) : (
          <div className="messages">
            <p className="empty">
              왼쪽에서 채팅방을 고르거나
              <br />새 방을 만들어 주세요.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
