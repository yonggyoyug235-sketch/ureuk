"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirm) {
      setError("비밀번호가 서로 다릅니다.");
      return;
    }

    setBusy(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: form.username,
        email: form.email,
        password: form.password,
      }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? "가입에 실패했습니다.");
      setBusy(false);
      return;
    }

    router.push("/chat");
    router.refresh();
  }

  return (
    <div className="auth-wrap">
      <form className="card" onSubmit={onSubmit}>
        <h1>회원가입</h1>
        <p className="sub">아이디, 이메일, 비밀번호만 있으면 됩니다.</p>

        {error && <div className="error">{error}</div>}

        <div className="field">
          <label htmlFor="username">아이디</label>
          <input id="username" value={form.username} onChange={set("username")} required />
          <p className="small muted" style={{ margin: "6px 0 0" }}>
            2~20자 · 한글/영문/숫자/밑줄
          </p>
        </div>

        <div className="field">
          <label htmlFor="email">이메일</label>
          <input id="email" type="email" value={form.email} onChange={set("email")} required />
        </div>

        <div className="field">
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            type="password"
            value={form.password}
            onChange={set("password")}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <p className="small muted" style={{ margin: "6px 0 0" }}>8자 이상</p>
        </div>

        <div className="field">
          <label htmlFor="confirm">비밀번호 확인</label>
          <input
            id="confirm"
            type="password"
            value={form.confirm}
            onChange={set("confirm")}
            autoComplete="new-password"
            required
          />
        </div>

        <button type="submit" disabled={busy} style={{ width: "100%", marginTop: 6 }}>
          {busy ? "가입 중…" : "가입하기"}
        </button>

        <p className="small muted" style={{ textAlign: "center", marginTop: 16, marginBottom: 0 }}>
          이미 계정이 있으신가요? <Link href="/login">로그인</Link>
        </p>
      </form>
    </div>
  );
}
