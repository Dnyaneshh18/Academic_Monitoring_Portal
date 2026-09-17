"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { SearchSelect } from "@/components/SearchSelect";
import { api } from "@/lib/client";
import type { SessionUser } from "@/lib/auth";
import type { Allotment } from "@/lib/queries";

type Student = { id: string; name: string; roll_no: string };
type Session = { id: string; date: string; period: number; topic: string };

function applyAllotment(
  a: Allotment | undefined,
  set: {
    setBranch: (v: string) => void;
    setDivision: (v: string) => void;
    setKind: (v: "THEORY" | "LAB") => void;
    setBatch: (v: string) => void;
    setAllotmentId: (v: string) => void;
    setTopic: (v: string) => void;
  }
) {
  if (!a) return;
  set.setBranch(a.branch_code);
  set.setDivision(a.division);
  set.setKind(a.kind === "LAB" ? "LAB" : "THEORY");
  set.setBatch(a.batch || "");
  set.setAllotmentId(a.id);
  set.setTopic(a.subject_name);
}

export default function AttendancePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [allotments, setAllotments] = useState<Allotment[]>([]);
  const [branch, setBranch] = useState("");
  const [division, setDivision] = useState("");
  const [kind, setKind] = useState<"THEORY" | "LAB">("THEORY");
  const [batch, setBatch] = useState("");
  const [allotmentId, setAllotmentId] = useState("");
  const [matrix, setMatrix] = useState<{ sessions: Session[]; students: Student[]; map: Record<string, string> } | null>(
    null
  );
  const [summary, setSummary] = useState<{ subject: string; code: string; present: number; total: number }[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [topic, setTopic] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  const setters = { setBranch, setDivision, setKind, setBatch, setAllotmentId, setTopic };

  useEffect(() => {
    api<{ user: SessionUser }>("/api/auth/me")
      .then((d) => {
        setUser(d.user);
        if (d.user.role === "STUDENT") {
          api<{ summary: typeof summary }>("/api/attendance")
            .then((r) => setSummary(r.summary || []))
            .catch(() => {});
        }
      })
      .catch(() => {});
    api<Allotment[]>("/api/allotments")
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setAllotments(list);
        applyAllotment(list[0], setters);
      })
      .catch(() => setAllotments([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const branches = useMemo(() => {
    const map = new Map<string, string>();
    allotments.forEach((a) => map.set(a.branch_code, a.branch_name));
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, name]) => ({ id: code, label: `${code} — ${name}` }));
  }, [allotments]);

  const divisions = useMemo(
    () =>
      Array.from(new Set(allotments.filter((a) => a.branch_code === branch).map((a) => a.division))).sort(),
    [allotments, branch]
  );
  const kinds = useMemo(
    () =>
      Array.from(
        new Set(allotments.filter((a) => a.branch_code === branch && a.division === division).map((a) => a.kind))
      ),
    [allotments, branch, division]
  );
  const batches = useMemo(
    () =>
      Array.from(
        new Set(
          allotments
            .filter((a) => a.branch_code === branch && a.division === division && a.kind === "LAB" && a.batch)
            .map((a) => a.batch as string)
        )
      ).sort(),
    [allotments, branch, division]
  );

  const subjectOptions = useMemo(() => {
    const seen = new Set<string>();
    return allotments
      .filter((a) => (!branch || a.branch_code === branch) && (!division || a.division === division))
      .filter((a) => {
        const key = `${a.subject_id}:${a.kind}:${a.batch || ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((a) => ({
        id: a.id,
        label: `${a.subject_code} · ${a.subject_name}`,
        hint: `${a.branch_code} Div ${a.division}${a.batch ? ` · ${a.batch}` : " · theory"}`
      }));
  }, [allotments, branch, division]);

  const selected = useMemo(() => {
    const byFilters = allotments.find(
      (a) =>
        a.branch_code === branch &&
        a.division === division &&
        a.kind === kind &&
        (kind === "LAB" ? a.batch === batch : a.kind === "THEORY")
    );
    if (byFilters) return byFilters;
    return allotments.find((a) => a.id === allotmentId);
  }, [allotments, allotmentId, branch, division, kind, batch]);

  useEffect(() => {
    const match = allotments.find(
      (a) =>
        a.branch_code === branch &&
        a.division === division &&
        a.kind === kind &&
        (kind === "LAB" ? a.batch === batch : a.kind === "THEORY")
    );
    if (match && match.id !== allotmentId) {
      setAllotmentId(match.id);
      setTopic((t) => (t && t !== "Lecture" ? match.subject_name : match.subject_name));
    }
  }, [allotments, branch, division, kind, batch, allotmentId]);

  useEffect(() => {
    if (!selected || user?.role === "STUDENT") return;
    const qs = new URLSearchParams({ subjectId: selected.subject_id });
    if (selected.kind === "LAB" && selected.batch) qs.set("batch", selected.batch);
    api<{ sessions: Session[]; students: Student[]; map: Record<string, string> }>(`/api/attendance?${qs}`)
      .then((m) => {
        setMatrix(m);
        const sess =
          (m.sessions || []).find((s) => s.date === date) || (m.sessions || [])[(m.sessions || []).length - 1];
        const next: Record<string, string> = {};
        m.students.forEach((s) => {
          next[s.id] = (sess && m.map[`${s.id}:${sess.id}`]) || "PRESENT";
        });
        setDraft(next);
      })
      .catch(() => null);
  }, [selected, user, date]);

  async function save() {
    if (!selected) return;
    setMsg("");
    await api("/api/attendance", {
      method: "POST",
      body: JSON.stringify({
        subjectId: selected.subject_id,
        date,
        period: 1,
        topic: topic || selected.subject_name,
        batch: selected.kind === "LAB" ? selected.batch : null,
        records: Object.entries(draft).map(([studentId, status]) => ({ studentId, status }))
      })
    });
    setMsg("Attendance saved for this branch / division / batch and date.");
    const qs = new URLSearchParams({ subjectId: selected.subject_id });
    if (selected.kind === "LAB" && selected.batch) qs.set("batch", selected.batch);
    setMatrix(await api(`/api/attendance?${qs}`));
  }

  function chooseBranch(code: string) {
    const next = allotments.find((a) => a.branch_code === code);
    applyAllotment(next, setters);
  }

  function chooseDivision(div: string) {
    const next = allotments.find(
      (a) => a.branch_code === branch && a.division === div && (kind === "LAB" ? a.kind === "LAB" : a.kind === "THEORY")
    ) || allotments.find((a) => a.branch_code === branch && a.division === div);
    applyAllotment(next, setters);
  }

  function chooseKind(k: "THEORY" | "LAB") {
    const next =
      allotments.find(
        (a) => a.branch_code === branch && a.division === division && a.kind === k
      ) || allotments.find((a) => a.branch_code === branch && a.kind === k);
    applyAllotment(next, setters);
  }

  function chooseBatch(b: string) {
    const next = allotments.find(
      (a) => a.branch_code === branch && a.division === division && a.kind === "LAB" && a.batch === b
    );
    applyAllotment(next, setters);
  }

  function chooseSubject(id: string) {
    applyAllotment(
      allotments.find((a) => a.id === id),
      setters
    );
  }

  if (user?.role === "STUDENT") {
    return (
      <div>
        <PageHeader kicker="My record" title="Attendance" hint="Subject-wise presence. 75% is the institute minimum." />
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Code</th>
                <th>Subject</th>
                <th>Present</th>
                <th>Held</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((r) => {
                const pct = r.total ? Math.round((r.present / r.total) * 1000) / 10 : 0;
                return (
                  <tr key={r.code}>
                    <td>{r.code}</td>
                    <td>{r.subject}</td>
                    <td>{r.present}</td>
                    <td>{r.total}</td>
                    <td>
                      <span className={`badge ${pct < 75 ? "bg-rose-100 text-rose-800" : "bg-brand-100 text-brand-800"}`}>
                        {pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const lectureHints = Array.from(
    new Set(
      [
        selected?.subject_name,
        ...(matrix?.sessions || []).map((s) => s.topic),
        selected ? `Lecture — ${selected.subject_name}` : ""
      ].filter(Boolean) as string[]
    )
  );

  return (
    <div>
      <PageHeader
        kicker="Roll call"
        title="Attendance"
        hint="Search your allotted branch — CE loads DSA, IT loads Computer Networks. Then mark and save."
      />
      <div className="mb-4 grid gap-3 rounded-2xl border border-ink-100 bg-white p-4 md:grid-cols-6">
        <SearchSelect
          label="Branch"
          value={branch}
          onChange={chooseBranch}
          options={branches}
          placeholder="Search CE, IT…"
        />
        <div>
          <label className="label">Division</label>
          <select className="field" value={division} onChange={(e) => chooseDivision(e.target.value)}>
            {divisions.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Type</label>
          <select className="field" value={kind} onChange={(e) => chooseKind(e.target.value as "THEORY" | "LAB")}>
            {kinds.includes("THEORY") ? <option value="THEORY">Theory (whole division)</option> : null}
            {kinds.includes("LAB") ? <option value="LAB">Laboratory (batch)</option> : null}
          </select>
        </div>
        {kind === "LAB" ? (
          <div>
            <label className="label">Batch</label>
            <select className="field" value={batch} onChange={(e) => chooseBatch(e.target.value)}>
              {batches.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="label">Batch</label>
            <input className="field" disabled value="All (theory)" />
          </div>
        )}
        <SearchSelect
          label="Subject (allotted)"
          value={allotmentId}
          onChange={chooseSubject}
          options={subjectOptions}
          placeholder="Search DSA, Computer Networks…"
        />
        <div>
          <label className="label">Date</label>
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="md:col-span-3">
          <label className="label">Lecture / session name</label>
          <input
            className="field"
            list="lecture-name-hints"
            placeholder="Type subject name…"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            autoComplete="off"
          />
          <datalist id="lecture-name-hints">
            {lectureHints.map((h) => (
              <option key={h} value={h} />
            ))}
          </datalist>
        </div>
        <div className="md:col-span-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink-600">
            {selected
              ? `${selected.branch_code} · Div ${selected.division}${selected.batch ? ` · ${selected.batch}` : ""} · ${selected.subject_code} ${selected.subject_name}`
              : "No allotment matches this selection."}
          </p>
          <button className="btn-accent ml-auto" onClick={save} disabled={!selected}>
            Save lecture
          </button>
          {msg ? <span className="text-sm text-brand-700">{msg}</span> : null}
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-ink-100 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Mark this lecture</p>
        <div className="grid gap-2 md:grid-cols-2">
          {(matrix?.students || []).map((s) => (
            <label key={s.id} className="flex items-center justify-between rounded-xl border border-ink-100 px-3 py-2 text-sm">
              <span>
                {s.roll_no}. {s.name}
              </span>
              <select
                className="rounded-lg border border-ink-200 px-2 py-1 text-xs"
                value={draft[s.id] || "PRESENT"}
                onChange={(e) => setDraft({ ...draft, [s.id]: e.target.value })}
              >
                {["PRESENT", "ABSENT", "LATE", "OD"].map((st) => (
                  <option key={st}>{st}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Roll</th>
              <th>Student</th>
              {(matrix?.sessions || []).map((s) => (
                <th key={s.id}>{s.date.slice(5)}</th>
              ))}
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {(matrix?.students || []).map((st) => {
              const sess = matrix?.sessions || [];
              const present = sess.filter((s) =>
                ["PRESENT", "LATE", "OD"].includes(matrix?.map[`${st.id}:${s.id}`] || "")
              ).length;
              const pct = sess.length ? Math.round((present / sess.length) * 1000) / 10 : 0;
              return (
                <tr key={st.id}>
                  <td>{st.roll_no}</td>
                  <td>{st.name}</td>
                  {sess.map((s) => {
                    const v = matrix?.map[`${st.id}:${s.id}`] || "—";
                    return (
                      <td key={s.id} className="text-center text-xs">
                        {v === "PRESENT" ? "P" : v === "ABSENT" ? "A" : v === "LATE" ? "L" : v === "OD" ? "OD" : "—"}
                      </td>
                    );
                  })}
                  <td className={pct < 75 ? "font-semibold text-rose-700" : ""}>{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
