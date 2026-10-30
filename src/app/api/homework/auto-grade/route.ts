import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { ensureDb, all, one, run } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

type SubmissionRow = {
  id: string;
  student_id: string;
  file_name: string;
  stored_path: string;
  file_data: unknown;
  mime: string | null;
};

function blobToBuffer(blob: unknown): Buffer | null {
  if (!blob) return null;
  if (Buffer.isBuffer(blob)) return blob;
  if (blob instanceof Uint8Array) return Buffer.from(blob);
  if (typeof blob === "string") return Buffer.from(blob, "base64");
  return null;
}

function parseKeywords(raw: string | null | undefined): string[] {
  const s = (raw || "").trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed.map((k) => String(k).trim()).filter(Boolean);
  } catch {
    /* not JSON — fall through to comma split */
  }
  return s.split(",").map((k) => k.trim()).filter(Boolean);
}

/** Extract readable text from a submission (PDF via pdf-parse, TXT as utf8). */
async function extractSubmissionText(row: SubmissionRow): Promise<{ text: string; pdf_base64?: string }> {
  const ext = path.extname(row.file_name || "").toLowerCase();
  let buffer: Buffer | null = null;
  if (row.file_data) buffer = blobToBuffer(row.file_data);
  if (!buffer && row.stored_path) {
    try {
      if (fs.existsSync(row.stored_path)) buffer = fs.readFileSync(row.stored_path);
    } catch {
      /* ignore */
    }
  }
  const isPdf = ext === ".pdf" || row.mime === "application/pdf";
  if (buffer && isPdf) {
    try {
      const pdfParse = (await import("pdf-parse")).default as (b: Buffer) => Promise<{ text: string }>;
      const parsed = await pdfParse(buffer);
      const text = (parsed.text || "").trim();
      if (text) return { text };
    } catch {
      /* fall through to base64 retry */
    }
    return { text: "", pdf_base64: buffer.toString("base64") };
  }
  if (buffer && ext === ".txt") {
    return { text: buffer.toString("utf8").trim() };
  }
  return { text: "" };
}

export async function POST(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role !== "FACULTY" && user.role !== "HOD") return json({ error: "Forbidden" }, 403);
  const body = await req.json().catch(() => ({}));
  const taskId = String(body.taskId || "");
  if (!taskId) return json({ error: "taskId is required" }, 400);

  // preview: return graded suggestions without writing to the DB
  const preview = body.preview === true;
  const apply = body.apply === true || !preview;

  const task = one<{ faculty_id: string; model_answer: string | null; instructions: string | null; keywords: string | null; max_marks: number; title: string }>(
    "SELECT faculty_id, model_answer, instructions, keywords, max_marks, title FROM homework_tasks WHERE id = ?",
    [taskId]
  );
  if (!task || task.faculty_id !== user.facultyId) return json({ error: "Not found" }, 404);

  const modelAnswer = task.model_answer || task.instructions || task.title || "";
  const keywords = parseKeywords(task.keywords);
  if (!modelAnswer && !keywords.length) {
    return json({ error: "Cannot evaluate — no title, model answer, or keywords found for this assignment." }, 400);
  }

  const subs = all<SubmissionRow>("SELECT * FROM homework_submissions WHERE task_id = ?", [taskId]);
  if (!subs.length) return json({ ok: true, evaluated_count: 0, results: [] });

  const items = [];
  for (const sub of subs) {
    const extracted = await extractSubmissionText(sub);
    console.log(`[auto-grade] submission=${sub.id} student=${sub.student_id} ` +
      `file=${sub.file_name} text_len=${extracted.text.length} ` +
      `text_preview='${extracted.text.slice(0, 200).replace(/\n/g, " ")}'`);
    items.push({
      student_id: sub.student_id,
      submission_id: sub.id,
      text: extracted.text,
      ...(extracted.pdf_base64 ? { pdf_base64: extracted.pdf_base64 } : {})
    });
  }

  console.log(`[auto-grade] task=${taskId} title='${task.title}' ` +
    `model_answer_len=${(task.model_answer || "").length} ` +
    `instructions_len=${(task.instructions || "").length} ` +
    `keywords=${JSON.stringify(keywords)} max_marks=${task.max_marks}`);

  let resp: Response;
  try {
    resp = await fetch(`${ML_SERVICE_URL}/evaluate-assignment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ max_marks: task.max_marks, title: task.title, instructions: task.instructions, model_answer: modelAnswer, keywords, submissions: items })
    });
  } catch (e) {
    return json({ error: `ML service unreachable: ${(e as Error).message}` }, 502);
  }
  if (!resp.ok) {
    let msg = `ML service returned HTTP ${resp.status}`;
    try {
      const errBody = await resp.json();
      if (errBody?.error) msg = String(errBody.error);
    } catch {
      /* ignore */
    }
    return json({ error: msg }, 502);
  }

  const payload = (await resp.json().catch(() => ({}))) as {
    results?: { student_id: string; submission_id?: string; obtained: number; semantic_score: number; keyword_score: number; completeness_score: number; plagiarism_score: number; matched_keywords: string[]; remark: string }[];
    error?: string;
  };
  const results = payload.results || [];

  if (apply) {
    for (const r of results) {
      const target =
        r.submission_id ||
        one<{ id: string }>("SELECT id FROM homework_submissions WHERE task_id = ? AND student_id = ?", [
          taskId,
          r.student_id
        ])?.id;
      if (!target) continue;
      run("UPDATE homework_submissions SET obtained = ?, remark = ?, ai_obtained = ?, ai_semantic_score = ?, ai_keyword_score = ?, ai_completeness_score = ?, ai_plagiarism_score = ?, ai_matched_keywords = ?, ai_remark = ?, ai_evaluated_at = datetime('now'), verified = 1 WHERE id = ?", [
        r.obtained ?? 0,
        r.remark ?? "",
        r.obtained ?? 0,
        r.semantic_score ?? 0,
        r.keyword_score ?? 0,
        r.completeness_score ?? 0,
        r.plagiarism_score ?? 0,
        JSON.stringify(r.matched_keywords || []),
        r.remark ?? "",
        target
      ]);
    }
  }

  return json({ ok: true, preview, evaluated_count: results.length, results });
}
