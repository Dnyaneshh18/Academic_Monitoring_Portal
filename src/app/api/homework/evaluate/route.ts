import { NextRequest } from "next/server";
import { ensureDb, one, run } from "@/lib/db";
import { isResponse, json, requireUser } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

type AiEvalResult = {
  student_id: string;
  obtained: number;
  semantic_score: number;
  keyword_score: number;
  completeness_score: number;
  plagiarism_score: number;
  matched_keywords: string[];
  remark: string;
};

async function extractTextFromRow(row: {
  file_name: string;
  file_data: unknown;
  stored_path: string;
  mime: string | null;
}): Promise<{ text: string; pdf_base64?: string }> {
  const ext = (row.file_name || "").toLowerCase().endsWith(".pdf") || row.mime === "application/pdf";
  const fs = await import("fs");
  let buffer: Buffer | null = null;
  if (row.file_data) {
    if (Buffer.isBuffer(row.file_data)) buffer = row.file_data;
    else if (row.file_data instanceof Uint8Array) buffer = Buffer.from(row.file_data);
    else if (typeof row.file_data === "string") buffer = Buffer.from(row.file_data, "base64");
  }
  if (!buffer && row.stored_path) {
    try {
      if (fs.existsSync(row.stored_path)) buffer = fs.readFileSync(row.stored_path);
    } catch {
      /* ignore */
    }
  }
  if (!buffer) return { text: "" };
  if (ext) {
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
  const t = buffer.toString("utf8").trim();
  return { text: t };
}

export async function POST(req: NextRequest) {
  await ensureDb();
  const user = await requireUser();
  if (isResponse(user)) return user;
  if (user.role !== "STUDENT") return json({ error: "Only students can re-evaluate" }, 403);
  const st = one<{ id: string; class_id: string; batch: string }>(
    "SELECT id, class_id, batch FROM students WHERE id = ? OR user_id = ?",
    [user.studentId || "", user.id]
  );
  if (!st) return json({ error: "Student profile missing" }, 400);

  const body = await req.json().catch(() => ({}));
  const taskId = String(body.taskId || "");
  if (!taskId) return json({ error: "taskId is required" }, 400);

  const sub = one<{ id: string; file_name: string; stored_path: string; file_data: unknown; mime: string | null }>(
    "SELECT id, file_name, stored_path, file_data, mime FROM homework_submissions WHERE task_id = ? AND student_id = ?",
    [taskId, st.id]
  );
  if (!sub) return json({ error: "You have not submitted this assignment yet" }, 404);

  const meta = one<{ model_answer: string | null; instructions: string | null; keywords: string | null; max_marks: number; title: string }>(
    "SELECT model_answer, instructions, keywords, max_marks, title FROM homework_tasks WHERE id = ?",
    [taskId]
  );
  const modelAnswer = (meta?.model_answer || meta?.title || "").trim();
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
  if (!modelAnswer && !keywords.length) {
    return json({ error: "No title, model answer, or keywords configured for this assignment" }, 400);
  }

  const extracted = await extractTextFromRow(sub);
  const payload: Record<string, unknown> = {
    title: meta?.title || "",
    instructions: meta?.instructions || "",
    model_answer: modelAnswer,
    keywords,
    max_marks: meta?.max_marks ?? 10,
    submissions: [{ student_id: st.id, submission_id: sub.id, text: extracted.text }]
  };
  if (!extracted.text && extracted.pdf_base64) {
    payload.submissions = [{ student_id: st.id, submission_id: sub.id, pdf_base64: extracted.pdf_base64 }];
  }

  try {
    const resp = await fetch(`${ML_SERVICE_URL}/evaluate-assignment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      return json({ error: String(errBody?.error || `ML service returned HTTP ${resp.status}`) }, 502);
    }
    const data = (await resp.json().catch(() => ({}))) as { results?: AiEvalResult[] };
    const r = data.results?.[0];
    if (!r) return json({ error: "ML service returned no results" }, 502);
    run(
      `UPDATE homework_submissions
       SET ai_obtained = ?, ai_semantic_score = ?, ai_keyword_score = ?, ai_completeness_score = ?, ai_plagiarism_score = ?, ai_matched_keywords = ?, ai_remark = ?, ai_evaluated_at = datetime('now')
       WHERE id = ?`,
      [
        r.obtained ?? 0,
        r.semantic_score ?? 0,
        r.keyword_score ?? 0,
        r.completeness_score ?? 0,
        r.plagiarism_score ?? 0,
        JSON.stringify(r.matched_keywords || []),
        r.remark ?? "",
        sub.id
      ]
    );
    return json({ ok: true, ai: r });
  } catch (e) {
    return json({ error: `ML service unreachable: ${(e as Error).message}` }, 502);
  }
}
