"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { api } from "@/lib/client";

type College = {
  id: string;
  code: string;
  name: string;
  admin_count: number;
  student_count: number;
  faculty_count: number;
  dept_count: number;
};
type Admin = { id: string; email: string; name: string; college_id: string; active: number };

export default function CollegesPage() {
  const [colleges, setColleges] = useState<College[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [form, setForm] = useState({
    name: "",
    code: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "Admin@123"
  });
  const [extra, setExtra] = useState({ collegeId: "", adminName: "", adminEmail: "", adminPassword: "Admin@123" });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const d = await api<{ colleges: College[]; admins: Admin[] }>("/api/colleges");
    setColleges(d.colleges || []);
    setAdmins(d.admins || []);
    if (d.colleges?.[0] && !extra.collegeId) setExtra((s) => ({ ...s, collegeId: d.colleges[0].id }));
  }
  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader
        kicker="Main administrator"
        title="Colleges & college admins"
        hint="Add a college and its admin. That person signs in and manages only that college’s students, faculty and records. You stay here and manage the admins."
      />
      {msg ? <p className="mb-3 text-sm text-brand-700">{msg}</p> : null}
      {error ? <p className="mb-3 text-sm text-rose-700">{error}</p> : null}

      <div className="mb-6 rounded-2xl border border-ink-100 bg-white p-4">
        <h2 className="font-display text-xl">New college</h2>
        <p className="mt-1 text-sm text-ink-600">Creates the campus and its first college admin in one step.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input
            className="field"
            placeholder="College name e.g. XYZ Institute"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="field"
            placeholder="Code e.g. XYZ"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
          <input
            className="field"
            placeholder="College admin name"
            value={form.adminName}
            onChange={(e) => setForm({ ...form, adminName: e.target.value })}
          />
          <input
            className="field"
            placeholder="Admin email"
            value={form.adminEmail}
            onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
          />
          <input
            className="field"
            placeholder="Admin password"
            value={form.adminPassword}
            onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
          />
          <button
            className="btn-accent"
            onClick={async () => {
              setError("");
              try {
                await api("/api/colleges", { method: "POST", body: JSON.stringify(form) });
                setMsg("College and admin created. They can sign in with that email / password.");
                setForm({ ...form, name: "", code: "", adminName: "", adminEmail: "" });
                await load();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Failed");
              }
            }}
          >
            Add college + admin
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-ink-100 bg-white p-4">
        <h2 className="font-display text-xl">Add another admin to an existing college</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <select className="field" value={extra.collegeId} onChange={(e) => setExtra({ ...extra, collegeId: e.target.value })}>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
          <input
            className="field"
            placeholder="Admin name"
            value={extra.adminName}
            onChange={(e) => setExtra({ ...extra, adminName: e.target.value })}
          />
          <input
            className="field"
            placeholder="Admin email"
            value={extra.adminEmail}
            onChange={(e) => setExtra({ ...extra, adminEmail: e.target.value })}
          />
          <input
            className="field"
            placeholder="Password"
            value={extra.adminPassword}
            onChange={(e) => setExtra({ ...extra, adminPassword: e.target.value })}
          />
        </div>
        <button
          className="btn-primary mt-3"
          onClick={async () => {
            setError("");
            try {
              await api("/api/colleges", { method: "POST", body: JSON.stringify(extra) });
              setMsg("College admin added. They can sign in now.");
              setExtra({ ...extra, adminName: "", adminEmail: "" });
              await load();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed");
            }
          }}
        >
          Add college admin
        </button>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Code</th>
              <th>College</th>
              <th>Depts</th>
              <th>Faculty</th>
              <th>Students</th>
              <th>College admins</th>
            </tr>
          </thead>
          <tbody>
            {colleges.map((c) => (
              <tr key={c.id}>
                <td>{c.code}</td>
                <td>{c.name}</td>
                <td>{c.dept_count}</td>
                <td>{c.faculty_count}</td>
                <td>{c.student_count}</td>
                <td className="text-sm">
                  <ul className="space-y-1">
                    {admins
                      .filter((a) => a.college_id === c.id)
                      .map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center gap-2">
                          <span>
                            {a.name} ({a.email})
                            {a.active ? "" : " · inactive"}
                          </span>
                          <button
                            className="btn-ghost px-2 py-1 text-xs"
                            onClick={async () => {
                              const password = window.prompt("New password for " + a.email, "Admin@123");
                              if (!password) return;
                              await api("/api/colleges", {
                                method: "PATCH",
                                body: JSON.stringify({ adminId: a.id, password })
                              });
                              setMsg("Password updated for " + a.email);
                            }}
                          >
                            Reset password
                          </button>
                        </li>
                      ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
