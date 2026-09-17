"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { api } from "@/lib/client";

export default function AcademicsPage() {
  const [data, setData] = useState<{
    departments: { id: string; code: string; name: string; hod_name: string }[];
    classes: { id: string; name: string; year: string; semester: number; academic_year: string; student_count: number; department_name: string }[];
    subjects: { id: string; code: string; name: string; credits: number; type: string; class_name: string; faculty_name: string }[];
    faculty: { id: string; name: string }[];
  } | null>(null);
  const [dept, setDept] = useState({ code: "", name: "" });
  const [cls, setCls] = useState({ name: "", year: "SE", division: "A", semester: 3, academicYear: "2025-26", departmentId: "" });
  const [sub, setSub] = useState({ code: "", name: "", credits: 4, type: "THEORY", departmentId: "", classId: "", facultyId: "" });
  const [msg, setMsg] = useState("");

  async function load() {
    const c = await api<NonNullable<typeof data>>("/api/catalog");
    setData(c);
    if (c.departments[0]) {
      setCls((s) => ({ ...s, departmentId: s.departmentId || c.departments[0].id }));
      setSub((s) => ({ ...s, departmentId: s.departmentId || c.departments[0].id }));
    }
    if (c.classes[0]) setSub((s) => ({ ...s, classId: s.classId || c.classes[0].id }));
    if (c.faculty[0]) setSub((s) => ({ ...s, facultyId: s.facultyId || c.faculty[0].id }));
  }
  useEffect(() => {
    load().catch(() => {});
  }, []);

  return (
    <div>
      <PageHeader kicker="Structure" title="Classes & subjects" />
      {msg ? <p className="mb-3 text-sm text-brand-700">{msg}</p> : null}

      <section className="mb-6 glass p-5">
        <h2 className="font-display text-xl">New department / branch</h2>
        <p className="mt-1 text-sm text-ink-600">College admins add branches for their own campus only.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <input className="field" placeholder="Code e.g. CE" value={dept.code} onChange={(e) => setDept({ ...dept, code: e.target.value })} />
          <input className="field" placeholder="Name e.g. Computer Engineering" value={dept.name} onChange={(e) => setDept({ ...dept, name: e.target.value })} />
          <button
            className="btn-accent"
            onClick={async () => {
              await api("/api/departments", { method: "POST", body: JSON.stringify(dept) });
              setMsg("Department created.");
              setDept({ code: "", name: "" });
              load();
            }}
          >
            Create department
          </button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="glass p-5">
          <h2 className="font-display text-xl">New class</h2>
          <div className="mt-3 grid gap-2">
            <input className="field" placeholder="Name e.g. SE-IT-B" value={cls.name} onChange={(e) => setCls({ ...cls, name: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <select className="field" value={cls.year} onChange={(e) => setCls({ ...cls, year: e.target.value })}>
                {["FE", "SE", "TE", "BE"].map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
              <select className="field" value={cls.division} onChange={(e) => setCls({ ...cls, division: e.target.value })}>
                {["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              <input className="field" type="number" value={cls.semester} onChange={(e) => setCls({ ...cls, semester: Number(e.target.value) })} />
            </div>
            <select className="field" value={cls.departmentId} onChange={(e) => setCls({ ...cls, departmentId: e.target.value })}>
              {(data?.departments || []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <button
              className="btn-accent"
              onClick={async () => {
                await api("/api/classes", { method: "POST", body: JSON.stringify(cls) });
                setMsg("Class created.");
                load();
              }}
            >
              Create class
            </button>
          </div>
          <div className="mt-4 table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Sem</th>
                  <th>Students</th>
                </tr>
              </thead>
              <tbody>
                {(data?.classes || []).map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.semester}</td>
                    <td>{c.student_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="glass p-5">
          <h2 className="font-display text-xl">New subject</h2>
          <div className="mt-3 grid gap-2">
            <input className="field" placeholder="Code" value={sub.code} onChange={(e) => setSub({ ...sub, code: e.target.value })} />
            <input className="field" placeholder="Name" value={sub.name} onChange={(e) => setSub({ ...sub, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="field" type="number" value={sub.credits} onChange={(e) => setSub({ ...sub, credits: Number(e.target.value) })} />
              <select className="field" value={sub.type} onChange={(e) => setSub({ ...sub, type: e.target.value })}>
                <option>THEORY</option>
                <option>LAB</option>
                <option>PROJECT</option>
              </select>
            </div>
            <select className="field" value={sub.classId} onChange={(e) => setSub({ ...sub, classId: e.target.value })}>
              {(data?.classes || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select className="field" value={sub.facultyId} onChange={(e) => setSub({ ...sub, facultyId: e.target.value })}>
              {(data?.faculty || []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <button
              className="btn-accent"
              onClick={async () => {
                await api("/api/subjects", { method: "POST", body: JSON.stringify(sub) });
                setMsg("Subject created.");
                load();
              }}
            >
              Create subject
            </button>
          </div>
          <div className="mt-4 table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Subject</th>
                  <th>Faculty</th>
                </tr>
              </thead>
              <tbody>
                {(data?.subjects || []).map((s) => (
                  <tr key={s.id}>
                    <td>{s.code}</td>
                    <td>{s.name}</td>
                    <td>{s.faculty_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
