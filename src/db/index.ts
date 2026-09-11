import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

type Database = LibSQLDatabase<typeof schema>;

// 빌드 중(page data 수집)에도 이 모듈은 import되므로, 커넥션 생성과 설정 검사는
// 첫 쿼리가 실제로 일어날 때까지 미룬다. 모듈 로드 시점에 던지면 빌드가 깨진다.
const globalForDb = globalThis as unknown as {
  __libsql?: Client;
  __db?: Database;
};

function connect(): Database {
  if (globalForDb.__db) return globalForDb.__db;

  const url = process.env.DATABASE_URL ?? "file:./data/app.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN || undefined;

  // 서버리스(Vercel)의 파일시스템은 휘발성이라 file: SQLite는 배포마다 사라진다.
  // 조용히 빈 DB로 동작하다 엉뚱한 곳에서 터지는 대신 여기서 바로 알려준다.
  if (process.env.NODE_ENV === "production" && url.startsWith("file:") && process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL이 설정되지 않았거나 file: 경로입니다. Vercel에서는 파일 SQLite가 " +
        "배포마다 사라지므로, Turso URL(libsql://...)과 토큰을 프로젝트 환경변수 " +
        "DATABASE_URL / DATABASE_AUTH_TOKEN에 등록한 뒤 다시 배포하세요.",
    );
  }

  const client = globalForDb.__libsql ?? createClient({ url, authToken });
  globalForDb.__libsql = client;

  const database = drizzle(client, { schema });
  globalForDb.__db = database;
  return database;
}

/** 첫 접근 때 커넥션을 만드는 지연 프록시. 사용법은 일반 drizzle 인스턴스와 동일. */
export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(connect(), prop, receiver);
  },
});

export { schema };
