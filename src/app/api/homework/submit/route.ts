import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { ensureDb, one, run } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";
import { uid } from "@/lib/ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

const ALLOWED = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".txt",
  ".zip"
]);

type AiEvalResult = {
  student_id: string;
  obtained: number;
  semantic_score: number;
  keyword_score: number;
  completeness_score: number;
  matched_keywords: string[];
  remark: string;
};

async function extractTextFromBuffer(buffer: Buffer, fileName: string): Promise<string> {
  const ext = path.extname(fileName || "").toLowerCase();
  if (buffer && ext === ".txt") return buffer.toString("utf8").trim();
  if (buffer && ext === ".pdf") {
    try {
      const pdfParse = (await import("pdf-parse")).default as (b: Buffer) => Promise<{ text: string }>;
      const parsed = await pdfParse(buffer);
      return (parsed.text || "").trim();
    } catch {
      /* fall through to base64 retry at the ML service */
    }
  }
  return "";
}

export async function POST(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role !== "STUDENT") return json({ error: "Only students can upload" }, 403);
  const st = one<{ id: string; class_id: string; batch: string }>(
    "SELECT id, class_id, batch FROM students WHERE id = ? OR user_id = ?",
    [user.studentId || "", user.id]
  );
  if (!st) return json({ error: "Student profile missing" }, 400);

  const form = await req.formData();
  const taskId = String(form.get("taskId") || "");
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Choose a file" }, 400);
  const task = one<{ id: string; class_id: string; batch: string | null; due_date: string }>(
    "SELECT * FROM homework_tasks WHERE id = ?",
    [taskId]
  );
  if (!task) return json({ error: "Assignment not found" }, 404);
  if (task.class_id !== st.class_id) return json({ error: "This assignment is not for your class" }, 403);
  if (task.batch && task.batch !== st.batch) return json({ error: "This assignment is not for your batch" }, 403);
  if (task.due_date && task.due_date < new Date().toISOString().slice(0, 10)) {
    return json({ error: "Due date has passed" }, 400);
  }
  const ext = path.extname(file.name || "").toLowerCase();
  if (!ALLOWED.has(ext)) return json({ error: "Allowed: PDF, Word, PPT, Excel, images, TXT, ZIP" }, 400);
  if (file.size > 15 * 1024 * 1024) return json({ error: "File must be under 15 MB" }, 400);

  const safe = (file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
  const stored = `${st.id}-${uid("f_")}${ext}`;
  const fileData = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "data", "uploads", taskId);
  let storedPath = "";
  if (!process.env.VERCEL) {
    fs.mkdirSync(dir, { recursive: true });
    storedPath = path.join(dir, stored);
    fs.writeFileSync(storedPath, fileData);
  }

  const existing = one<{ id: string; stored_path: string }>(
    "SELECT id, stored_path FROM homework_submissions WHERE task_id = ? AND student_id = ?",
    [taskId, st.id]
  );
  if (existing) {
    try {
      fs.unlinkSync(existing.stored_path);
    } catch {
      /* ignore */
    }
    run(
      `UPDATE homework_submissions SET file_name = ?, stored_path = ?, file_data = ?, mime = ?, size = ?, submitted_at = datetime('now'), verified = 0, obtained = NULL
       WHERE id = ?`,
      [safe, storedPath, fileData, file.type || null, file.size, existing.id]
    );
  } else {
    run(
      `INSERT INTO homework_submissions (id, task_id, student_id, file_name, stored_path, file_data, mime, size)
       VALUES (?,?,?,?,?,?,?,?)`,
      [uid("hs_"), taskId, st.id, safe, storedPath, fileData, file.type || null, file.size]
    );
  }

  // --- AI evaluation (local NLP) right after upload ---
  // Extract text from the uploaded file and score it against the task's
  // model answer / keywords via the local ML service. The AI estimate is
  // informational for the student; the faculty still reviews and commits.
  const subRow = one<{ id: string }>(
    "SELECT id FROM homework_submissions WHERE task_id = ? AND student_id = ?",
    [taskId, st.id]
  );
  let ai: AiEvalResult | null = null;
  let aiError: string | null = null;
  if (subRow) {
    const meta = one<{ model_answer: string | null; keywords: string | null; max_marks: number }>(
      "SELECT model_answer, keywords, max_marks FROM homework_tasks WHERE id = ?",
      [taskId]
    );
    const modelAnswer = (meta?.model_answer || "").trim();
    let keywords: string[] = [];
    if (meta?.keywords) {
      try {
        const parsed = JSON.parse(meta.keywords);
        if (Array.isArray(parsed)) keywords = parsed.map((k) => String(k).trim()).filter(Boolean);
        else keywords = meta.keywords.split(",").map((k) => k.trim()).filter(Boolean);
      } catch {
        keywords = meta.keywords.split(",").map((k) => k.trim()).filter(Boolean);
      }
    }
    if (modelAnswer || keywords.length) {
      let text = await extractTextFromBuffer(fileData, safe);
      let payload: Record<string, unknown> = {
        model_answer: modelAnswer,
        keywords,
        max_marks: meta?.max_marks ?? 10,
        submissions: [{ student_id: st.id, submission_id: subRow.id, text }]
      };
      if (!text && ext === ".pdf") {
        // Let the ML service try extracting from the raw PDF bytes.
        payload.submissions = [{ student_id: st.id, submission_id: subRow.id, pdf_base64: fileData.toString("base64") }];
      }
      try {
        const resp = await fetch(`${ML_SERVICE_URL}/evaluate-assignment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) {
          const errBody = await resp.json().catch(() => ({}));
          aiError = String(errBody?.error || `ML service returned HTTP ${resp.status}`);
        } else {
          const data = (await resp.json().catch(() => ({}))) as { results?: AiEvalResult[] };
          const r = data.results?.[0];
          if (r) {
            ai = r;
            run(
              `UPDATE homework_submissions
               SET ai_obtained = ?, ai_semantic_score = ?, ai_keyword_score = ?, ai_completeness_score = ?, ai_matched_keywords = ?, ai_remark = ?, ai_evaluated_at = datetime('now')
               WHERE id = ?`,
              [
                r.obtained,
                r.semantic_score,
                r.keyword_score,
                r.completeness_score,
                JSON.stringify(r.matched_keywords || []),
                r.remark,
                subRow.id
              ]
            );
          }
        }
      } catch (e) {
        aiError = `ML service unreachable: ${(e as Error).message}`;
      }
    }
  }

  return json({ ok: true, ai, ai_error: aiError || undefined });
}
