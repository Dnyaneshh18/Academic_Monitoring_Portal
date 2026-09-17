import { NextRequest } from "next/server";
import { ensureDb, one, run } from "@/lib/db";
import { json } from "@/lib/api";
import { uid } from "@/lib/ids";
import { sendMail, smtpConfigured } from "@/lib/mail";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  await ensureDb();
  const body = await req.json().catch(() => ({}));
  const login = String(body.login || "").trim();
  let user = one<{ id: string; email: string; name: string }>(
    "SELECT id, email, name FROM users WHERE email = ? AND role = 'STUDENT'",
    [login.toLowerCase()]
  );
  if (!user) {
    const st = one<{ user_id: string }>("SELECT user_id FROM students WHERE prn = ?", [login]);
    if (st) user = one("SELECT id, email, name FROM users WHERE id = ?", [st.user_id]);
  }
  if (!user) return json({ error: "No student found for this email / PRN" }, 404);
  const token = uid("rst_");
  const expires = new Date(Date.now() + 1000 * 60 * 60).toISOString();
  run("INSERT INTO password_resets (id, user_id, token, expires_at, used) VALUES (?,?,?,?,0)", [
    uid("pr_"),
    user.id,
    token,
    expires
  ]);
  const link = `/login/reset?token=${token}`;
  const text = `Hello ${user.name},\n\nReset your Academic Monitoring Portal password using this link (valid 1 hour):\n${link}\n\nIf you did not request this, ignore the mail.\n\nVIT Pune`;
  const sent = smtpConfigured() ? await sendMail(user.email, "Reset your portal password — VIT Pune", text) : { ok: false as const, error: "SMTP not set" };
  return json({
    ok: true,
    emailed: sent.ok,
    hint: sent.ok ? `Reset mail sent to ${user.email}` : `SMTP not configured. Use this reset link now: ${link}`,
    token: sent.ok ? undefined : token
  });
}
