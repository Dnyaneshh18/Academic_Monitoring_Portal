"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { api } from "@/lib/client";
import type { SessionUser } from "@/lib/auth";

export default function ReportsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [data, setData] = useState<{
    classes: { name: string; student_count: number; department_name: string }[];
    faculty: { name: string; designation: string; department_name: string }[];
    defaulters: { name: string; class_name: string; subject: string; percent: number }[];
    attendanceOverall: { students: number; faculty: number; attendancePct: number; defaulters: number };
  } | null>(null);

  useEffect(() => {
    api<{ user: SessionUser }>("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => {});
    api<NonNullable<typeof data>>("/api/reports")
      .then(setData)
      .catch(() => {});
  }, []);

  const collegeName = user?.collegeName || "College";

  return (
    <div>
      <PageHeader
        kicker="AMC pack"
        title="Academic monitoring report"
        hint="Print-ready summary for this college only."
        action={
          <button className="btn-primary no-print" onClick={() => window.print()}>
            Print / PDF
          </button>
        }
      />
      <div className="paper rounded-3xl border border-ink-200 p-8">
        <div className="mb-6 flex items-center justify-between border-b border-ink-200 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-brand-700">{collegeName}</p>
            <h2 className="font-display text-2xl">Academic Monitoring Committee — Snapshot</h2>
            <p className="text-sm text-ink-500">AY 2025–26 · Generated from this college’s live data</p>
          </div>
          <p className="text-right text-sm">
            Institute attendance
            <br />
            <span className="font-display text-3xl">{data?.attendanceOverall.attendancePct ?? 0}%</span>
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["Students", data?.attendanceOverall.students ?? 0],
            ["Faculty", data?.attendanceOverall.faculty ?? 0],
            ["Defaulter rows", data?.attendanceOverall.defaulters ?? 0],
            ["Classes", data?.classes.length ?? 0]
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded-xl bg-ink-50 p-3">
              <p className="text-xs uppercase text-ink-500">{k}</p>
              <p className="font-display text-2xl">{v as number}</p>
            </div>
          ))}
        </div>
        <h3 className="font-display mt-8 text-xl">Class strength</h3>
        {(data?.classes || []).length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">No classes in this college yet.</p>
        ) : (
          <ul className="mt-2 text-sm">
            {(data?.classes || []).map((c) => (
              <li key={c.name} className="flex justify-between border-b border-ink-100 py-1">
                <span>
                  {c.name} · {c.department_name}
                </span>
                <span>{c.student_count}</span>
              </li>
            ))}
          </ul>
        )}
        <h3 className="font-display mt-8 text-xl">Attendance defaulters (&lt; 75%)</h3>
        {(data?.defaulters || []).length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">No defaulter rows for this college.</p>
        ) : (
          <ul className="mt-2 text-sm">
            {(data?.defaulters || []).slice(0, 20).map((d, i) => (
              <li key={i} className="flex justify-between border-b border-ink-100 py-1">
                <span>
                  {d.name} · {d.class_name} · {d.subject}
                </span>
                <span className="text-rose-700">{d.percent}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
