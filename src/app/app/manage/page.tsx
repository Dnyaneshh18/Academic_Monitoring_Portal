"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { api } from "@/lib/client";

const COLS: Record<string, { key: string; label: string }[]> = {
  students: [
    { key: "branch", label: "Branch" },
    { key: "div", label: "Div" },
    { key: "batch", label: "Batch" },
    { key: "roll_no", label: "Roll" },
    { key: "gr_no", label: "GR no" },
    { key: "name", label: "Name" },
    { key: "mobile", label: "Mobile" },
    { key: "parent", label: "Parent" },
    { key: "parent_mobile", label: "Parent mobile" },
    { key: "parent_email", label: "Parent email" }
  ],
  faculty: [
    { key: "employee_id", label: "Emp ID" },
    { key: "name", label: "Name" },
    { key: "designation", label: "Designation" },
    { key: "branch_code", label: "Branch" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" }
  ],
  classes: [
    { key: "branch_code", label: "Branch" },
    { key: "name", label: "Class" },
    { key: "division", label: "Div" },
    { key: "year", label: "Year" },
    { key: "student_count", label: "Students" }
  ],
  subjects: [
    { key: "branch_code", label: "Branch" },
    { key: "code", label: "Code" },
    { key: "name", label: "Subject" },
    { key: "type", label: "Type" },
    { key: "class_name", label: "Class" }
  ],
  allotments: [
    { key: "faculty_name", label: "Faculty" },
    { key: "branch_code", label: "Branch" },
    { key: "division", label: "Div" },
    { key: "kind", label: "Type" },
    { key: "batch", label: "Batch" },
    { key: "subject_code", label: "Code" },
    { key: "subject_name", label: "Subject" }
  ],
  homework: [
    { key: "title", label: "Title" },
    { key: "faculty_name", label: "Faculty" },
    { key: "class_name", label: "Class" },
    { key: "batch", label: "Batch" },
    { key: "due_date", label: "Due" },
    { key: "max_marks", label: "Marks" }
  ],
  assessments: [
    { key: "title", label: "Title" },
    { key: "type", label: "Type" },
    { key: "subject_code", label: "Subject" },
    { key: "faculty_name", label: "Faculty" },
    { key: "date", label: "Date" },
    { key: "max_marks", label: "Marks" }
  ],
  sessions: [
    { key: "date", label: "Date" },
    { key: "topic", label: "Topic" },
    { key: "subject_code", label: "Subject" },
    { key: "faculty_name", label: "Faculty" },
    { key: "batch", label: "Batch" }
  ],
  notices: [
    { key: "title", label: "Title" },
    { key: "audience", label: "Audience" },
    { key: "pinned", label: "Pinned" },
    { key: "created_at", label: "Created" }
  ]
};

const TABS = [
  { id: "students", label: "Students" },
  { id: "faculty", label: "Faculty" },
  { id: "classes", label: "Classes" },
  { id: "subjects", label: "Subjects" },
  { id: "allotments", label: "Allotments" },
  { id: "homework", label: "Assignments" },
  { id: "assessments", label: "Assessments" },
  { id: "sessions", label: "Attendance sessions" },
  { id: "notices", label: "Notices" }
];

type Row = Record<string, string | number | null>;

export default function ManagePage() {
  const [tab, setTab] = useState("students");
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [edit, setEdit] = useState<Row | null>(null);

  async function load(t = tab) {
    const d = await api<{ rows: Row[] }>(`/api/admin?tab=${t}`);
    setRows(d.rows || []);
  }

  useEffect(() => {
    load(tab).catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [tab]);

  async function remove(id: string) {
    if (!confirm("Delete this record and related data? This cannot be undone.")) return;
    setError("");
    setMsg("");
    try {
      await api(`/api/admin?tab=${tab}&id=${id}`, { method: "DELETE" });
      setMsg("Deleted.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function saveEdit() {
    if (!edit?.id) return;
    setError("");
    await api("/api/admin", {
      method: "PATCH",
      body: JSON.stringify({
        tab,
        id: edit.id,
        name: edit.name,
        email: edit.email,
        phone: edit.mobile ?? edit.phone,
        roll_no: edit.roll_no,
        prn: edit.prn,
        batch: edit.batch,
        parent_email: edit.parent_email,
        guardian_name: edit.parent ?? edit.guardian_name,
        parent_mobile: edit.parent_mobile,
        title: edit.title,
        designation: edit.designation,
        due_date: edit.due_date,
        max_marks: edit.max_marks
      })
    });
    setMsg("Saved.");
    setEdit(null);
    await load();
  }

  const cols = COLS[tab] || [];

  return (
    <div>
      <PageHeader
        kicker="Admin"
        title="Manage data"
        hint="Add records from Students / Faculty / Classes pages. Here you can edit or permanently delete anything."
      />
      {msg ? <p className="mb-3 text-sm text-brand-700">{msg}</p> : null}
      {error ? <p className="mb-3 text-sm text-rose-700">{error}</p> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "btn-accent text-sm" : "btn-ghost text-sm"}
            onClick={() => {
              setTab(t.id);
              setEdit(null);
              setMsg("");
              setError("");
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {edit ? (
        <div className="mb-4 grid gap-2 rounded-2xl border border-brand-200 bg-white p-4 md:grid-cols-4">
          <p className="md:col-span-4 text-sm font-semibold">Edit record</p>
          {["name", "email", "phone", "prn", "roll_no", "batch", "parent_email", "guardian_name", "title", "designation", "due_date", "max_marks"].map(
            (k) =>
              edit[k] !== undefined ? (
                <input
                  key={k}
                  className="field"
                  value={String(edit[k] ?? "")}
                  placeholder={k}
                  onChange={(e) => setEdit({ ...edit, [k]: e.target.value })}
                />
              ) : null
          )}
          <button className="btn-accent" onClick={saveEdit}>
            Save changes
          </button>
          <button className="btn-ghost" onClick={() => setEdit(null)}>
            Cancel
          </button>
        </div>
      ) : null}

      <p className="mb-2 text-sm font-semibold text-ink-800">
        Showing: {TABS.find((t) => t.id === tab)?.label} · {rows.length} row(s)
      </p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                {cols.map((c) => (
                  <td key={c.key}>{r[c.key] == null || r[c.key] === "" ? "null" : String(r[c.key])}</td>
                ))}
                <td className="whitespace-nowrap">
                  {["students", "faculty", "notices", "homework"].includes(tab) ? (
                    <button className="btn-ghost text-xs mr-1" onClick={() => setEdit(r)}>
                      Edit
                    </button>
                  ) : null}
                  <button className="btn-ghost text-xs text-rose-700" onClick={() => remove(String(r.id))}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-500">{rows.length} row(s). Add new students/faculty from those menu pages.</p>
    </div>
  );
}
