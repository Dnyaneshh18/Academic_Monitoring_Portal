import { NextRequest } from "next/server";
import { ensureDb } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { collegeScope, createNotice, listNotices } from "@/lib/queries";

export const runtime = "nodejs";

export async function GET() {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  return json(listNotices(user.role, collegeScope(user)));
}

export async function POST(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role === "STUDENT") return json({ error: "Forbidden" }, 403);
  const body = await req.json();
  createNotice(user.id, body.title, body.body, body.audience || "ALL", Boolean(body.pinned), collegeScope(user));
  return json({ ok: true });
}
