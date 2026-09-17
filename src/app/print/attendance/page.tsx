"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { api } from "@/lib/client";
import type { SessionUser } from "@/lib/auth";

type Row = { subject: string; code: string; present: number; total: number };

const CUTOFF = 75;

export default function PrintAttendancePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [dept, setDept] = useState("");

  useEffect(() => {
    api<{ user: SessionUser }>("/api/auth/me")
      .then(async (d) => {
        setUser(d.user);
        setDept(d.user.collegeName || "");
        const r = await api<{ summary: Row[] }>("/api/attendance");
        setRows(r.summary || []);
      })
      .catch(() => {});
  }, []);

  const totalPresent = rows.reduce((s, r) => s + Number(r.present || 0), 0);
  const totalHeld = rows.reduce((s, r) => s + Number(r.total || 0), 0);
  const overall = totalHeld ? Math.round((totalPresent / totalHeld) * 1000) / 10 : 0;
  const pctOf = (r: Row) => (Number(r.total) ? Math.round((Number(r.present) / Number(r.total)) * 1000) / 10 : 0);

  return (
    <div className="min-h-screen bg-base px-4 py-8 print:bg-white print:p-0">
      {/* screen-only toolbar */}
      <div className="no-print mx-auto mb-6 flex max-w-[820px] items-center justify-between gap-3">
        <a href="/app/attendance" className="btn btn-ghost">
          <ArrowLeft className="h-4 w-4" /> Back to attendance
        </a>
        <button onClick={() => window.print()} className="btn btn-primary">
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </button>
      </div>

      <article className="paper mx-auto max-w-[820px]">
        <div className="paper-accent-rule" />

        <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold">Attendance report</h1>
            <p className="paper-muted mt-1 text-[13px]">{dept || "Academic Monitoring Portal"}</p>
          </div>
          <div className="text-right text-[12.5px]">
            <p className="font-semibold">{user?.name || "—"}</p>
            <p className="paper-muted">{user?.email}</p>
            <p className="paper-muted mt-1">
              Generated {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          </div>
        </header>

        <div className="mt-6 flex flex-wrap gap-2">
          <span className="paper-chip">Overall {overall}%</span>
          <span className="paper-chip">
            {totalPresent} of {totalHeld} sessions attended
          </span>
          <span className={overall >= CUTOFF ? "paper-chip" : "paper-chip paper-danger"}>
            Institute minimum {CUTOFF}%
          </span>
        </div>

        <table className="mt-7 w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b paper-rule">
              <th className="py-2.5 text-left font-semibold">Code</th>
              <th className="py-2.5 text-left font-semibold">Subject</th>
              <th className="py-2.5 text-right font-semibold">Held</th>
              <th className="py-2.5 text-right font-semibold">Attended</th>
              <th className="py-2.5 text-right font-semibold">%</th>
              <th className="py-2.5 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pct = pctOf(r);
              const ok = pct >= CUTOFF;
              return (
                <tr key={r.code} className="print-avoid-break border-b paper-rule">
                  <td className="py-2.5 font-medium">{r.code}</td>
                  <td className="py-2.5">{r.subject}</td>
                  <td className="py-2.5 text-right">{r.total}</td>
                  <td className="py-2.5 text-right">{r.present}</td>
                  <td className="py-2.5 text-right font-semibold">{pct}%</td>
                  <td className={`py-2.5 text-right font-semibold ${ok ? "paper-success" : "paper-danger"}`}>
                    {ok ? "Eligible" : "Short"}
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={6} className="paper-muted py-8 text-center">
                  No attendance has been recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
          {rows.length ? (
            <tfoot>
              <tr className="border-t-2 paper-rule font-semibold">
                <td className="py-2.5" colSpan={2}>
                  Total
                </td>
                <td className="py-2.5 text-right">{totalHeld}</td>
                <td className="py-2.5 text-right">{totalPresent}</td>
                <td className="py-2.5 text-right">{overall}%</td>
                <td className={`py-2.5 text-right ${overall >= CUTOFF ? "paper-success" : "paper-danger"}`}>
                  {overall >= CUTOFF ? "Eligible" : "Short"}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>

        <footer className="mt-10 flex flex-wrap items-end justify-between gap-6 border-t paper-rule pt-5 text-[11.5px]">
          <p className="paper-muted">This is a system-generated report from the Academic Monitoring Portal.</p>
          <div className="text-center">
            <div className="mb-1 h-10 w-44 border-b paper-rule" />
            <p className="paper-muted">Faculty / HOD signature</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
