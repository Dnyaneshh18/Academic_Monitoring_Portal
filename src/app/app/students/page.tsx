"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { api } from "@/lib/client";
import { LAB_BATCHES } from "@/lib/batches";
import type { SessionUser } from "@/lib/auth";
import type { RosterRow } from "@/lib/parseRoster";

type Student = {
  id: string;
  name: string;
  roll_no: string;
  gr_no: string;
  class_name: string;
  phone: string;
  guardian_name: string;
  guardian_phone: string;
  parent_email: string;
  batch: string;
  division: string;
  branch_code: string;
};

type ClassRow = { id: string; name: string; division: string; department_id: string; department_code: string };
type Dept = { id: string; code: string; name: string };

function cell(v: string | null | undefined) {
  if (v == null || String(v).trim() === "") return <span className="text-ink-400">null</span>;
  return v;
}

export default function StudentsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [branch, setBranch] = useState("ALL");
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [manual, setManual] = useState({
    name: "",
    email: "",
    phone: "",
    rollNo: "",
    grNo: "",
    prn: "",
    guardianName: "",
    guardianPhone: "",
    parentEmail: "",
    batch: "B1"
  });
  const [deptId, setDeptId] = useState("");
  const [classId, setClassId] = useState("");
  const [preview, setPreview] = useState<RosterRow[]>([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const c = await api<{
      students: Student[];
      classes: ClassRow[];
      departments: Dept[];
    }>("/api/catalog");
    setRows(c.students);
    setClasses(c.classes);
    setDepartments(c.departments);
    if (c.departments[0] && !deptId) setDeptId(c.departments[0].id);
  }

  const canImport = user?.role === "ADMIN" || user?.role === "COLLEGE_ADMIN" || user?.role === "HOD";
  const needsSetup = canImport && departments.length === 0;

  useEffect(() => {
    api<{ user: SessionUser }>("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => {});
    load().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, []);

  useEffect(() => {
    if (canImport && rows.length === 0 && departments.length > 0) setAddOpen(true);
  }, [canImport, rows.length, departments.length]);

  const classOptions = useMemo(
    () => classes.filter((c) => !deptId || c.department_id === deptId),
    [classes, deptId]
  );

  useEffect(() => {
    if (!classOptions.find((c) => c.id === classId)) {
      setClassId(classOptions[0]?.id || "");
    }
  }, [deptId, classOptions, classId]);

  const branches = useMemo(() => Array.from(new Set(rows.map((r) => r.branch_code))).sort(), [rows]);
  const shown = branch === "ALL" ? rows : rows.filter((r) => r.branch_code === branch);

  async function addManual() {
    setError("");
    setMsg("");
    if (!manual.name || !manual.rollNo || !classId) {
      setError("Name, roll number, branch and division are required.");
      return;
    }
    const cls = classes.find((c) => c.id === classId);
    const domain = `${(user?.collegeCode || "college").toLowerCase()}.edu`;
    const email =
      manual.email.trim() ||
      `${(cls?.department_code || "stu").toLowerCase().replace(/[^a-z0-9]/g, "")}.${(cls?.division || "x").toLowerCase()}.${manual.rollNo}@${domain}`;
    try {
      await api("/api/students", {
        method: "POST",
        body: JSON.stringify({
          name: manual.name,
          email,
          phone: manual.phone || null,
          rollNo: manual.rollNo,
          grNo: manual.grNo || null,
          prn: manual.prn || null,
          classId,
          batch: manual.batch || null,
          guardianName: manual.guardianName || null,
          guardianPhone: manual.guardianPhone || null,
          parentEmail: manual.parentEmail || null
        })
      });
      setMsg("Student added.");
      setManual({
        name: "",
        email: "",
        phone: "",
        rollNo: "",
        grNo: "",
        prn: "",
        guardianName: "",
        guardianPhone: "",
        parentEmail: "",
        batch: "B1"
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add student");
    }
  }

  async function parseFile(file: File) {
    setError("");
    setMsg("");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = typeof window !== "undefined" ? localStorage.getItem("amp_token") || "" : "";
      const res = await fetch("/api/students/import", {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}`, "X-Amp-Token": token } : {},
        body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not read file");
      setPreview(data.rows || []);
      setMsg(`${(data.rows || []).length} students read and sorted by roll number.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!classId || !preview.length) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ inserted: number; skipped: number; total: number }>("/api/students/import", {
        method: "POST",
        body: JSON.stringify({ classId, rows: preview })
      });
      setMsg(`Imported ${r.inserted} students (${r.skipped} skipped as already present).`);
      setPreview([]);
      setOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        kicker="Enrolment"
        title="Students"
        hint="Add one student by hand, or import a full division list (CSV / Excel / PDF)."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select className="field max-w-xs" value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="ALL">All branches</option>
              {branches.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
            {canImport ? (
              <>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setAddOpen((v) => !v);
                    setOpen(false);
                  }}
                >
                  Add manually
                </button>
                <button
                  className="btn-accent"
                  onClick={() => {
                    setOpen(true);
                    setAddOpen(false);
                  }}
                >
                  Import list
                </button>
              </>
            ) : null}
          </div>
        }
      />

      {needsSetup ? (
        <SetupCollege
          onDone={async () => {
            await load();
            setAddOpen(true);
          }}
        />
      ) : null}

      {addOpen ? (
        <div className="mb-6 glass p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl">Add student manually</h2>
            <button className="btn-ghost text-sm" onClick={() => setAddOpen(false)}>
              Close
            </button>
          </div>
          <p className="mb-4 text-sm text-ink-600">
            Required: name, roll, branch, division. Other fields can be left blank (saved as null).
          </p>
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="label">Branch</label>
              <select className="field" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Division</label>
              <select className="field" value={classId} onChange={(e) => setClassId(e.target.value)}>
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Div {c.division})
                  </option>
                ))}
              </select>
            </div>
            <input className="field" placeholder="Name *" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
            <input className="field" placeholder="Roll no *" value={manual.rollNo} onChange={(e) => setManual({ ...manual, rollNo: e.target.value })} />
            <input className="field" placeholder="Email (optional)" value={manual.email} onChange={(e) => setManual({ ...manual, email: e.target.value })} />
            <input className="field" placeholder="Mobile" value={manual.phone} onChange={(e) => setManual({ ...manual, phone: e.target.value })} />
            <input className="field" placeholder="GR no" value={manual.grNo} onChange={(e) => setManual({ ...manual, grNo: e.target.value })} />
            <input className="field" placeholder="PRN" value={manual.prn} onChange={(e) => setManual({ ...manual, prn: e.target.value })} />
            <select className="field" value={manual.batch} onChange={(e) => setManual({ ...manual, batch: e.target.value })}>
              <option value="">Batch (null)</option>
              {LAB_BATCHES.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
            <input className="field" placeholder="Parent name" value={manual.guardianName} onChange={(e) => setManual({ ...manual, guardianName: e.target.value })} />
            <input className="field" placeholder="Parent mobile" value={manual.guardianPhone} onChange={(e) => setManual({ ...manual, guardianPhone: e.target.value })} />
            <input className="field" placeholder="Parent email" value={manual.parentEmail} onChange={(e) => setManual({ ...manual, parentEmail: e.target.value })} />
            <button className="btn-accent" onClick={addManual}>
              Save student
            </button>
          </div>
          {msg ? <p className="mt-3 text-sm text-brand-700">{msg}</p> : null}
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        </div>
      ) : null}

      {open ? (
        <div className="mb-6 glass border-brand-200/40 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl">Import students</h2>
            <button className="btn-ghost text-sm" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <p className="mb-4 text-sm text-ink-600">
            Choose branch and division, then upload the roll list. CSV/Excel is most reliable. Text PDFs work;
            scanned image PDFs would need an AI key later — not required now.
          </p>
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="label">Branch</label>
              <select className="field" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Division</label>
              <select className="field" value={classId} onChange={(e) => setClassId(e.target.value)}>
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Div {c.division})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">File (CSV / Excel / PDF)</label>
              <input
                className="field"
                type="file"
                accept=".csv,.txt,.xlsx,.xls,.pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) parseFile(f);
                }}
              />
            </div>
            <div className="flex items-end">
              <a className="btn-ghost w-full text-center" href="/students-template.csv" download>
                Download CSV template
              </a>
            </div>
          </div>
          {busy ? <p className="mt-3 text-sm text-ink-500">Working…</p> : null}
          {msg ? <p className="mt-3 text-sm text-brand-700">{msg}</p> : null}
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          {preview.length ? (
            <>
              <div className="mt-4 table-wrap max-h-64">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Roll</th>
                      <th>Name</th>
                      <th>GR no</th>
                      <th>Mobile</th>
                      <th>Parent</th>
                      <th>Parent mobile</th>
                      <th>Parent email</th>
                      <th>Batch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i}>
                        <td>{r.rollNo}</td>
                        <td>{r.name}</td>
                        <td>{cell(r.grNo)}</td>
                        <td>{cell(r.phone)}</td>
                        <td>{cell(r.guardianName)}</td>
                        <td>{cell(r.guardianPhone)}</td>
                        <td>{cell(r.parentEmail)}</td>
                        <td>{cell(r.batch)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="btn-accent mt-4" disabled={busy} onClick={commit}>
                Import {preview.length} students into this division
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <p className="mb-2 text-sm text-ink-500">{shown.length} students</p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Branch</th>
              <th>Div</th>
              <th>Batch</th>
              <th>Roll</th>
              <th>GR no</th>
              <th>Name</th>
              <th>Mobile</th>
              <th>Parent</th>
              <th>Parent mobile</th>
              <th>Parent email</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td>{r.branch_code}</td>
                <td>{r.division}</td>
                <td>{cell(r.batch)}</td>
                <td>{r.roll_no}</td>
                <td>{cell(r.gr_no)}</td>
                <td>{r.name}</td>
                <td>{cell(r.phone)}</td>
                <td>{cell(r.guardian_name)}</td>
                <td>{cell(r.guardian_phone)}</td>
                <td>{cell(r.parent_email)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SetupCollege({ onDone }: { onDone: () => Promise<void> }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [division, setDivision] = useState("A");
  const [year, setYear] = useState("SE");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="mb-6 glass border-brand-200/40 p-5">
      <h2 className="font-display text-xl">Set up your college first</h2>
      <p className="mt-1 text-sm text-ink-600">
        New colleges start empty. Create a branch and one division, then you can add students by hand or import a list.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <input className="field" placeholder="Branch code e.g. CE" value={code} onChange={(e) => setCode(e.target.value)} />
        <input
          className="field"
          placeholder="Branch name e.g. Computer Engineering"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select className="field" value={year} onChange={(e) => setYear(e.target.value)}>
          {["FE", "SE", "TE", "BE"].map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
        <select className="field" value={division} onChange={(e) => setDivision(e.target.value)}>
          {["A", "B", "C", "D", "E", "F", "G", "H"].map((d) => (
            <option key={d} value={d}>
              Div {d}
            </option>
          ))}
        </select>
      </div>
      <button
        className="btn-accent mt-4"
        disabled={busy}
        onClick={async () => {
          setError("");
          const branchCode = code.trim().toUpperCase();
          const branchName = name.trim();
          const div = division.replace(/^Div\s+/i, "");
          if (!branchCode || !branchName) {
            setError("Enter branch code and name.");
            return;
          }
          setBusy(true);
          try {
            await api("/api/departments", { method: "POST", body: JSON.stringify({ code: branchCode, name: branchName }) });
            const catalog = await api<{ departments: { id: string; code: string }[] }>("/api/catalog");
            const dept = catalog.departments.find((d) => d.code === branchCode) || catalog.departments[0];
            if (!dept) throw new Error("Department was not created");
            await api("/api/classes", {
              method: "POST",
              body: JSON.stringify({
                name: `${year}-${branchCode}-${div}`,
                year,
                division: div,
                semester: year === "FE" ? 1 : year === "SE" ? 3 : year === "TE" ? 5 : 7,
                academicYear: "2025-26",
                departmentId: dept.id
              })
            });
            await onDone();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Could not create branch");
          } finally {
            setBusy(false);
          }
        }}
      >
        Create branch + division
      </button>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
