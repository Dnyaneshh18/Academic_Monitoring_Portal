import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { ensureDb, one, run } from "@/lib/db";
import { json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  await ensureDb();
  const body = await req.json().catch(() => ({}));
  const token = String(body.token || "");
  const password = String(body.password || "");
  if (password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);
  const row = one<{ id: string; user_id: string; expires_at: string; used: number }>(
    "SELECT * FROM password_resets WHERE token = ?",
    [token]
  );
  if (!row || row.used) return json({ error: "Invalid reset link" }, 400);
  if (new Date(row.expires_at).getTime() < Date.now()) return json({ error: "Reset link expired" }, 400);
  run("UPDATE users SET password_hash = ? WHERE id = ?", [bcrypt.hashSync(password, 8), row.user_id]);
  run("UPDATE password_resets SET used = 1 WHERE id = ?", [row.id]);
  return json({ ok: true });
}
