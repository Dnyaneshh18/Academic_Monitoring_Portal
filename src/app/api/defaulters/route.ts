import { NextRequest } from "next/server";
import { ensureDb, all } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { collegeScope, defaulterList } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role === "ADMIN") return json({ error: "Defaulters are handled by faculty" }, 403);

  const q = req.nextUrl.searchParams;
  const threshold = Number(q.get("threshold") || 75);
  const branch = q.get("branch") || undefined;
  const division = q.get("division") || undefined;
  const marksBelowRaw = q.get("marksBelow");
  const marksBelow = marksBelowRaw ? Number(marksBelowRaw) : null;
  const mode = (q.get("mode") as "att" | "or" | "and") || "att";

  let classIds: string[] | undefined;
  if ((user.role === "FACULTY" || user.role === "HOD") && user.facultyId) {
    classIds = all<{ class_id: string }>("SELECT DISTINCT class_id FROM allotments WHERE faculty_id = ?", [
      user.facultyId
    ]).map((r) => r.class_id);
  }

  return json(
    defaulterList({
      threshold,
      branch,
      division,
      marksBelow,
      mode,
      classIds,
      collegeId: collegeScope(user)
    })
  );
}
