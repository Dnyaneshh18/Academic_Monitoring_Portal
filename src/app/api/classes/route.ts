import { NextRequest } from "next/server";
import { ensureDb } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { collegeScope, createClass, listClasses } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  return json(listClasses(collegeScope(user)));
}

export async function POST(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role !== "ADMIN" && user.role !== "COLLEGE_ADMIN" && user.role !== "HOD") {
    return json({ error: "Forbidden" }, 403);
  }
  const body = await req.json();
  try {
    const id = createClass(body);
    return json({ ok: true, id });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not save class" }, 400);
  }
}
