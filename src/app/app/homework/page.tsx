"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { FileOpen } from "@/components/FileOpen";
import { api, apiForm, getToken } from "@/lib/client";
import type { SessionUser } from "@/lib/auth";
import type { Allotment } from "@/lib/queries";

type Task = {
  id: string;
  title: string;
  instructions: string;
  max_marks: number;
  due_date: string;
  batch: string | null;
  subject_name: string;
  subject_code: string;
  class_name: string;
  division?: string;
  branch_code?: string;
  faculty_name?: string;
  brief_name?: string | null;
  model_answer?: string | null;
  keywords?: string | null;
  submission_id?: string;
  file_name?: string;
  submitted_at?: string;
  verified?: number;
  obtained?: number;
  ai_obtained?: number | null;
  ai_semantic_score?: number | null;
  ai_keyword_score?: number | null;
  ai_completeness_score?: number | null;
  ai_plagiarism_score?: number | null;
  ai_matched_keywords?: string | null;
  ai_remark?: string | null;
  ai_evaluated_at?: string | null;
};

type Row = {
  id: string;
  name: string;
  roll_no: string;
  batch: string;
  submission: {
    id: string;
    file_name: string;
    submitted_at: string;
    verified: number;
    obtained: number;
    remark: string;
    ai_obtained: number | null;
    ai_semantic_score: number | null;
    ai_keyword_score: number | null;
    ai_completeness_score: number | null;
    ai_plagiarism_score: number | null;
    ai_matched_keywords: string | null;
    ai_remark: string | null;
    ai_evaluated_at: string | null;
  } | null;
};

type AiResult = {
  student_id: string;
  obtained: number;
  remark: string;
  semantic_score: number;
  keyword_score: number;
  completeness_score: number;
  plagiarism_score: number;
  matched_keywords: string[];
};

export default function HomeworkPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allotments, setAllotments] = useState<Allotment[]>([]);
  const [branch, setBranch] = useState("");
  const [division, setDivision] = useState("");
  const [kind, setKind] = useState<"THEORY" | "LAB">("THEORY");
  const [batch, setBatch] = useState("");
  const [form, setForm] = useState({
    title: "",
    instructions: "",
    modelAnswer: "",
    keywords: "",
    maxMarks: 20,
    dueDate: ""
  });
  const [openId, setOpenId] = useState("");
  const [detail, setDetail] = useState<{ task: Task; students: Row[] } | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [file, setFile] = useState<Record<string, File | null>>({});
  const [brief, setBrief] = useState<File | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [aiResults, setAiResults] = useState<Record<string, AiResult> | null>(null);
  const [prevMarks, setPrevMarks] = useState<Record<string, number | null>>({});
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    instructions: "",
    modelAnswer: "",
    keywords: "",
    maxMarks: 20,
    dueDate: ""
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const selected = useMemo(
    () =>
      allotments.find(
        (a) =>
          a.branch_code === branch &&
          a.division === division &&
          a.kind === kind &&
          (kind === "LAB" ? a.batch === batch : true)
      ),
    [allotments, branch, division, kind, batch]
  );

  async function loadMe() {
    setError("");
    const me = await api<{ user: SessionUser }>("/api/auth/me");
    if (!me?.user) return;
    setUser(me.user);
    const hw = await api<{ tasks?: Task[] }>("/api/homework");
    setTasks(hw?.tasks || []);
    if (me.user.role === "STUDENT") return;
    const al = await api<Allotment[] | { length?: number }>("/api/allotments");
    const list = Array.isArray(al) ? al : [];
    setAllotments(list);
    if (list[0]) {
      setBranch(list[0].branch_code);
      setDivision(list[0].division);
      setKind(list[0].kind === "LAB" ? "LAB" : "THEORY");
      setBatch(list[0].batch || "");
    }
  }

  useEffect(() => {
    loadMe().catch(() => {});
  }, []);

  async function openTask(id: string) {
    try {
      setOpenId(id);
      const d = await api<{ task: Task; students: Row[] }>(`/api/homework?id=${id}`);
      setDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open");
    }
  }

  const branches = useMemo(() => {
    const m = new Map<string, string>();
    allotments.forEach((a) => m.set(a.branch_code, a.branch_name));
    return Array.from(m.entries()).map(([id, label]) => ({ id, label: `${id} — ${label}` }));
  }, [allotments]);
  const divisions = useMemo(
    () => Array.from(new Set(allotments.filter((a) => a.branch_code === branch).map((a) => a.division))).sort(),
    [allotments, branch]
  );
  const kinds = useMemo(
    () => Array.from(new Set(allotments.filter((a) => a.branch_code === branch && a.division === division).map((a) => a.kind))),
    [allotments, branch, division]
  );
  const batches = useMemo(
    () =>
      Array.from(
        new Set(
          allotments
            .filter((a) => a.branch_code === branch && a.division === division && a.kind === "LAB" && a.batch)
            .map((a) => a.batch as string)
        )
      ).sort(),
    [allotments, branch, division]
  );

  async function create() {
    if (!selected) return;
    setError("");
    setMsg("");
    if (!form.title.trim()) {
      setError("Enter an assignment title.");
      return;
    }
    const fd = new FormData();
    fd.append("title", form.title.trim());
    fd.append("subjectId", selected.subject_id);
    fd.append("batch", kind === "LAB" ? batch || "" : "");
    fd.append("instructions", form.instructions);
    fd.append("modelAnswer", form.modelAnswer);
    fd.append("keywords", form.keywords);
    fd.append("maxMarks", String(form.maxMarks));
    fd.append("dueDate", form.dueDate);
    if (brief) fd.append("brief", brief);
    try {
      setPublishing(true);
      await apiForm("/api/homework/create", fd);
      setMsg("Assignment published with title. Students can view/download the file.");
      setForm({ ...form, title: "", instructions: "" });
      setBrief(null);
      const hw = await api<{ tasks: Task[] }>("/api/homework");
      setTasks(hw.tasks || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish");
    } finally {
      setPublishing(false);
    }
  }

  async function upload(taskId: string) {
    const f = file[taskId];
    if (!f) {
      setError("Choose a file first.");
      return;
    }
    setError("");
    const fd = new FormData();
    fd.append("taskId", taskId);
    fd.append("file", f);
    try {
      const r = await apiForm<{ ok?: boolean; ai?: { obtained: number; remark: string; semantic_score: number; keyword_score: number; completeness_score: number; matched_keywords: string[] } | null; ai_error?: string }>(
        "/api/homework/submit",
        fd
      );
      if (!r?.ok) {
        setError("Upload failed");
        return;
      }
      if (r.ai) {
        setMsg(`Uploaded. 🤖 AI estimate: ${r.ai.obtained} marks — ${r.ai.remark}`);
      } else if (r.ai_error) {
        setMsg(`Uploaded. AI evaluation unavailable (${r.ai_error}). Faculty can still review.`);
      } else {
        setMsg("Submitted.");
      }
      const hw = await api<{ tasks: Task[] }>("/api/homework");
      setTasks(hw.tasks || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  }

  async function reevaluate(taskId: string) {
    setError("");
    setMsg("");
    setEvaluating(true);
    try {
      const r = await api<{
        ok?: boolean;
        ai?: { obtained: number; remark: string };
        error?: string;
      }>("/api/homework/evaluate", {
        method: "POST",
        body: JSON.stringify({ taskId })
      });
      if (!r?.ok) {
        setError(r?.error || "AI evaluation failed");
        return;
      }
      setMsg(`🤖 AI estimate: ${r.ai?.obtained} marks — ${r.ai?.remark}`);
      const hw = await api<{ tasks: Task[] }>("/api/homework");
      setTasks(hw.tasks || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI evaluation failed");
    } finally {
      setEvaluating(false);
    }
  }

  async function mark(studentId: string, obtained: number) {
    if (!detail) return;
    await api("/api/homework", {
      method: "POST",
      body: JSON.stringify({ action: "mark", taskId: detail.task.id, studentId, obtained })
    });
    await openTask(detail.task.id);
  }

  async function verifyAll() {
    if (!detail) return;
    const r = await api<{ note?: string }>("/api/homework", {
      method: "POST",
      body: JSON.stringify({ action: "verifyAll", taskId: detail.task.id })
    });
    setMsg(r.note || "Verified submitted work with full marks.");
    await openTask(detail.task.id);
  }

  function isAiSuggested(s: Row) {
    if (s.submission?.remark && s.submission.remark.trim().startsWith("Auto-evaluated")) return true;
    if (s.submission?.ai_remark && s.submission.ai_remark.trim().startsWith("Auto-evaluated")) return true;
    return false;
  }

  function startEdit(task: Task) {
    setEditTask(task);
    setEditForm({
      title: task.title || "",
      instructions: task.instructions || "",
      modelAnswer: task.model_answer || "",
      keywords: task.keywords || "",
      maxMarks: task.max_marks || 20,
      dueDate: task.due_date || ""
    });
    setError("");
    setMsg("");
  }

  async function saveEdit() {
    if (!editTask) return;
    setSavingEdit(true);
    setError("");
    try {
      const r = await api<{ ok?: boolean; error?: string }>("/api/homework/update", {
        method: "POST",
        body: JSON.stringify({
          taskId: editTask.id,
          title: editForm.title,
          instructions: editForm.instructions,
          modelAnswer: editForm.modelAnswer,
          keywords: editForm.keywords,
          maxMarks: editForm.maxMarks,
          dueDate: editForm.dueDate
        })
      });
      if (!r?.ok) {
        setError(r?.error || "Could not save changes");
        return;
      }
      setMsg("Assignment updated.");
      setEditTask(null);
      const hw = await api<{ tasks: Task[] }>("/api/homework");
      setTasks(hw.tasks || []);
      if (detail && detail.task.id === editTask.id) {
        await openTask(editTask.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save changes");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleAutoEvaluate() {
    if (!detail) return;
    setError("");
    setMsg("");
    // Capture current marks so the faculty can revert AI suggestions later.
    const prev: Record<string, number | null> = {};
    detail.students.forEach((s) => {
      if (s.submission) prev[s.id] = s.submission.obtained ?? null;
    });
    setPrevMarks(prev);
    setAiResults(null);
    setEvaluating(true);
    try {
      const r = await api<{
        ok?: boolean;
        evaluated_count?: number;
        results?: AiResult[];
        error?: string;
      }>("/api/homework/auto-grade", {
        method: "POST",
        body: JSON.stringify({ taskId: detail.task.id, preview: true })
      });
      if (!r?.ok) {
        setError(r?.error || "Auto-evaluation failed");
        return;
      }
      const keyed: Record<string, AiResult> = {};
      for (const res of r.results || []) {
        keyed[res.student_id] = res;
      }
      setAiResults(keyed);
      setMsg(`Evaluating submissions using Local NLP… done — ${r.evaluated_count} suggestion(s) ready to review.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auto-evaluation failed");
    } finally {
      setEvaluating(false);
    }
  }

  async function acceptAiMarks() {
    if (!detail) return;
    setEvaluating(true);
    try {
      const r = await api<{ ok?: boolean; evaluated_count?: number; error?: string }>(
        "/api/homework/auto-grade",
        { method: "POST", body: JSON.stringify({ taskId: detail.task.id, apply: true }) }
      );
      if (!r?.ok) {
        setError(r?.error || "Could not commit AI marks");
        return;
      }
      setAiResults(null);
      setMsg("AI marks accepted and saved. Edit any mark anytime to increase or decrease it.");
      await openTask(detail.task.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not commit AI marks");
    } finally {
      setEvaluating(false);
    }
  }

  function revertAiMarks() {
    setAiResults(null);
    setMsg("AI suggestions discarded — your original marks are still in place.");
  }

  async function revertRow(studentId: string) {
    if (!detail) return;
    if (aiResults && aiResults[studentId]) {
      const next = { ...aiResults };
      delete next[studentId];
      setAiResults(next);
      setMsg("AI suggestion for this student dismissed.");
      return;
    }
    const prev = prevMarks[studentId];
    if (prev === null || prev === undefined) {
      setMsg("No previous mark to restore for this student.");
      return;
    }
    await mark(studentId, prev);
    setMsg(`Restored previous mark (${prev} / ${detail.task.max_marks}).`);
  }

  function fileUrl(id: string) {
    const t = getToken();
    return `/api/homework/file?id=${id}${t ? `&access_token=${encodeURIComponent(t)}` : ""}`;
  }

  function briefUrl(id: string) {
    const t = getToken();
    return `/api/homework/brief?id=${id}${t ? `&access_token=${encodeURIComponent(t)}` : ""}`;
  }

  if (user?.role === "STUDENT") {
    return (
      <div>
        <PageHeader kicker="My work" title="Assignments" hint="Upload PDF, Word, PPT, Excel, images or ZIP before the due date." />
        {msg ? <p className="mb-3 text-sm text-brand-700">{msg}</p> : null}
        {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
        <div className="space-y-3">
          {tasks.map((t) => (
            <article key={t.id} className="glass p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl">{t.title}</h2>
                  <p className="text-sm text-ink-600">
                    {t.subject_code} {t.subject_name} · {t.faculty_name} · due {t.due_date || "—"} · {t.max_marks} marks
                    {t.batch ? ` · ${t.batch}` : " · whole division"}
                  </p>
                  {t.instructions ? <p className="mt-2 text-sm">{t.instructions}</p> : null}
                  {t.brief_name ? (
                    <div className="mt-2">
                      <FileOpen href={briefUrl(t.id)} label={`View assignment (${t.brief_name})`} />
                    </div>
                  ) : null}
                </div>
                <span className={`badge ${t.submission_id ? "bg-brand-100 text-brand-800" : "badge badge-warning"}`}>
                  {t.submission_id ? (t.verified ? `Verified · ${t.obtained}/${t.max_marks}` : (t.ai_obtained !== null && t.ai_obtained !== undefined ? `AI estimate: ${t.ai_obtained}/${t.max_marks}` : "Submitted")) : "Not submitted"}
                </span>
              </div>
              {t.submission_id && t.ai_obtained !== null && t.ai_obtained !== undefined ? (
                <div className="mt-2 rounded-lg border border-brand-200 bg-brand-50 p-2 text-xs text-brand-900">
                  <p className="font-semibold">🤖 AI estimate: {t.ai_obtained} / {t.max_marks} marks</p>
                  <p className="mt-0.5 text-brand-700">{t.ai_remark}</p>
                  {t.ai_matched_keywords ? (
                    <p className="mt-0.5 text-ink-600">
                      Keywords matched: {JSON.parse(t.ai_matched_keywords || "[]").join(", ") || "—"}
                    </p>
                  ) : null}
                  {t.ai_plagiarism_score !== null && t.ai_plagiarism_score !== undefined ? (
                    <p className="text-[11px] text-ink-500">Originality: {Math.round(t.ai_plagiarism_score * 100)}%</p>
                  ) : null}
                  {t.ai_evaluated_at ? <p className="text-ink-400">Evaluated at {t.ai_evaluated_at}</p> : null}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  onChange={(e) => setFile({ ...file, [t.id]: e.target.files?.[0] || null })}
                />
                <button className="btn-accent" onClick={() => upload(t.id)}>
                  Upload
                </button>
                {t.submission_id ? (
                  <>
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => reevaluate(t.id)}
                      disabled={evaluating}
                    >
                      {evaluating ? "Evaluating…" : "🤖 Re-evaluate"}
                    </button>
                    <FileOpen href={fileUrl(t.submission_id)} label="View / download my file" />
                  </>
                ) : null}
              </div>
            </article>
          ))}
          {tasks.length === 0 ? <p className="text-sm text-ink-500">No assignments for your class yet.</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        kicker="Faculty"
        title="Assignments"
        hint="Create for a division or a lab batch. Students upload files. Verify all awards full marks only to those who submitted."
      />
      {msg ? <p className="mb-3 text-sm text-brand-700">{msg}</p> : null}
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
      {allotments.length === 0 ? (
        <p className="mb-3 text-sm text-ink-500">No class is allotted to you yet. Ask your HOD / college admin to assign a subject.</p>
      ) : null}

      <div className="mb-6 grid gap-3 glass p-4 md:grid-cols-4">
        <div>
          <label className="label">Branch</label>
          <select
            className="field"
            value={branch}
            onChange={(e) => {
              const code = e.target.value;
              const n = allotments.find((a) => a.branch_code === code);
              setBranch(code);
              setDivision(n?.division || "");
              setKind(n?.kind === "LAB" ? "LAB" : "THEORY");
              setBatch(n?.batch || "");
            }}
          >
            {branches.length === 0 ? <option value="">No branch allotted</option> : null}
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Division</label>
          <select className="field" value={division} onChange={(e) => setDivision(e.target.value)}>
            {divisions.length === 0 ? <option value="">—</option> : null}
            {divisions.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Type</label>
          <select className="field" value={kind} onChange={(e) => setKind(e.target.value as "THEORY" | "LAB")}>
            {kinds.includes("THEORY") || kinds.length === 0 ? <option value="THEORY">Whole division</option> : null}
            {kinds.includes("LAB") ? <option value="LAB">Lab batch</option> : null}
          </select>
        </div>
        {kind === "LAB" ? (
          <div>
            <label className="label">Batch</label>
            <select className="field" value={batch} onChange={(e) => setBatch(e.target.value)}>
              {batches.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="label">Batch</label>
            <input className="field" disabled value="All students in division" />
          </div>
        )}
        <div className="md:col-span-4">
          <label className="label">Assignment title</label>
          <input
            className="field"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Assignment 1 — Sorting"
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">Subject</label>
          <input
            className="field"
            disabled
            value={selected ? `${selected.subject_code} · ${selected.subject_name}` : "No allotment"}
          />
        </div>
        <div>
          <label className="label">Due date</label>
          <input className="field" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </div>
        <div>
          <label className="label">Total marks</label>
          <input className="field" type="number" min={1} value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: Number(e.target.value) })} />
        </div>
        <div className="md:col-span-4">
          <label className="label">Upload assignment file (PDF / Word / PPT / image)</label>
          <input className="field" type="file" onChange={(e) => setBrief(e.target.files?.[0] || null)} />
          {brief ? <p className="mt-1 text-xs text-ink-500">{brief.name}</p> : null}
        </div>
        <div className="md:col-span-3">
          <label className="label">Short instructions (optional)</label>
          <input className="field" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
        </div>
        <div className="md:col-span-4">
          <label className="label">Model Answer / Key Points (for Auto-Evaluation)</label>
          <textarea
            className="field"
            rows={3}
            value={form.modelAnswer}
            onChange={(e) => setForm({ ...form, modelAnswer: e.target.value })}
            placeholder="Reference answer or key points a good submission should cover — used by the local NLP auto-evaluator…"
          />
        </div>
        <div className="md:col-span-3">
          <label className="label">Key Concepts (comma-separated, optional)</label>
          <input
            className="field"
            value={form.keywords}
            onChange={(e) => setForm({ ...form, keywords: e.target.value })}
            placeholder="e.g. bubble sort, complexity, stability"
          />
        </div>
        <div className="flex items-end">
          <button className="btn-accent w-full" onClick={create} disabled={!selected || !form.title || publishing}>
            {publishing ? "Publishing..." : "Publish assignment"}
          </button>
        </div>
      </div>

      <div className="mb-4 table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Title</th>
              <th>Class</th>
              <th>Due</th>
              <th>Marks</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td>
                  {t.title}
                  <div className="text-[11px] text-ink-400">
                    {t.subject_code} {t.subject_name}
                  </div>
                </td>
                <td>
                  {t.branch_code} {t.class_name}
                  {t.batch ? ` · ${t.batch}` : " · all"}
                </td>
                <td>{t.due_date || "—"}</td>
                <td>{t.max_marks}</td>
                <td className="space-x-2">
                  {t.brief_name ? <FileOpen href={briefUrl(t.id)} label="View file" className="text-xs font-semibold text-brand-700 underline" /> : null}
                  <button className="btn-ghost text-xs" onClick={() => openTask(t.id)}>
                    Open submissions
                  </button>
                  <button className="btn-ghost text-xs" onClick={() => startEdit(t)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail ? (
        <section className="glass p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl">{detail.task.title}</h2>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button className="btn-accent" onClick={verifyAll}>
                Verify all submitted (full marks)
              </button>
              <button
                className="btn-accent flex items-center gap-2"
                onClick={handleAutoEvaluate}
                disabled={evaluating}
              >
                {evaluating ? "Evaluating Submissions…" : "🤖 Auto-Evaluate with AI (Local NLP)"}
              </button>
            </div>
          </div>
          <p className="mb-3 text-sm text-ink-600">
            {detail.students.filter((s) => s.submission).length} submitted ·{" "}
            {detail.students.filter((s) => !s.submission).length} not submitted · max {detail.task.max_marks}
          </p>
          {aiResults ? (
            <div className="mb-3 rounded-xl border border-brand-300 bg-brand-50 p-3 text-sm">
              <p className="font-semibold text-brand-900">
                Local NLP suggested marks — review before committing:
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button className="btn-accent" onClick={acceptAiMarks} disabled={evaluating}>
                  ✅ Accept AI marks
                </button>
                <button className="btn-ghost" onClick={revertAiMarks}>
                  ↺ Revert AI marks
                </button>
              </div>
              <p className="mt-2 text-xs text-ink-600">
                Nothing is saved yet. Accept commits the suggested marks to the database; revert keeps your
                original marks. You can also edit any mark inline — it saves automatically.
              </p>
            </div>
          ) : null}
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Roll</th>
                  <th>Student</th>
                  <th>Status</th>
                  <th>File</th>
                  <th>Marks</th>
                  <th>Remark</th>
                </tr>
              </thead>
              <tbody>
                {detail.students.map((s) => (
                  <tr key={s.id}>
                    <td>{s.roll_no}</td>
                    <td>
                      {s.name}
                      <div className="text-[11px] text-ink-400">{s.batch}</div>
                    </td>
                    <td>{s.submission ? (s.submission.verified ? "Verified" : "Submitted") : "Not submitted"}</td>
                    <td>
                      {s.submission ? <FileOpen href={fileUrl(s.submission.id)} label={s.submission.file_name} /> : "—"}
                    </td>
                    <td>
                      {s.submission ? (
                        <span className="flex items-center gap-2">
                          <input
                            key={`${s.id}-${s.submission.obtained ?? s.submission.ai_obtained ?? ""}`}
                            className={`field max-w-[80px] ${isAiSuggested(s) ? "border-brand-400 bg-brand-50" : ""}`}
                            type="number"
                            defaultValue={s.submission.obtained ?? s.submission.ai_obtained ?? ""}
                            onBlur={(e) => {
                              const v = e.target.value;
                              if (v !== "") mark(s.id, Number(v));
                            }}
                          />
                          / {detail.task.max_marks}
                          {aiResults?.[s.id] ? (
                            <span className="badge bg-brand-100 text-brand-800">AI Graded</span>
                          ) : isAiSuggested(s) ? (
                            <span className="badge bg-brand-100 text-brand-800">AI</span>
                          ) : null}
                          {(aiResults?.[s.id] || isAiSuggested(s)) ? (
                            <button
                              className="btn-ghost text-xs"
                              onClick={() => revertRow(s.id)}
                              title={aiResults?.[s.id] ? "Dismiss AI suggestion" : "Restore pre-AI mark"}
                            >
                              ↺
                            </button>
                          ) : null}
                        </span>
                      ) : (
                        "—"
                      )}
                      {aiResults?.[s.id] ? (
                        <div
                          className="mt-1 max-w-[220px] truncate text-[11px] text-brand-700"
                          title={aiResults[s.id].remark}
                        >
                          AI suggests {aiResults[s.id].obtained}
                        </div>
                      ) : null}
                      {s.submission?.ai_obtained !== null && s.submission?.ai_obtained !== undefined && !aiResults?.[s.id] ? (
                        <div className="mt-1 text-[11px] text-ink-500" title={s.submission.ai_remark || ""}>
                          Upload-time AI estimate: {s.submission.ai_obtained} / {detail.task.max_marks}
                        </div>
                      ) : null}
                    </td>
                    <td className="max-w-[280px] text-xs text-ink-600">
                      {aiResults?.[s.id]?.remark || s.submission?.remark || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {editTask ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !savingEdit && setEditTask(null)}>
          <div className="glass w-full max-w-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl">Edit Assignment</h2>
            <p className="mt-1 text-sm text-ink-600">Update the title, model answer, or key concepts for AI evaluation.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="label">Title</label>
                <input className="field" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Short instructions (optional)</label>
                <textarea className="field" rows={2} value={editForm.instructions} onChange={(e) => setEditForm({ ...editForm, instructions: e.target.value })} />
              </div>
              <div>
                <label className="label">Model Answer / Key Points</label>
                <textarea
                  className="field"
                  rows={4}
                  value={editForm.modelAnswer}
                  onChange={(e) => setEditForm({ ...editForm, modelAnswer: e.target.value })}
                  placeholder="Reference answer or key points a good submission should cover — used by the local NLP auto-evaluator…"
                />
              </div>
              <div>
                <label className="label">Key Concepts (comma-separated, optional)</label>
                <input
                  className="field"
                  value={editForm.keywords}
                  onChange={(e) => setEditForm({ ...editForm, keywords: e.target.value })}
                  placeholder="e.g. bubble sort, complexity, stability"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Max Marks</label>
                  <input
                    type="number"
                    className="field"
                    value={editForm.maxMarks}
                    onChange={(e) => setEditForm({ ...editForm, maxMarks: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label">Due Date</label>
                  <input
                    type="date"
                    className="field"
                    value={editForm.dueDate}
                    onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                  />
                </div>
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setEditTask(null)} disabled={savingEdit}>
                Cancel
              </button>
              <button className="btn-accent" onClick={saveEdit} disabled={savingEdit}>
                {savingEdit ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
