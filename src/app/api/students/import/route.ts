import { NextRequest } from "next/server";
import { ensureDb } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { parseTableText, type RosterRow } from "@/lib/parseRoster";
import { importStudents } from "@/lib/importStudents";
import { one } from "@/lib/db";
import { collegeScope } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fileToText(file: File) {
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return buf.toString("utf8");
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_csv(sheet);
  }
  if (name.endsWith(".pdf")) {
    const pdfParse = (await import("pdf-parse")).default as (b: Buffer) => Promise<{ text: string }>;
    const data = await pdfParse(buf);
    return data.text;
  }
  throw new Error("Use CSV, Excel (.xlsx) or PDF");
}

export async function POST(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role !== "ADMIN" && user.role !== "COLLEGE_ADMIN" && user.role !== "HOD") {
    return json({ error: "Only college admin can import students" }, 403);
  }

  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const body = await req.json();
    if (!body.classId) return json({ error: "Select branch and division" }, 400);
    const cls = one<{ id: string; division: string; department_id: string; college_id?: string }>(
      `SELECT c.*, d.college_id FROM classes c JOIN departments d ON d.id = c.department_id WHERE c.id = ?`,
      [body.classId]
    );
    if (!cls) return json({ error: "Class not found" }, 400);
    const scope = collegeScope(user);
    if (scope && cls.college_id && cls.college_id !== scope) {
      return json({ error: "That class is not in your college" }, 403);
    }
    const dept = one<{ code: string }>("SELECT code FROM departments WHERE id = ?", [cls.department_id]);
    const result = importStudents(body.classId, dept?.code || "GEN", cls.division, (body.rows || []) as RosterRow[], {
      collegeId: scope,
      emailDomain: `${(user.collegeCode || "college").toLowerCase()}.edu`
    });
    return json(result);
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Choose a file" }, 400);
  try {
    const text = await fileToText(file);
    const rows = parseTableText(text);
    if (!rows.length) {
      return json(
        {
          error:
            "Could not read student rows. For scanned PDFs you would need an AI key. For now use the CSV/Excel template.",
          rows: []
        },
        400
      );
    }
    return json({ rows, count: rows.length });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Parse failed" }, 400);
  }
}
