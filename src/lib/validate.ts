export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

const USERNAME_RE = /^[a-zA-Z0-9가-힣_]{2,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignup(input: unknown): Validated<{
  username: string;
  email: string;
  password: string;
}> {
  if (typeof input !== "object" || input === null) return { ok: false, error: "잘못된 요청입니다." };
  const { username, email, password } = input as Record<string, unknown>;

  if (typeof username !== "string" || !USERNAME_RE.test(username.trim())) {
    return { ok: false, error: "아이디는 2~20자의 한글/영문/숫자/밑줄만 사용할 수 있습니다." };
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return { ok: false, error: "이메일 형식이 올바르지 않습니다." };
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 72) {
    return { ok: false, error: "비밀번호는 8자 이상 72자 이하여야 합니다." };
  }

  return {
    ok: true,
    value: { username: username.trim(), email: email.trim().toLowerCase(), password },
  };
}
