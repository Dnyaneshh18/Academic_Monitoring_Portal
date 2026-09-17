"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { SearchSelect } from "@/components/SearchSelect";
import { api } from "@/lib/client";
import type { Allotment } from "@/lib/queries";

type Saved = {
  id: string;
  date: string;
  title: string;
  type: string;
  subject_name: string;
  subject_code: string;
  class_name: string;
  batch: string;
  kind: "attendance" | "assignment";
};

export default function SessionsPage() {
  const [date, setDate] = useState("");
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState("");
  const [allotments, setAllotments] = useState<Allotment[]>([]);
  const [rows, setRows] = useState<Saved[]>([]);
  const [detail, setDetail] = useState<{
    kind: string;
    session?: { date: string; topic: string; subject_name: string };
    assessment?: { title: string; date: string; max_marks: number; type: string };
    records?: { roll_no: string; name: string; status: string }[];
    students?: { roll_no: string; name: string; id: string }[];
    map?: Record<string, { obtained: number; remark: string }>;
  } | null>(null);
  const [error, setError] = useState("");

  async function load(next?: { q?: string; date?: string; branch?: string }) {
    setError("");
    const params = new URLSearchParams();
    const d = next?.date ?? date;
    const query = next?.q ?? q;
    const br = next?.branch ?? branch;
    if (d) params.set("date", d);
    if (query.trim()) params.set("q", query.trim());
    if (br) params.set("branch", br);
    const data = await api<Saved[]>(`/api/sessions?${params.toString()}`);
    const list = Array.isArray(data) ? data : [];
    setRows(list);
    setDetail(null);
  }

  useEffect(() => {
    api<Allotment[]>("/api/allotments")
      .then((rows) => setAllotments(Array.isArray(rows) ? rows : []))
      .catch(() => null);
    load().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const branchOptions = useMemo(() => {
    const map = new Map<string, string>();
    allotments.forEach((a) => map.set(a.branch_code, a.branch_name));
    return [{ id: "", label: "All allotted branches" }, ...Array.from(map.entries()).map(([code, name]) => ({ id: code, label: `${code} — ${name}` }))];
  }, [allotments]);

  const subjectHints = useMemo(() => {
    const names = allotments
      .filter((a) => !branch || a.branch_code === branch)
      .map((a) => a.subject_name);
    return Array.from(new Set(names));
  }, [allotments, branch]);

  useEffect(() => {
    const t = setTimeout(() => {
      load().catch(() => null);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, date, branch]);

  async function openRow(r: Saved) {
    const d = await api<NonNullable<typeof detail>>(`/api/sessions?id=${r.id}&kind=${r.kind}`);
    setDetail(d);
  }

  return (
    <div>
      <PageHeader
        kicker="History"
        title="Saved sessions"
        hint="Every lecture and assignment is stored by date and name. Filter, then open a session to see the saved roll."
      />

      <div className="no-print mb-6 grid gap-3 glass p-4 md:grid-cols-4">
        <SearchSelect
          label="Branch"
          value={branch}
          onChange={(id) => setBranch(id)}
          options={branchOptions}
          placeholder="Search CE, IT…"
        />
        <div>
          <label className="label">Date</label>
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="relative">
          <label className="label">Subject / assignment name</label>
          <input
            className="field"
            list="session-name-hints"
            placeholder={
              branch === "IT"
                ? "Computer Networks"
                : branch === "CE"
                  ? "Data Structures & Algorithms"
                  : "Type subject name…"
            }
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
          />
          <datalist id="session-name-hints">
            {subjectHints
              .filter((h) => !q || h.toLowerCase().includes(q.toLowerCase()))
              .slice(0, 20)
              .map((h) => (
                <option key={h} value={h} />
              ))}
          </datalist>
        </div>
        <div className="flex items-end">
          <button className="btn-accent w-full" onClick={() => load()}>
            View saved
          </button>
        </div>
      </div>
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="table-wrap lg:col-span-2">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.kind}-${r.id}`}>
                  <td>{r.date}</td>
                  <td>
                    <button className="text-left font-medium text-brand-700 hover:underline" onClick={() => openRow(r)}>
                      {r.title}
                    </button>
                    <div className="text-[11px] text-ink-400">
                      {r.subject_code} · {r.class_name}
                      {r.batch ? ` · ${r.batch}` : ""}
                    </div>
                  </td>
                  <td>{r.kind === "attendance" ? "Lecture" : r.type}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-ink-500">
                    No saved sessions for this date / name.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="glass p-4 lg:col-span-3">
          {!detail ? (
            <p className="text-sm text-ink-500">Click a session name to view the saved attendance or marks.</p>
          ) : detail.kind === "attendance" ? (
            <>
              <h2 className="font-display text-xl">{detail.session?.topic || "Lecture"}</h2>
              <p className="mb-3 text-sm text-ink-500">
                {detail.session?.date} · {detail.session?.subject_name}
              </p>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Roll</th>
                      <th>Name</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.records || []).map((r, i) => (
                      <tr key={i}>
                        <td>{r.roll_no}</td>
                        <td>{r.name}</td>
                        <td>{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <h2 className="font-display text-xl">{(detail.assessment as { title?: string } | undefined)?.title}</h2>
              <p className="mb-3 text-sm text-ink-500">
                {(detail.assessment as { date?: string; type?: string; max_marks?: number } | undefined)?.date} ·{" "}
                {(detail.assessment as { type?: string } | undefined)?.type} · max{" "}
                {(detail.assessment as { max_marks?: number } | undefined)?.max_marks}
              </p>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Roll</th>
                      <th>Name</th>
                      <th>Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.students || []).map((s) => (
                      <tr key={s.id}>
                        <td>{s.roll_no}</td>
                        <td>{s.name}</td>
                        <td>{detail.map?.[s.id]?.obtained ?? "null"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
