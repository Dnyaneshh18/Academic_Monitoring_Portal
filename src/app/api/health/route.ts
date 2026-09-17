import { ensureDb, one } from "@/lib/db";
import { json } from "@/lib/api";
import { getPool, pgConnected, pgLastError, pgTableCounts, postgresUrl } from "@/lib/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDb();
  const pool = await getPool();
  const sqliteUsers = one<{ c: number }>("SELECT COUNT(*) as c FROM users");
  const counts = pool ? await pgTableCounts() : null;
  return json({
    version: process.env.VERCEL_GIT_COMMIT_SHA || "local",
    postgres: {
      url: postgresUrl().replace(/:[^:@/]+@/, ":****@"),
      connected: pgConnected() && Boolean(pool),
      error: pgLastError() || null,
      tables: counts
    },
    sqlite: {
      users: sqliteUsers?.c || 0
    }
  });
}
