"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { api } from "@/lib/client";

type Row = {
  name: string;
  roll_no: string;
  class_name: string;
  division: string;
  branch_code: string;
  batch: string;
  subject: string;
  code: string;
  present: number;
  total: number;
  percent: number;
  marksPct: number | null;
};

type Dept = { code: string; name: string };
type ClassRow = { division: string; department_code: string };

export default function DefaultersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [branch, setBranch] = useState("");
  const [division, setDivision] = useState("");
  const [threshold, setThreshold] = useState(75);
  const [marksBelow, setMarksBelow] = useState("");
  const [mode, setMode] = useState<"att" | "or" | "and">("att");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ departments: Dept[]; classes: ClassRow[] }>("/api/catalog")
      .then(async (c) => {
        setClasses(c.classes || []);
        try {
          const al = await api<{ branch_code: string; division: string }[]>("/api/allotments");
          if (Array.isArray(al) && al.length) {
            const codes = new Set(al.map((a) => a.branch_code));
            setDepartments((c.departments || []).filter((d) => codes.has(d.code)));
            const divs = al.map((a) => ({ division: a.division, department_code: a.branch_code }));
            setClasses(divs);
          } else {
            setDepartments(c.departments || []);
          }
        } catch {
          setDepartments(c.departments || []);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, []);

  const divisions = useMemo(() => {
    const list = classes.filter((c) => !branch || c.department_code === branch).map((c) => c.division);
    return Array.from(new Set(list)).sort();
  }, [classes, branch]);

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const q = new URLSearchParams({ threshold: String(threshold), mode });
      if (branch) q.set("branch", branch);
      if (division) q.set("division", division);
      if (marksBelow) q.set("marksBelow", marksBelow);
      const data = await api<Row[]>(`/api/defaulters?${q.toString()}`);
      setRows(Array.isArray(data) ? data : []);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate list");
    } finally {
      setBusy(false);
    }
  }

  function downloadExcel() {
    import("xlsx").then((XLSX) => {
      const data = rows.map((r) => ({
        Branch: r.branch_code,
        Division: r.division,
        Batch: r.batch || "",
        Roll: r.roll_no,
        Name: r.name,
        Class: r.class_name,
        Subject: `${r.code} ${r.subject}`,
        Present: r.present,
        Held: r.total,
        "Attendance %": r.percent,
        "Internals %": r.marksPct ?? ""
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Defaulters");
      const name = `defaulters_${branch || "all"}_${division || "all"}_att${threshold}.xlsx`;
      XLSX.writeFile(wb, name);
    });
  }

  const criteria =
    `Attendance below ${threshold}%` +
    (marksBelow
      ? mode === "and"
        ? ` AND internals below ${marksBelow}%`
        : mode === "or"
          ? ` OR internals below ${marksBelow}%`
          : ""
      : "");

  return (
    <div>
      <PageHeader
        kicker="Faculty"
        title="Defaulter list"
        hint="Choose branch, division and your cutoff. Generate the list, then print PDF or download Excel."
        action={
          <div className="flex flex-wrap gap-2 no-print">
            <button className="btn-ghost" onClick={() => window.print()} disabled={!rows.length}>
              Print PDF
            </button>
            <button className="btn-accent" onClick={downloadExcel} disabled={!rows.length}>
              Download Excel
            </button>
          </div>
        }
      />

      <div className="no-print mb-6 grid gap-3 rounded-2xl border border-ink-100 bg-white p-4 md:grid-cols-6">
        <div>
          <label className="label">Branch</label>
          <select
            className="field"
            value={branch}
            onChange={(e) => {
              setBranch(e.target.value);
              setDivision("");
            }}
          >
            <option value="">All allotted branches</option>
            {departments.map((d) => (
              <option key={d.code} value={d.code}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Division</label>
          <select className="field" value={division} onChange={(e) => setDivision(e.target.value)}>
            <option value="">All divisions</option>
            {divisions.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Attendance below %</label>
          <input
            className="field"
            type="number"
            min={1}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label">Internals below % (optional)</label>
          <input
            className="field"
            type="number"
            min={1}
            max={100}
            placeholder="Skip"
            value={marksBelow}
            onChange={(e) => setMarksBelow(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Combine</label>
          <select className="field" value={mode} onChange={(e) => setMode(e.target.value as "att" | "or" | "and")}>
            <option value="att">Attendance only</option>
            <option value="or">Attendance OR internals</option>
            <option value="and">Attendance AND internals</option>
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn-accent w-full" disabled={busy} onClick={generate}>
            {busy ? "Generating…" : "Generate list"}
          </button>
        </div>
      </div>
      {error ? <p className="mb-3 text-sm text-rose-700">{error}</p> : null}

      <div className="paper mb-4 rounded-2xl border border-ink-100 p-4">
        <p className="text-xs uppercase tracking-wide text-brand-700">Vishwakarma Institute of Technology, Pune</p>
        <h2 className="font-display text-xl">Defaulter list</h2>
        <p className="text-sm text-ink-600">
          {branch || "All branches"}
          {division ? ` · Div ${division}` : ""} · {criteria} · {rows.length} row(s)
        </p>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Branch</th>
              <th>Div</th>
              <th>Roll</th>
              <th>Student</th>
              <th>Subject</th>
              <th>Present / Held</th>
              <th>Att %</th>
              <th>Internals %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.branch_code}</td>
                <td>{r.division}</td>
                <td>{r.roll_no}</td>
                <td>{r.name}</td>
                <td>
                  {r.code} {r.subject}
                </td>
                <td>
                  {r.present}/{r.total}
                </td>
                <td className="font-semibold text-rose-700">{r.percent}%</td>
                <td>{r.marksPct != null ? `${r.marksPct}%` : "null"}</td>
              </tr>
            ))}
            {loaded && rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-ink-500">
                  No defaulters for this branch, division and criteria.
                </td>
              </tr>
            ) : null}
            {!loaded ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-ink-500">
                  Set branch, division and criteria, then click Generate list.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
