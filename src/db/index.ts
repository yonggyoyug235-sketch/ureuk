import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./data/app.db";
const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;

// 서버리스(Vercel)에서는 요청마다 모듈이 재평가될 수 있고, 개발 모드에서는
// HMR 때마다 새 클라이언트가 생긴다. 전역에 캐시해서 커넥션 낭비를 막는다.
const globalForDb = globalThis as unknown as {
  __libsql?: ReturnType<typeof createClient>;
};

const client = globalForDb.__libsql ?? createClient({ url, authToken });
if (process.env.NODE_ENV !== "production") globalForDb.__libsql = client;

export const db = drizzle(client, { schema });
export { schema };
