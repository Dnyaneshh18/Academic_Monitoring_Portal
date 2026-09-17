"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/Shell";
import { api } from "@/lib/client";
import type { SessionUser } from "@/lib/auth";
import { Button, Card, Skeleton, StatRing, Timeline } from "@/components/ui";
import { FileText, Printer, ScrollText } from "lucide-react";

type ReportData = {
  classes: { name: string; student_count: number; department_name: string }[];
  faculty: { name: string; designation: string; department_name: string }[];
  defaulters: { name: string; class_name: string; subject: string; percent: number }[];
  attendanceOverall: { students: number; faculty: number; attendancePct: number; defaulters: number };
};

export default function ReportsPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    api<{ user: SessionUser }>("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => {});
    api<ReportData>("/api/reports")
      .then(setData)
      .catch(() => {});
  }, []);

  const collegeName = user?.collegeName || "College";
  const overall = data?.attendanceOverall;

  return (
    <div className="amp-fade">
      <PageHeader
        kicker="AMC pack"
        title="Academic monitoring report"
        hint="Print-ready summary for this college only."
        action={
          <div className="no-print flex flex-wrap gap-3">
            <Link href="/print/attendance" className="btn btn-ghost">
              <FileText className="h-4 w-4" /> Attendance sheet
            </Link>
            <Link href="/print/report-card" className="btn btn-ghost">
              <ScrollText className="h-4 w-4" /> Report card
            </Link>
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print / PDF
            </Button>
          </div>
        }
      />

      {/* screen-only summary — the printable document follows below */}
      <section className="no-print grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <p className="eyebrow">Overview</p>
          <h3 className="mt-1 text-section text-white">This college at a glance</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { k: overall?.students ?? 0, v: "Students" },
              { k: overall?.faculty ?? 0, v: "Faculty" },
              { k: data?.classes.length ?? 0, v: "Classes" },
              { k: overall?.defaulters ?? 0, v: "Defaulter rows" }
            ].map((s) => (
              <div key={s.v} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                <p className="eyebrow">{s.v}</p>
                <p className="mt-1.5 text-[26px] font-bold leading-none text-white">{s.k}</p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <p className="eyebrow mb-3">Class strength</p>
            {(data?.classes || []).length ? (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th>Department</th>
                      <th className="text-right">Students</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.classes || []).map((c) => (
                      <tr key={c.name}>
                        <td data-primary="true" data-label="Class">
                          <strong>{c.name}</strong>
                        </td>
                        <td data-label="Department">{c.department_name}</td>
                        <td data-label="Students" className="sm:text-right">
                          <span className="badge badge-violet">{c.student_count}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Skeleton className="h-16 w-full" />
            )}
          </div>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <p className="eyebrow">Health</p>
            <h3 className="mt-1 text-section text-white">Institute attendance</h3>
            <div className="mt-4 flex justify-center">
              <StatRing value={Number(overall?.attendancePct || 0)} label="Attendance" sublabel="avg" />
            </div>
          </Card>

          <Card>
            <p className="eyebrow mb-3">Defaulters under 75%</p>
            {(data?.defaulters || []).length ? (
              <Timeline
                items={(data?.defaulters || []).slice(0, 5).map((d, i) => ({
                  title: `${d.name} · ${d.percent}%`,
                  meta: `${d.class_name} · ${d.subject}`,
                  tone: i === 0 ? "coral" : "muted"
                }))}
              />
            ) : (
              <p className="text-[13px] text-ink-600">No defaulter rows for this college.</p>
            )}
          </Card>
        </div>
      </section>

      {/* ------------------------------------------- printable document */}
      <div className="no-print mt-8">
        <p className="eyebrow">Print preview</p>
      </div>

      <article className="paper mt-3">
        <div className="paper-accent-rule" />

        <header className="mt-6 flex flex-wrap items-start justify-between gap-4 pb-4">
          <div>
            <p className="paper-accent text-[11px] font-semibold uppercase tracking-[1.5px]">{collegeName}</p>
            <h2 className="mt-1 text-[22px] font-semibold">Academic Monitoring Committee — Snapshot</h2>
            <p className="paper-muted text-[13px]">AY 2025–26 · Generated from this college’s live data</p>
          </div>
          <p className="text-right text-[13px]">
            <span className="paper-muted">Institute attendance</span>
            <br />
            <span className="text-[28px] font-bold">{overall?.attendancePct ?? 0}%</span>
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["Students", overall?.students ?? 0],
            ["Faculty", overall?.faculty ?? 0],
            ["Defaulter rows", overall?.defaulters ?? 0],
            ["Classes", data?.classes.length ?? 0]
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded-xl bg-[#F4F2FE] p-3">
              <p className="paper-muted text-[11px] font-semibold uppercase tracking-[1.2px]">{k}</p>
              <p className="mt-1 text-[22px] font-bold">{v as number}</p>
            </div>
          ))}
        </div>

        <h3 className="mt-8 text-[17px] font-semibold">Class strength</h3>
        {(data?.classes || []).length === 0 ? (
          <p className="paper-muted mt-2 text-[13px]">No classes in this college yet.</p>
        ) : (
          <ul className="mt-2 text-[13px]">
            {(data?.classes || []).map((c) => (
              <li key={c.name} className="print-avoid-break flex justify-between border-b paper-rule py-1.5">
                <span>
                  {c.name} · <span className="paper-muted">{c.department_name}</span>
                </span>
                <span className="font-medium">{c.student_count}</span>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-8 text-[17px] font-semibold">Attendance defaulters (&lt; 75%)</h3>
        {(data?.defaulters || []).length === 0 ? (
          <p className="paper-muted mt-2 text-[13px]">No defaulter rows for this college.</p>
        ) : (
          <ul className="mt-2 text-[13px]">
            {(data?.defaulters || []).slice(0, 20).map((d, i) => (
              <li key={i} className="print-avoid-break flex justify-between border-b paper-rule py-1.5">
                <span>
                  {d.name} · <span className="paper-muted">{d.class_name}</span> ·{" "}
                  <span className="paper-muted">{d.subject}</span>
                </span>
                <span className="paper-danger font-semibold">{d.percent}%</span>
              </li>
            ))}
          </ul>
        )}

        <footer className="mt-10 flex flex-wrap items-end justify-between gap-6 border-t paper-rule pt-5 text-[11.5px]">
          <p className="paper-muted">System-generated from the Academic Monitoring Portal.</p>
          <div className="text-center">
            <div className="mb-1 h-10 w-44 border-b paper-rule" />
            <p className="paper-muted">AMC coordinator signature</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
