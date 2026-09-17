"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { api } from "@/lib/client";
import type { Allotment } from "@/lib/queries";

type Student = {
  id: string;
  name: string;
  roll_no: string;
  gr_no: string;
  phone: string;
  branch_code: string;
  division: string;
  batch: string;
  parent_email: string;
};

type Risk = { studentId: string; level: string; score: number; reasons: string[] };

function cell(v: string | null | undefined) {
  if (v == null || String(v).trim() === "") return <span className="text-ink-400">null</span>;
  return v;
}

export default function FacultyDeskPage() {
  const [allotments, setAllotments] = useState<Allotment[]>([]);
  const [selected, setSelected] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [allotment, setAllotment] = useState<Allotment | null>(null);
  const [form, setForm] = useState({
    title: "",
    type: "ASSIGNMENT",
    maxMarks: 20,
    date: new Date().toISOString().slice(0, 10)
  });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [riskMap, setRiskMap] = useState<Record<string, Risk>>({});
  const [modelAcc, setModelAcc] = useState<number | null>(null);

  useEffect(() => {
    api<Allotment[]>("/api/allotments")
      .then((rows) => {
        setAllotments(Array.isArray(rows) ? rows : []);
        if (Array.isArray(rows) && rows[0]) setSelected(rows[0].id);
      })
      .catch(() => setAllotments([]));
    api<{ model: { accuracy: number }; students: Risk[] }>("/api/risk")
      .then((r) => {
        setModelAcc(r.model?.accuracy ?? null);
        const map: Record<string, Risk> = {};
        (r.students || []).forEach((s) => {
          map[s.studentId] = s;
        });
        setRiskMap(map);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (!selected) return;
    api<{ allotment: Allotment; students: Student[] }>(`/api/allotments?id=${selected}`)
      .then((r) => {
        setAllotment(r.allotment);
        setStudents(r.students || []);
        setMsg("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load students"));
  }, [selected]);

  async function createSession() {
    if (!allotment) return;
    const title = form.title.trim() || `${form.type} — ${allotment.subject_name}`;
    await api("/api/marks", {
      method: "POST",
      body: JSON.stringify({
        action: "create",
        subjectId: allotment.subject_id,
        title,
        type: form.type,
        maxMarks: form.maxMarks,
        date: form.date,
        batch: allotment.kind === "LAB" ? allotment.batch : null
      })
    });
    await api("/api/attendance", {
      method: "POST",
      body: JSON.stringify({
        subjectId: allotment.subject_id,
        date: form.date,
        topic: title,
        batch: allotment.kind === "LAB" ? allotment.batch : null,
        records: students.map((s) => ({ studentId: s.id, status: "PRESENT" }))
      })
    });
    setMsg(
      `Saved “${title}” for ${form.date}. Attendance and session data are stored. Open Saved sessions to view by date or name.`
    );
  }

  const theory = allotments.filter((a) => a.kind === "THEORY");
  const labs = allotments.filter((a) => a.kind === "LAB");

  return (
    <div>
      <PageHeader
        kicker="Faculty desk"
        title="Allotted classes"
        hint="Pick a theory division or lab batch. The ML model flags students at risk of defaulter / weak internals so you can mentor them."
      />
      {error && !/request failed/i.test(error) ? <p className="mb-4 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-ink-100 bg-white p-5">
          <h2 className="font-display text-xl">Theory lectures — branch & division</h2>
          <div className="mt-3 space-y-2">
            {theory.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelected(a.id)}
                className={`w-full rounded-xl border px-3 py-3 text-left text-sm ${selected === a.id ? "border-brand-500 bg-brand-50" : "border-ink-100 hover:border-brand-300"}`}
              >
                <p className="font-semibold">
                  {a.branch_code} · Div {a.division}
                </p>
                <p className="text-xs text-ink-500">
                  {a.subject_code} {a.subject_name} · {a.class_name}
                </p>
              </button>
            ))}
            {theory.length === 0 ? <p className="text-sm text-ink-500">No theory allotment.</p> : null}
          </div>
        </section>
        <section className="rounded-2xl border border-ink-100 bg-white p-5">
          <h2 className="font-display text-xl">Laboratory — batch</h2>
          <div className="mt-3 space-y-2">
            {labs.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelected(a.id)}
                className={`w-full rounded-xl border px-3 py-3 text-left text-sm ${selected === a.id ? "border-brand-500 bg-brand-50" : "border-ink-100 hover:border-brand-300"}`}
              >
                <p className="font-semibold">
                  {a.branch_code} · Div {a.division} · Batch {a.batch}
                </p>
                <p className="text-xs text-ink-500">
                  {a.subject_code} {a.subject_name}
                </p>
              </button>
            ))}
            {labs.length === 0 ? <p className="text-sm text-ink-500">No lab allotment.</p> : null}
          </div>
        </section>
      </div>

      {allotment ? (
        <section className="mt-6 rounded-2xl border border-ink-100 bg-white p-5">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wide text-brand-700">Selected allotment</p>
            <h3 className="font-display text-2xl">
              {allotment.branch_name} · Div {allotment.division}
              {allotment.batch ? ` · ${allotment.batch}` : ""}
            </h3>
            <p className="text-sm text-ink-600">
              {allotment.kind} · {allotment.subject_code} {allotment.subject_name} · {students.length} students
              {modelAcc != null ? ` · ML test accuracy ${modelAcc}%` : ""}
            </p>
          </div>
          <div className="mb-4 grid gap-2 md:grid-cols-5">
            <input className="field" placeholder="Session title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <select className="field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {["ASSIGNMENT", "UT1", "UT2", "LAB", "TERMWORK"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input className="field" type="number" value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: Number(e.target.value) })} />
            <input className="field" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <button className="btn-accent" onClick={createSession}>
              Create session
            </button>
          </div>
          {msg ? <p className="mb-3 text-sm text-brand-700">{msg}</p> : null}

          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Roll</th>
                  <th>Name</th>
                  <th>Risk</th>
                  <th>Why</th>
                  <th>GR no</th>
                  <th>Mobile</th>
                  <th>Branch</th>
                  <th>Div</th>
                  <th>Batch</th>
                  <th>Parent email</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const rk = riskMap[s.id];
                  const lvl = rk?.level || "LOW";
                  const badge =
                    lvl === "HIGH"
                      ? "bg-rose-100 text-rose-800"
                      : lvl === "MEDIUM"
                        ? "bg-amber-100 text-amber-900"
                        : "bg-brand-100 text-brand-800";
                  return (
                    <tr key={s.id}>
                      <td>{s.roll_no}</td>
                      <td>{s.name}</td>
                      <td>
                        <span className={`badge ${badge}`}>{lvl}</span>
                      </td>
                      <td className="max-w-[220px] text-xs text-ink-600">{rk?.reasons?.join(" · ") || "—"}</td>
                      <td>{cell(s.gr_no)}</td>
                      <td>{cell(s.phone)}</td>
                      <td>{s.branch_code}</td>
                      <td>{s.division}</td>
                      <td>{cell(s.batch)}</td>
                      <td>{cell(s.parent_email)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
