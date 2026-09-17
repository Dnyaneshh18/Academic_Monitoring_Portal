import { NextRequest } from "next/server";
import { ensureDb, all, one, run } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { scoreStudents } from "@/lib/risk";
import { parentAlertDraft, sendMail, smtpConfigured } from "@/lib/mail";
import { uid } from "@/lib/ids";
import { facultyClassIds } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role !== "FACULTY" && user.role !== "HOD") return json({ error: "Forbidden" }, 403);
  try {
    const classIds = user.facultyId ? facultyClassIds(user.facultyId) : [];
    const scored = scoreStudents({ classIds });
    const high = scored.students.filter((s) => s.level === "HIGH");
    const extra = high.length
      ? all<{
          id: string;
          parent_email: string;
          prn: string;
          guardian_name: string;
        }>(
          `SELECT id, parent_email, prn, guardian_name FROM students WHERE id IN (${high.map(() => "?").join(",")})`,
          high.map((s) => s.studentId)
        )
      : [];
    const map = Object.fromEntries(extra.map((e) => [e.id, e]));
    const log = user.facultyId
      ? all(
          `SELECT p.*, u.name as student_name FROM parent_alerts p JOIN students st ON st.id = p.student_id JOIN users u ON u.id = st.user_id
           WHERE p.faculty_id = ? ORDER BY p.created_at DESC LIMIT 30`,
          [user.facultyId]
        )
      : [];
    return json({
      smtp: smtpConfigured(),
      students: high.map((s) => ({
        ...s,
        prn: map[s.studentId]?.prn,
        parentEmail: map[s.studentId]?.parent_email,
        guardianName: map[s.studentId]?.guardian_name
      })),
      log
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Alerts failed", smtp: smtpConfigured(), students: [], log: [] }, 500);
  }
}

export async function POST(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role !== "FACULTY" && user.role !== "HOD") return json({ error: "Forbidden" }, 403);
  try {
    const body = await req.json().catch(() => ({}));
    const studentId = String(body.studentId || "");
    const st = one<{
      id: string;
      parent_email: string;
      prn: string;
      name: string;
      class_name: string;
    }>(
      `SELECT st.id, st.parent_email, st.prn, u.name, c.name as class_name
       FROM students st JOIN users u ON u.id = st.user_id JOIN classes c ON c.id = st.class_id WHERE st.id = ?`,
      [studentId]
    );
    if (!st?.parent_email) return json({ error: "No parent email on this student" }, 400);
    const classIds = user.facultyId ? facultyClassIds(user.facultyId) : [];
    const scored = scoreStudents({ classIds, studentId });
    const row = scored.students[0];
    const marks = all<{ obtained: number; max_marks: number; title: string }>(
      `SELECT m.obtained, a.max_marks, a.title FROM marks m JOIN assessments a ON a.id = m.assessment_id
       WHERE m.student_id = ? ORDER BY a.date`,
      [studentId]
    );
    const marksLine =
      marks.map((m) => `${m.title}: ${m.obtained}/${m.max_marks}`).join("; ") || `${row?.marksPct ?? 0}% average`;
    const teacher = user.facultyId
      ? one<{ name: string; email: string; phone: string; designation: string; dept: string }>(
          `SELECT u.name, u.email, u.phone, f.designation, d.name as dept
           FROM faculty f
           JOIN users u ON u.id = f.user_id
           LEFT JOIN departments d ON d.id = f.department_id
           WHERE f.id = ?`,
          [user.facultyId]
        )
      : {
          name: user.name,
          email: user.email,
          phone: "",
          designation: user.role,
          dept: ""
        };
    const draft = parentAlertDraft({
      studentName: st.name,
      prn: st.prn,
      className: st.class_name,
      attendancePct: row?.attendancePct ?? 0,
      marks: marksLine,
      reasons: row?.reasons || [],
      collegeName: user.collegeName,
      teacherName: teacher?.name || user.name,
      teacherEmail: teacher?.email || user.email,
      teacherPhone: teacher?.phone || "",
      teacherDesignation: teacher?.designation || "",
      teacherDept: teacher?.dept || ""
    });
    if (body.preview) {
      return json({
        ok: true,
        preview: true,
        to: st.parent_email,
        subject: draft.subject,
        body: draft.body,
        teacher: {
          name: teacher?.name || user.name,
          email: teacher?.email || user.email,
          phone: teacher?.phone || "",
          designation: teacher?.designation || "",
          dept: teacher?.dept || ""
        }
      });
    }
    const sent = await sendMail(st.parent_email, draft.subject, draft.body, teacher?.email || user.email);
    const id = uid("pa_");
    run(
      `INSERT INTO parent_alerts (id, student_id, faculty_id, parent_email, subject, body, status, error, sent_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        id,
        studentId,
        user.facultyId || null,
        st.parent_email,
        draft.subject,
        draft.body,
        sent.ok ? "SENT" : "FAILED",
        sent.ok ? null : sent.error,
        sent.ok ? new Date().toISOString() : null
      ]
    );
    if (!sent.ok) return json({ ok: false, error: sent.error, to: st.parent_email, subject: draft.subject, body: draft.body });
    return json({ ok: true, to: st.parent_email, subject: draft.subject, body: draft.body });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Send failed" }, 500);
  }
}
