"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { api } from "@/lib/client";

type Fac = {
  id: string;
  name: string;
  email: string;
  employee_id: string;
  designation: string;
  department_name: string;
  is_hod: number;
  phone: string;
};

export default function FacultyPage() {
  const [rows, setRows] = useState<Fac[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    employeeId: "",
    designation: "Assistant Professor",
    departmentId: "",
    role: "FACULTY",
    password: "Faculty@123"
  });
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const c = await api<{ faculty: Fac[]; departments: { id: string; name: string }[] }>("/api/catalog");
      setRows(c.faculty || []);
      setDepartments(c.departments || []);
      if (c.departments?.[0] && !form.departmentId) setForm((f) => ({ ...f, departmentId: c.departments[0].id }));
    } catch {
      setRows([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    await api("/api/faculty", { method: "POST", body: JSON.stringify(form) });
    setMsg("Faculty added.");
    load();
  }

  return (
    <div>
      <PageHeader kicker="Staff" title="Faculty" />
      <div className="mb-6 grid gap-3 glass p-4 md:grid-cols-4">
        <input className="field" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="field" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="field" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input className="field" placeholder="Employee ID" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
        <input className="field" placeholder="Designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
        <select className="field" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option>FACULTY</option>
          <option>HOD</option>
        </select>
        <button className="btn-accent" onClick={save}>
          Add faculty
        </button>
        {msg ? <p className="self-center text-sm text-brand-700">{msg}</p> : null}
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Emp ID</th>
              <th>Name</th>
              <th>Designation</th>
              <th>Department</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.employee_id}</td>
                <td>
                  {r.name} {r.is_hod ? <span className="badge bg-gold-400/30 text-ink-900">HOD</span> : null}
                </td>
                <td>{r.designation}</td>
                <td>{r.department_name}</td>
                <td>{r.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
