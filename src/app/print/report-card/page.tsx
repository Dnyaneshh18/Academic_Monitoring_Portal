"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { api } from "@/lib/client";
import type { SessionUser } from "@/lib/auth";

type MarkRow = {
  obtained: number;
  remark: string;
  title: string;
  type: string;
  max_marks: number;
  subject: string;
  code: string;
};

type SubjectBlock = {
  code: string;
  subject: string;
  items: MarkRow[];
  obtained: number;
  max: number;
  pct: number;
};

export default function PrintReportCardPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [marks, setMarks] = useState<MarkRow[]>([]);

  useEffect(() => {
    api<{ user: SessionUser }>("/api/auth/me")
      .then(async (d) => {
        setUser(d.user);
        const r = await api<{ marks: MarkRow[] }>("/api/marks");
        setMarks(r.marks || []);
      })
      .catch(() => {});
  }, []);

  const subjects: SubjectBlock[] = useMemo(() => {
    const map = new Map<string, SubjectBlock>();
    for (const m of marks) {
      const key = m.code || m.subject || "—";
      const block =
        map.get(key) ||
        ({ code: m.code, subject: m.subject, items: [], obtained: 0, max: 0, pct: 0 } as SubjectBlock);
      block.items.push(m);
      block.obtained += Number(m.obtained || 0);
      block.max += Number(m.max_marks || 0);
      map.set(key, block);
    }
    return Array.from(map.values())
      .map((b) => ({ ...b, pct: b.max ? Math.round((b.obtained / b.max) * 1000) / 10 : 0 }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [marks]);

  const totalObt = subjects.reduce((s, b) => s + b.obtained, 0);
  const totalMax = subjects.reduce((s, b) => s + b.max, 0);
  const overall = totalMax ? Math.round((totalObt / totalMax) * 1000) / 10 : 0;
  const best = subjects.length ? subjects.reduce((a, b) => (b.pct > a.pct ? b : a)) : null;

  return (
    <div className="min-h-screen bg-base px-4 py-8 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-6 flex max-w-[820px] items-center justify-between gap-3">
        <a href="/app/marks" className="btn btn-ghost">
          <ArrowLeft className="h-4 w-4" /> Back to assessments
        </a>
        <button onClick={() => window.print()} className="btn btn-primary">
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </button>
      </div>

      <article className="paper mx-auto max-w-[820px]">
        <div className="paper-accent-rule" />

        <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold">Statement of marks</h1>
            <p className="paper-muted mt-1 text-[13px]">{user?.collegeName || "Academic Monitoring Portal"}</p>
          </div>
          <div className="text-right text-[12.5px]">
            <p className="font-semibold">{user?.name || "—"}</p>
            <p className="paper-muted">{user?.email}</p>
            <p className="paper-muted mt-1">
              Issued {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          </div>
        </header>

        <div className="mt-6 flex flex-wrap gap-2">
          <span className="paper-chip">Overall {overall}%</span>
          <span className="paper-chip">
            {totalObt} / {totalMax} marks
          </span>
          <span className="paper-chip">{subjects.length} subjects</span>
          {best ? <span className="paper-chip">Best: {best.code} · {best.pct}%</span> : null}
        </div>

        {subjects.length ? (
          subjects.map((b) => (
            <section key={b.code} className="print-avoid-break mt-8">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b paper-rule pb-2">
                <h2 className="text-[15px] font-semibold">
                  {b.code} — {b.subject}
                </h2>
                <p className="text-[12.5px]">
                  <span className="font-semibold">
                    {b.obtained} / {b.max}
                  </span>
                  <span className={b.pct >= 40 ? "paper-success ml-2 font-semibold" : "paper-danger ml-2 font-semibold"}>
                    {b.pct}%
                  </span>
                </p>
              </div>

              <table className="mt-3 w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="paper-muted">
                    <th className="py-1.5 text-left font-semibold">Assessment</th>
                    <th className="py-1.5 text-left font-semibold">Type</th>
                    <th className="py-1.5 text-right font-semibold">Obtained</th>
                    <th className="py-1.5 text-right font-semibold">Max</th>
                    <th className="py-1.5 text-left font-semibold">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {b.items.map((m, i) => (
                    <tr key={`${m.title}-${i}`} className="border-b paper-rule">
                      <td className="py-1.5">{m.title}</td>
                      <td className="paper-muted py-1.5">{m.type}</td>
                      <td className="py-1.5 text-right font-medium">{m.obtained}</td>
                      <td className="paper-muted py-1.5 text-right">{m.max_marks}</td>
                      <td className="paper-muted py-1.5">{m.remark || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))
        ) : (
          <p className="paper-muted mt-10 text-center text-[13px]">No assessments have been recorded yet.</p>
        )}

        <footer className="mt-10 flex flex-wrap items-end justify-between gap-6 border-t paper-rule pt-5 text-[11.5px]">
          <p className="paper-muted">
            System-generated statement. For discrepancies, contact the subject faculty within seven days.
          </p>
          <div className="flex gap-8">
            <div className="text-center">
              <div className="mb-1 h-10 w-36 border-b paper-rule" />
              <p className="paper-muted">Faculty</p>
            </div>
            <div className="text-center">
              <div className="mb-1 h-10 w-36 border-b paper-rule" />
              <p className="paper-muted">HOD</p>
            </div>
          </div>
        </footer>
      </article>
    </div>
  );
}
