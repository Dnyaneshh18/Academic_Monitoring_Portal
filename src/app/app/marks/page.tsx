"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { SearchSelect } from "@/components/SearchSelect";
import { api } from "@/lib/client";
import type { SessionUser } from "@/lib/auth";
import type { Allotment } from "@/lib/queries";

type Assessment = {
  id: string;
  title: string;
  type: string;
  max_marks: number;
  date: string | null;
  batch: string | null;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  class_name: string;
  division: string;
  branch_code: string;
};
type Student = { id: string; name: string; roll_no: string; batch?: string };
type MarkRow = { obtained: number; remark: string; title: string; type: string; max_marks: number; subject: string; code: string };

function labelAssessment(a: Assessment) {
  const when = a.date || "no date";
  const batch = a.batch ? ` · ${a.batch}` : " · whole division";
  return `${when} · ${a.title} · ${a.branch_code || ""} Div ${a.division || ""}${batch} · ${a.max_marks} marks`;
}

export default function MarksPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentId, setAssessmentId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [values, setValues] = useState<Record<string, { obtained: string; remark: string }>>({});
  const [mine, setMine] = useState<MarkRow[]>([]);
  const [allotments, setAllotments] = useState<Allotment[]>([]);
  const [branch, setBranch] = useState("");
  const [division, setDivision] = useState("");
  const [kind, setKind] = useState<"THEORY" | "LAB">("THEORY");
  const [batch, setBatch] = useState("");
  const [form, setForm] = useState({
    subjectId: "",
    title: "",
    type: "ASSIGNMENT",
    maxMarks: 20,
    date: new Date().toISOString().slice(0, 10)
  });
  const [findQ, setFindQ] = useState("");
  const [findDate, setFindDate] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedAllotment = useMemo(
    () =>
      allotments.find(
        (a) =>
          a.branch_code === branch &&
          a.division === division &&
          a.kind === kind &&
          (kind === "LAB" ? a.batch === batch : a.kind === "THEORY")
      ) || allotments.find((a) => a.branch_code === branch && a.division === division),
    [allotments, branch, division, kind, batch]
  );

  useEffect(() => {
    if (selectedAllotment) setForm((f) => ({ ...f, subjectId: selectedAllotment.subject_id }));
  }, [selectedAllotment]);

  async function loadAssessments(selectId?: string) {
    const params = new URLSearchParams();
    if (findQ.trim()) params.set("q", findQ.trim());
    if (findDate) params.set("date", findDate);
    if (branch) params.set("branch", branch);
    const r = await api<{ assessments: Assessment[] }>(`/api/marks?${params.toString()}`);
    const list = r.assessments || [];
    setAssessments(list);
    if (selectId && list.some((a) => a.id === selectId)) setAssessmentId(selectId);
    else if (!list.some((a) => a.id === assessmentId)) setAssessmentId(list[0]?.id || "");
    return list;
  }

  useEffect(() => {
    api<{ user: SessionUser }>("/api/auth/me").then(async (d) => {
      setUser(d.user);
      if (d.user.role === "STUDENT") {
        const r = await api<{ marks: MarkRow[] }>("/api/marks");
        setMine(r.marks);
        return;
      }
      const al = await api<Allotment[]>("/api/allotments");
      const list = Array.isArray(al) ? al : [];
      setAllotments(list);
      if (list[0]) {
        setBranch(list[0].branch_code);
        setDivision(list[0].division);
        setKind(list[0].kind === "LAB" ? "LAB" : "THEORY");
        setBatch(list[0].batch || "");
        setForm((f) => ({ ...f, subjectId: list[0].subject_id }));
      }
      const r = await api<{ assessments: Assessment[] }>("/api/marks");
      setAssessments(r.assessments || []);
      if (r.assessments?.[0]) setAssessmentId(r.assessments[0].id);
    });
  }, []);

  useEffect(() => {
    if (!assessmentId || user?.role === "STUDENT") return;
    api<{ students: Student[]; map: Record<string, { obtained: number; remark: string }>; assessment: Assessment }>(
      `/api/marks?assessmentId=${assessmentId}`
    ).then((r) => {
      setStudents(r.students || []);
      const next: Record<string, { obtained: string; remark: string }> = {};
      (r.students || []).forEach((s) => {
        const m = r.map?.[s.id];
        next[s.id] = { obtained: m ? String(m.obtained) : "", remark: m?.remark || "" };
      });
      setValues(next);
    });
  }, [assessmentId, user]);

  const branches = useMemo(() => {
    const map = new Map<string, string>();
    allotments.forEach((a) => map.set(a.branch_code, a.branch_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, label: `${id} — ${name}` }));
  }, [allotments]);
  const divisions = useMemo(
    () => Array.from(new Set(allotments.filter((a) => a.branch_code === branch).map((a) => a.division))).sort(),
    [allotments, branch]
  );
  const kinds = useMemo(
    () =>
      Array.from(
        new Set(allotments.filter((a) => a.branch_code === branch && a.division === division).map((a) => a.kind))
      ),
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

  const current = assessments.find((a) => a.id === assessmentId);

  async function save() {
    if (!assessmentId) {
      setError("Open or create an assessment first, then save marks.");
      return;
    }
    setError("");
    setSaveMsg("");
    setSaving(true);
    try {
      const entries = Object.entries(values).map(([studentId, v]) => ({
        studentId,
        obtained: v.obtained === "" ? 0 : Number(v.obtained),
        remark: v.remark
      }));
      await api("/api/marks", {
        method: "POST",
        body: JSON.stringify({ assessmentId, entries })
      });
      setSaveMsg(`Marks saved for ${entries.length} student(s). You can reopen this test by title or date.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save marks");
    } finally {
      setSaving(false);
    }
  }

  async function create() {
    setError("");
    setMsg("");
    if (!selectedAllotment) {
      setError("Pick an allotted branch, division and batch first.");
      return;
    }
    if (!form.maxMarks || form.maxMarks <= 0) {
      setError("Enter total marks.");
      return;
    }
    try {
      const title =
        form.title.trim() ||
        `${form.type} — ${selectedAllotment.subject_name} (${selectedAllotment.branch_code} Div ${selectedAllotment.division}${
          kind === "LAB" && batch ? ` · ${batch}` : ""
        })`;
      const res = await api<{ id: string }>("/api/marks", {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          subjectId: selectedAllotment.subject_id,
          title,
          type: form.type,
          maxMarks: form.maxMarks,
          date: form.date,
          batch: kind === "LAB" ? batch || selectedAllotment.batch : null
        })
      });
      setMsg(`Saved “${title}”. Search by title or date to open it again.`);
      await loadAssessments(res.id);
      setAssessmentId(res.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create assessment");
    }
  }

  function pickBranch(code: string) {
    const next = allotments.find((a) => a.branch_code === code);
    setBranch(code);
    setDivision(next?.division || "");
    setKind(next?.kind === "LAB" ? "LAB" : "THEORY");
    setBatch(next?.batch || "");
  }

  if (user?.role === "STUDENT") {
    return (
      <div>
        <PageHeader kicker="Results" title="My assessments" />
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Exam</th>
                <th>Type</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((m, i) => (
                <tr key={i}>
                  <td>
                    {m.code} {m.subject}
                  </td>
                  <td>{m.title}</td>
                  <td>{m.type}</td>
                  <td>
                    {m.obtained} / {m.max_marks}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        kicker="CIE"
        title="Internal assessments"
        hint="Create for an allotted class (CE Div A · B1 etc.). Title + date are stored so you can open it later."
      />

      <div className="mb-6 rounded-2xl border border-ink-100 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">New assessment</p>
        <div className="grid gap-3 md:grid-cols-4">
          <SearchSelect label="Branch" value={branch} onChange={pickBranch} options={branches} placeholder="Search CE, IT…" />
          <div>
            <label className="label">Division</label>
            <select
              className="field"
              value={division}
              onChange={(e) => {
                const div = e.target.value;
                const next = allotments.find((a) => a.branch_code === branch && a.division === div);
                setDivision(div);
                setKind(next?.kind === "LAB" ? "LAB" : "THEORY");
                setBatch(next?.batch || "");
              }}
            >
              {divisions.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Type</label>
            <select className="field" value={kind} onChange={(e) => setKind(e.target.value as "THEORY" | "LAB")}>
              {kinds.includes("THEORY") ? <option value="THEORY">Theory (whole division)</option> : null}
              {kinds.includes("LAB") ? <option value="LAB">Laboratory / batch</option> : null}
            </select>
          </div>
          <div>
            <label className="label">Batch</label>
            <select
              className="field"
              value={kind === "LAB" ? batch : batch || "ALL"}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "ALL") {
                  setKind("THEORY");
                  setBatch("");
                } else {
                  setBatch(v);
                }
              }}
            >
              {kind === "THEORY" || kinds.includes("THEORY") ? <option value="ALL">All (whole division)</option> : null}
              {(batches.length ? batches : ["B1", "B2", "B3", "B4", "B5"]).map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Subject (from allotment)</label>
            <input
              className="field"
              disabled
              value={
                selectedAllotment
                  ? `${selectedAllotment.subject_code} · ${selectedAllotment.subject_name}`
                  : "No allotment for this selection"
              }
            />
          </div>
          <div>
            <label className="label">Assessment type</label>
            <select className="field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {["ASSIGNMENT", "UT1", "UT2", "TERMWORK", "PRACTICAL", "LAB"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Title (saved for later search)</label>
            <input
              className="field"
              placeholder="e.g. Assignment 2 — Sorting"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Total marks</label>
            <input
              className="field"
              type="number"
              min={1}
              value={form.maxMarks}
              onChange={(e) => setForm({ ...form, maxMarks: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label">Date</label>
            <input className="field" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="flex items-end">
            <button className="btn-accent w-full" onClick={create} disabled={!selectedAllotment}>
              Create & save assessment
            </button>
          </div>
        </div>
        {msg ? <p className="mt-3 text-sm text-brand-700">{msg}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      </div>

      <div className="mb-4 grid gap-3 rounded-2xl border border-ink-100 bg-white p-4 md:grid-cols-4">
        <div>
          <label className="label">Find by date</label>
          <input className="field" type="date" value={findDate} onChange={(e) => setFindDate(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Find by title / subject</label>
          <input
            className="field"
            placeholder="Type Assignment 2 or Data Structures…"
            value={findQ}
            onChange={(e) => setFindQ(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <button className="btn-ghost w-full" onClick={() => loadAssessments()}>
            Search saved
          </button>
        </div>
        <div className="md:col-span-4">
          <SearchSelect
            label="Open saved assessment"
            value={assessmentId}
            onChange={setAssessmentId}
            options={assessments.map((a) => ({
              id: a.id,
              label: labelAssessment(a),
              hint: `${a.subject_code} ${a.subject_name}`
            }))}
            placeholder="Search saved UT / assignment…"
          />
        </div>
      </div>

      {current ? (
        <p className="mb-2 text-sm text-ink-600">
          {current.subject_code} {current.subject_name} · {current.branch_code} Div {current.division}
          {current.batch ? ` · ${current.batch}` : " · whole division"} · out of {current.max_marks} · {students.length}{" "}
          students
        </p>
      ) : null}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Roll</th>
              <th>Student</th>
              <th>Obtained / {current?.max_marks ?? "total"}</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>{s.roll_no}</td>
                <td>{s.name}</td>
                <td>
                  <input
                    className="field max-w-[120px]"
                    type="number"
                    min={0}
                    max={current?.max_marks}
                    value={values[s.id]?.obtained || ""}
                    onChange={(e) =>
                      setValues({ ...values, [s.id]: { obtained: e.target.value, remark: values[s.id]?.remark || "" } })
                    }
                  />
                </td>
                <td>
                  <input
                    className="field"
                    value={values[s.id]?.remark || ""}
                    onChange={(e) =>
                      setValues({
                        ...values,
                        [s.id]: { obtained: values[s.id]?.obtained || "", remark: e.target.value }
                      })
                    }
                  />
                </td>
              </tr>
            ))}
            {students.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-ink-500">
                  Create an assessment or open a saved one.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {students.length ? (
        <div className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-brand-200 bg-white p-4 shadow-card">
          <div>
            <p className="font-semibold text-ink-900">After entering obtained marks, save them</p>
            <p className="text-sm text-ink-600">
              {current ? `${current.title} · out of ${current.max_marks}` : "No assessment open"}
            </p>
            {saveMsg ? <p className="mt-1 text-sm text-brand-700">{saveMsg}</p> : null}
            {error ? <p className="mt-1 text-sm text-rose-700">{error}</p> : null}
          </div>
          <button className="btn-accent ml-auto px-8 py-3 text-base" onClick={save} disabled={!assessmentId || saving}>
            {saving ? "Saving marks…" : "Save marks"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
