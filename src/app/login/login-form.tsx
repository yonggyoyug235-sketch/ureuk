"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? "로그인에 실패했습니다.");
      setBusy(false);
      return;
    }

    router.push("/chat");
    router.refresh();
  }

  return (
    <div className="auth-wrap">
      <form className="card" onSubmit={onSubmit}>
        <h1>로그인</h1>
        <p className="sub">우륵 채팅에 오신 것을 환영합니다.</p>

        {error && <div className="error">{error}</div>}

        <div className="field">
          <label htmlFor="identifier">아이디 또는 이메일</label>
          <input
            id="identifier"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <button type="submit" disabled={busy} style={{ width: "100%", marginTop: 6 }}>
          {busy ? "로그인 중…" : "로그인"}
        </button>

        <p className="small muted" style={{ textAlign: "center", marginTop: 16, marginBottom: 0 }}>
          계정이 없으신가요? <Link href="/signup">회원가입</Link>
        </p>
      </form>
    </div>
  );
}
