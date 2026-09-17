"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { SearchSelect } from "@/components/SearchSelect";
import { api } from "@/lib/client";
import { LAB_BATCHES } from "@/lib/batches";

type Faculty = { id: string; name: string; email: string; department_code: string };
type Dept = { id: string; code: string; name: string };
type ClassRow = { id: string; name: string; division: string; department_id: string; department_code: string };
type Subject = { id: string; code: string; name: string; type: string; class_id: string };
type Allotment = {
  id: string;
  faculty_name: string;
  faculty_email: string;
  branch_code: string;
  branch_name: string;
  division: string;
  kind: string;
  batch: string | null;
  subject_code: string;
  subject_name: string;
  class_name: string;
};

export default function AssignFacultyPage() {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rows, setRows] = useState<Allotment[]>([]);
  const [form, setForm] = useState({
    facultyId: "",
    departmentId: "",
    classId: "",
    kind: "THEORY",
    batch: "B1",
    subjectId: ""
  });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const c = await api<{
      faculty: Faculty[];
      departments: Dept[];
      classes: ClassRow[];
      subjects: Subject[];
    }>("/api/catalog");
    setFaculty(c.faculty);
    setDepartments(c.departments);
    setClasses(c.classes);
    setSubjects(c.subjects);
    setForm((f) => ({
      ...f,
      facultyId: f.facultyId || c.faculty[0]?.id || "",
      departmentId: f.departmentId || c.departments[0]?.id || ""
    }));
    setRows(await api<Allotment[]>("/api/allotments?all=1"));
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, []);

  const classOptions = useMemo(
    () => classes.filter((c) => !form.departmentId || c.department_id === form.departmentId),
    [classes, form.departmentId]
  );

  const subjectOptions = useMemo(
    () =>
      subjects.filter(
        (s) => s.class_id === form.classId && (form.kind === "LAB" ? s.type === "LAB" : s.type === "THEORY")
      ),
    [subjects, form.classId, form.kind]
  );

  useEffect(() => {
    if (!classOptions.find((c) => c.id === form.classId)) {
      setForm((f) => ({ ...f, classId: classOptions[0]?.id || "", subjectId: "" }));
    }
  }, [form.departmentId, classOptions, form.classId]);

  useEffect(() => {
    if (!subjectOptions.find((s) => s.id === form.subjectId)) {
      setForm((f) => ({ ...f, subjectId: subjectOptions[0]?.id || "" }));
    }
  }, [form.classId, form.kind, subjectOptions, form.subjectId]);

  async function assign() {
    setError("");
    setMsg("");
    try {
      await api("/api/allotments", {
        method: "POST",
        body: JSON.stringify({
          facultyId: form.facultyId,
          classId: form.classId,
          kind: form.kind,
          batch: form.kind === "LAB" ? form.batch : null,
          subjectId: form.subjectId
        })
      });
      setMsg("Faculty allotted. They will see this class on My desk after login.");
      setRows(await api<Allotment[]>("/api/allotments?all=1"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assign failed");
    }
  }

  async function remove(id: string) {
    setError("");
    await api(`/api/allotments?id=${id}`, { method: "DELETE" });
    setRows(await api<Allotment[]>("/api/allotments?all=1"));
    setMsg("Allotment removed.");
  }

  return (
    <div>
      <PageHeader
        kicker="Admin"
        title="Assign faculty"
        hint="Allot a faculty member to a branch + division for theory, or to a lab batch. Faculty login shows only these classes."
      />

      <div className="mb-6 grid gap-3 glass p-4 md:grid-cols-3">
        <div>
          <label className="label">Faculty</label>
          <select className="field" value={form.facultyId} onChange={(e) => setForm({ ...form, facultyId: e.target.value })}>
            {faculty.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.email})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Branch</label>
          <select
            className="field"
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Division</label>
          <select className="field" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
            {classOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (Div {c.division})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Type</label>
          <select className="field" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="THEORY">Theory lecture (whole division)</option>
            <option value="LAB">Laboratory (batch)</option>
          </select>
        </div>
        {form.kind === "LAB" ? (
          <div>
            <label className="label">Lab batch</label>
            <select className="field" value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })}>
              {LAB_BATCHES.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label className="label">Subject</label>
          <select className="field" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
            {subjectOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn-accent w-full" onClick={assign}>
            Assign to faculty
          </button>
        </div>
        {msg ? <p className="self-center text-sm text-brand-700 md:col-span-3">{msg}</p> : null}
        {error ? <p className="self-center text-sm text-danger md:col-span-3">{error}</p> : null}
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Faculty</th>
              <th>Branch</th>
              <th>Div</th>
              <th>Type</th>
              <th>Batch</th>
              <th>Subject</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.faculty_name}
                  <div className="text-xs text-ink-400">{r.faculty_email}</div>
                </td>
                <td>{r.branch_code}</td>
                <td>{r.division}</td>
                <td>{r.kind}</td>
                <td>{r.batch || "—"}</td>
                <td>
                  {r.subject_code} {r.subject_name}
                </td>
                <td>
                  <button className="btn-ghost text-xs" onClick={() => remove(r.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
