"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/Shell";
import { api } from "@/lib/client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SessionUser } from "@/lib/auth";
import { BookOpen, CalendarDays, ClipboardList, Bell } from "lucide-react";

type CollegeCard = {
  id: string;
  code: string;
  name: string;
  admin_count: number;
  student_count: number;
  faculty_count: number;
  dept_count: number;
};

type Stats = {
  super?: boolean;
  colleges?: CollegeCard[];
  students: number;
  faculty: number;
  classes: number;
  subjects: number;
  attendancePct: number;
  defaulters: number;
  notices: number;
  byDept: { name: string; c: number }[];
  recentNotices: { id: string; title: string; body: string; created_at: string }[];
  mine: { attendancePct?: number; avg?: number; subjects?: number; assessments?: number; mySubjects?: number; mentees?: number };
};

type Analytics = {
  departments: { code: string; name: string }[];
  attendancePct: number;
  progressPct: number;
  students: number;
  defaulters: number;
  divisionChart: { name: string; attendance: number; progress: number }[];
  branchChart: { name: string; attendance: number; progress: number }[];
};

function Ring({ pct, label }: { pct: number; label: string }) {
  const p = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const r = 34;
  const c = 2 * Math.PI * r;
  const dash = (p / 100) * c;
  return (
    <div className="flex items-center gap-4">
      <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#e8eef6" strokeWidth="8" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke={p >= 75 ? "#1c887a" : p >= 60 ? "#d4a84b" : "#be123c"}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <div>
        <p className="font-display text-3xl leading-none">{p}%</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-ink-500">{label}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [branch, setBranch] = useState("");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => {
    api<{ user: SessionUser }>("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => {});
    api<Stats>("/api/stats")
      .then(setStats)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user || (user.role !== "COLLEGE_ADMIN" && user.role !== "HOD" && !(user.role === "ADMIN" && user.collegeId))) return;
    api<Analytics>(`/api/analytics${branch ? `?branch=${branch}` : ""}`)
      .then(setAnalytics)
      .catch(() => {});
  }, [user, branch]);

  const isMainAdmin = user?.role === "ADMIN" && !user.collegeId;
  const isAdminDesk = user?.role === "COLLEGE_ADMIN" || user?.role === "HOD" || (!!user?.collegeId && user.role === "ADMIN");
  const isStudent = user?.role === "STUDENT";

  const cards = isStudent
    ? [
        ["My attendance", `${stats?.mine.attendancePct ?? "–"}%`],
        ["Assessment average", `${stats?.mine.avg ?? "–"}%`],
        ["Subjects", stats?.mine.subjects ?? "–"],
        ["Tests recorded", stats?.mine.assessments ?? "–"]
      ]
    : isMainAdmin
      ? [
          ["Colleges", stats?.colleges?.length ?? "–"],
          ["College admins", (stats?.colleges || []).reduce((s, c) => s + Number(c.admin_count || 0), 0)],
          ["Students (all)", stats?.students ?? "–"],
          ["Faculty (all)", stats?.faculty ?? "–"]
        ]
      : isAdminDesk
        ? [
            ["Students", analytics?.students ?? "–"],
            ["Attendance", `${analytics?.attendancePct ?? "–"}%`],
            ["Progress (UT avg)", `${analytics?.progressPct ?? "–"}%`],
            ["Classes", stats?.classes ?? "–"]
          ]
        : [
            ["Students", stats?.students ?? "–"],
            ["Faculty", stats?.faculty ?? "–"],
            ["Institute attendance", `${stats?.attendancePct ?? "–"}%`],
            ["Defaulter rows", stats?.defaulters ?? "–"]
          ];

  const chartData = branch ? analytics?.divisionChart || [] : analytics?.branchChart || [];

  return (
    <div>
      <PageHeader
        kicker={isMainAdmin ? "Platform" : user?.collegeName || "Academic year 2025–26"}
        title={user ? `Good day, ${user.name.split(" ")[0]}` : "Overview"}
        hint={
          isMainAdmin
            ? "You manage colleges and their admins. Each college admin signs in separately and runs only their campus."
            : isStudent
              ? "Your attendance, internals and notices — only your college."
              : isAdminDesk
                ? "Select a branch to view attendance and academic progress for your college."
                : user?.collegeName
                  ? `${user.collegeName} — academic monitoring.`
                  : "Academic monitoring desk."
        }
        action={
          isAdminDesk ? (
            <select className="field max-w-xs" value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">Overall — all branches</option>
              {(analytics?.departments || []).map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          ) : null
        }
      />

      <div className="amp-fade grid gap-4 md:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={String(label)} className="amp-card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-500">{label}</p>
            <p className="font-display mt-2 text-3xl text-ink-900">{value}</p>
          </div>
        ))}
      </div>

      {isStudent ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          <div className="amp-card p-6 lg:col-span-3">
            <h2 className="font-display text-xl">Your standing</h2>
            <p className="mt-1 text-sm text-ink-500">75% attendance is the institute minimum.</p>
            <div className="mt-6 flex flex-wrap gap-10">
              <Ring pct={Number(stats?.mine.attendancePct || 0)} label="Attendance" />
              <Ring pct={Number(stats?.mine.avg || 0)} label="Internals" />
            </div>
            <div className="mt-8 grid gap-2 sm:grid-cols-2">
              {[
                { href: "/app/attendance", icon: ClipboardList, label: "View attendance" },
                { href: "/app/marks", icon: BookOpen, label: "My assessments" },
                { href: "/app/homework", icon: ClipboardList, label: "Assignments" },
                { href: "/app/timetable", icon: CalendarDays, label: "Timetable" }
              ].map((q) => (
                <Link
                  key={q.href}
                  href={q.href}
                  className="flex items-center gap-3 rounded-xl border border-ink-100 bg-ink-50/80 px-4 py-3 text-sm font-medium hover:border-brand-400 hover:bg-white"
                >
                  <q.icon className="h-4 w-4 text-brand-700" />
                  {q.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="amp-card p-6 lg:col-span-2">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gold-600" />
              <h2 className="font-display text-xl">Notices</h2>
            </div>
            <ul className="mt-4 space-y-3">
              {(stats?.recentNotices || []).map((n) => (
                <li key={n.id} className="rounded-xl border border-ink-100 bg-ink-50 p-3">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-600">{n.body}</p>
                </li>
              ))}
              {(stats?.recentNotices || []).length === 0 ? (
                <li className="text-sm text-ink-500">No notices yet.</li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : isMainAdmin ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(stats?.colleges || []).map((c) => (
            <a key={c.id} href="/app/colleges" className="amp-card p-5 transition hover:-translate-y-0.5">
              <p className="text-xs uppercase tracking-wide text-brand-700">{c.code}</p>
              <p className="font-display mt-1 text-xl">{c.name}</p>
              <p className="mt-3 text-sm text-ink-600">
                {c.admin_count} admin · {c.dept_count} depts · {c.faculty_count} faculty · {c.student_count} students
              </p>
            </a>
          ))}
          <a href="/app/colleges" className="rounded-2xl border border-dashed border-ink-200 bg-white/70 p-5 text-sm text-ink-600">
            + Add another college and its admin
          </a>
        </div>
      ) : isAdminDesk ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="amp-card p-5">
            <h2 className="font-display text-xl">Attendance {branch ? `· ${branch} by division` : "· by branch"}</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8eef6" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="attendance" name="Attendance %" fill="#1c887a" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="amp-card p-5">
            <h2 className="font-display text-xl">Academic progress {branch ? `· ${branch} by division` : "· by branch"}</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8eef6" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="progress" name="UT average %" fill="#b8882d" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          <div className="amp-card p-5 lg:col-span-3">
            <h2 className="font-display text-xl">Enrolment by department</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.byDept || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8eef6" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="c" fill="#1c887a" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="amp-card p-5 lg:col-span-2">
            <h2 className="font-display text-xl">Pinned & recent notices</h2>
            <ul className="mt-4 space-y-3">
              {(stats?.recentNotices || []).map((n) => (
                <li key={n.id} className="rounded-xl bg-ink-50 p-3">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-600">{n.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
