"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { api } from "@/lib/client";
import type { SessionUser } from "@/lib/auth";

type Note = {
  id: string;
  date: string;
  category: string;
  note: string;
  follow_up: string;
  student_name: string;
  faculty_name: string;
  class_name: string;
  roll_no: string;
};

type RiskStudent = {
  studentId: string;
  name: string;
  rollNo: string;
  className: string;
  level: string;
  reasons: string[];
  suggestion: { category: string; note: string; followUp: string } | null;
};

export default function MentoringPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [students, setStudents] = useState<RiskStudent[]>([]);
  const [form, setForm] = useState({
    studentId: "",
    date: new Date().toISOString().slice(0, 10),
    category: "ACADEMIC",
    note: "",
    followUp: ""
  });
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      setNotes(await api<Note[]>("/api/mentoring"));
    } catch {
      setNotes([]);
    }
  }

  useEffect(() => {
    api<{ user: SessionUser }>("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => {});
    load();
    api<{ students: RiskStudent[] }>("/api/risk")
      .then((r) => {
        const list = r.students || [];
        setStudents(list);
        if (list[0]) setForm((f) => ({ ...f, studentId: f.studentId || list[0].studentId }));
      })
      .catch(() => {
        api<{ students: { id: string; name: string; roll_no: string; class_name: string }[] }>("/api/catalog")
          .then((c) => {
            const list = (c.students || []).map((s) => ({
              studentId: s.id,
              name: s.name,
              rollNo: s.roll_no,
              className: s.class_name,
              level: "LOW",
              reasons: [] as string[],
              suggestion: null
            }));
            setStudents(list);
            if (list[0]) setForm((f) => ({ ...f, studentId: list[0].studentId }));
          })
          .catch(() => setStudents([]));
      });
  }, []);

  const selected = students.find((s) => s.studentId === form.studentId);

  async function save() {
    await api("/api/mentoring", { method: "POST", body: JSON.stringify(form) });
    setMsg("Note recorded.");
    setForm({ ...form, note: "", followUp: "" });
    load();
  }

  return (
    <div>
      <PageHeader
        kicker="Proctoring"
        title="Mentoring diary"
        hint="ML suggests a counselling note for at-risk students. You can apply it, then save."
      />

      {user?.role !== "STUDENT" ? (
        <div className="mb-6 grid gap-3 glass p-4 md:grid-cols-2">
          <select
            className="field"
            value={form.studentId}
            onChange={(e) => setForm({ ...form, studentId: e.target.value })}
          >
            {students.map((s) => (
              <option key={s.studentId} value={s.studentId}>
                {s.level} · {s.className} · {s.rollNo} {s.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input className="field" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <select className="field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {["ACADEMIC", "PERSONAL", "CAREER", "DISCIPLINE"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          {selected?.suggestion ? (
            <div className="rounded-xl border border-warning/40 bg-warning/[0.08] p-3 text-sm md:col-span-2">
              <p className="font-semibold text-warning">
                ML suggestion · {selected.level} · {selected.reasons.join(" · ")}
              </p>
              <p className="mt-1 text-ink-700">{selected.suggestion.note}</p>
              <button
                type="button"
                className="btn-ghost mt-2 text-xs"
                onClick={() =>
                  setForm({
                    ...form,
                    category: selected.suggestion!.category,
                    note: selected.suggestion!.note,
                    followUp: selected.suggestion!.followUp
                  })
                }
              >
                Apply suggestion
              </button>
            </div>
          ) : selected ? (
            <p className="text-sm text-ink-500 md:col-span-2">No mentoring suggestion — risk is LOW.</p>
          ) : null}
          <textarea
            className="field md:col-span-2"
            rows={3}
            placeholder="Counselling note"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
          <input className="field" placeholder="Follow-up" value={form.followUp} onChange={(e) => setForm({ ...form, followUp: e.target.value })} />
          <button className="btn-accent" onClick={save}>
            Save note
          </button>
          {msg ? <p className="text-sm text-brand-700 md:col-span-2">{msg}</p> : null}
        </div>
      ) : null}

      <div className="space-y-3">
        {notes.map((n) => (
          <article key={n.id} className="glass p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                {n.student_name}{" "}
                <span className="text-xs font-normal text-ink-500">
                  ({n.class_name} · {n.roll_no})
                </span>
              </p>
              <span className="badge badge-neutral">{n.category}</span>
            </div>
            <p className="mt-2 text-sm text-ink-700">{n.note}</p>
            <p className="mt-3 text-xs text-ink-500">
              {n.date} · Mentor {n.faculty_name}
              {n.follow_up ? ` · Follow-up: ${n.follow_up}` : ""}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
