import { ensureDb } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { collegeScope, reportBundle } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDb();
    const user = await requireUser();
    if (isResponse(user)) return user;
    return json(reportBundle(collegeScope(user)));
  } catch (e) {
    return json(
      {
        error: e instanceof Error ? e.message : "Reports failed",
        classes: [],
        faculty: [],
        defaulters: [],
        attendanceOverall: { students: 0, faculty: 0, attendancePct: 0, defaulters: 0 }
      },
      200
    );
  }
}
