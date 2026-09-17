import { NextRequest } from "next/server";
import { ensureDb } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { timetableForClass } from "@/lib/queries";
import { one } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  let classId = req.nextUrl.searchParams.get("classId") || user.classId;
  if (!classId && user.role === "STUDENT") {
    const st = one<{ class_id: string }>("SELECT class_id FROM students WHERE user_id = ?", [user.id]);
    classId = st?.class_id;
  }
  if (!classId) return json([]);
  return json(timetableForClass(classId));
}
