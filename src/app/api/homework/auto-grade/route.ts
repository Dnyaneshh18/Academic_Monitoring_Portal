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

  const task = one<{ faculty_id: string; model_answer: string | null; instructions: string | null; keywords: string | null; max_marks: number }>(
    "SELECT faculty_id, model_answer, instructions, keywords, max_marks FROM homework_tasks WHERE id = ?",
    [taskId]
  );
  if (!task || task.faculty_id !== user.facultyId) return json({ error: "Not found" }, 404);

  const modelAnswer = task.model_answer || task.instructions || "";
  const keywords = parseKeywords(task.keywords);
  if (!modelAnswer && !keywords.length) {
    return json({ error: "Add a model answer / key points or key concepts to this assignment before auto-evaluating." }, 400);
  }

  const subs = all<SubmissionRow>("SELECT * FROM homework_submissions WHERE task_id = ?", [taskId]);
  if (!subs.length) return json({ ok: true, evaluated_count: 0, results: [] });

  const items = [];
  for (const sub of subs) {
    const extracted = await extractSubmissionText(sub);
    items.push({ submission_id: sub.id, text: extracted.text, ...(extracted.pdf_base64 ? { pdf_base64: extracted.pdf_base64 } : {}) });
  }

  let resp: Response;
  try {
    resp = await fetch(`${ML_SERVICE_URL}/evaluate-assignment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ max_marks: task.max_marks, model_answer: modelAnswer, keywords, submissions: items })
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
    results?: { submission_id: string; obtained: number; percentage: number; remark: string }[];
    error?: string;
  };
  const results = payload.results || [];

  for (const r of results) {
    run("UPDATE homework_submissions SET obtained = ?, remark = ?, verified = 1 WHERE id = ?", [
      r.obtained,
      r.remark,
      r.submission_id
    ]);
  }

  return json({ ok: true, evaluated_count: results.length, results });
}
