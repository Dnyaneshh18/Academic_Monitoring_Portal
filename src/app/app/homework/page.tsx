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
  submission_id?: string;
  file_name?: string;
  submitted_at?: string;
  verified?: number;
  obtained?: number;
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
  } | null;
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
    maxMarks: 20,
    dueDate: ""
  });
  const [openId, setOpenId] = useState("");
  const [detail, setDetail] = useState<{ task: Task; students: Row[] } | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [file, setFile] = useState<Record<string, File | null>>({});
  const [brief, setBrief] = useState<File | null>(null);

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
    fd.append("maxMarks", String(form.maxMarks));
    fd.append("dueDate", form.dueDate);
    if (brief) fd.append("brief", brief);
    try {
      await apiForm("/api/homework/create", fd);
      setMsg("Assignment published with title. Students can view/download the file.");
      setForm({ ...form, title: "", instructions: "" });
      setBrief(null);
      const hw = await api<{ tasks: Task[] }>("/api/homework");
      setTasks(hw.tasks || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish");
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
      await apiForm("/api/homework/submit", fd);
      setMsg("Submitted.");
      const hw = await api<{ tasks: Task[] }>("/api/homework");
      setTasks(hw.tasks || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
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
        {error && !/request failed/i.test(error) ? <p className="mb-3 text-sm text-rose-700">{error}</p> : null}
        <div className="space-y-3">
          {tasks.map((t) => (
            <article key={t.id} className="rounded-2xl border border-ink-100 bg-white p-4">
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
                <span className={`badge ${t.submission_id ? "bg-brand-100 text-brand-800" : "bg-amber-100 text-amber-900"}`}>
                  {t.submission_id ? (t.verified ? `Verified · ${t.obtained}/${t.max_marks}` : "Submitted") : "Not submitted"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  onChange={(e) => setFile({ ...file, [t.id]: e.target.files?.[0] || null })}
                />
                <button className="btn-accent" onClick={() => upload(t.id)}>
                  Upload
                </button>
                {t.submission_id ? <FileOpen href={fileUrl(t.submission_id)} label="View / download my file" /> : null}
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
      {error && !/request failed/i.test(error) ? <p className="mb-3 text-sm text-rose-700">{error}</p> : null}
      {allotments.length === 0 ? (
        <p className="mb-3 text-sm text-ink-500">No class is allotted to you yet. Ask your HOD / college admin to assign a subject.</p>
      ) : null}

      <div className="mb-6 grid gap-3 rounded-2xl border border-ink-100 bg-white p-4 md:grid-cols-4">
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
        <div className="flex items-end">
          <button className="btn-accent w-full" onClick={create} disabled={!selected || !form.title}>
            Publish assignment
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail ? (
        <section className="rounded-2xl border border-ink-100 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl">{detail.task.title}</h2>
            <button className="btn-accent ml-auto" onClick={verifyAll}>
              Verify all submitted (full marks)
            </button>
          </div>
          <p className="mb-3 text-sm text-ink-600">
            {detail.students.filter((s) => s.submission).length} submitted ·{" "}
            {detail.students.filter((s) => !s.submission).length} not submitted · max {detail.task.max_marks}
          </p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Roll</th>
                  <th>Student</th>
                  <th>Status</th>
                  <th>File</th>
                  <th>Marks</th>
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
                            className="field max-w-[80px]"
                            type="number"
                            defaultValue={s.submission.obtained ?? ""}
                            onBlur={(e) => {
                              const v = e.target.value;
                              if (v !== "") mark(s.id, Number(v));
                            }}
                          />
                          / {detail.task.max_marks}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
