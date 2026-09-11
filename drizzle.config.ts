import type { Config } from "drizzle-kit";
import { resolveDbEnv } from "./src/lib/db-env";

// drizzle-kit은 .env.local을 자동으로 읽지 않는다. Node 24의 내장 로더로 직접 읽어서
// `npx drizzle-kit push` 한 줄로 로컬/원격 어디든 반영할 수 있게 한다.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // 파일이 없으면 무시하고 다음 후보로
  }
}

const { url, authToken } = resolveDbEnv();

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: { url, authToken },
} satisfies Config;
