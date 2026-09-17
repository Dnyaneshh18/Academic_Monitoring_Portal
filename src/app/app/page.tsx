"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/Shell";
import { api } from "@/lib/client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SessionUser } from "@/lib/auth";
import { BookOpen, CalendarDays, ClipboardList, GraduationCap, School, Users, Brain, Bell } from "lucide-react";
import {
  Card,
  CardSkeleton,
  CHART,
  CHART_AXIS_PROPS,
  CHART_GRID_PROPS,
  CHART_TOOLTIP_STYLE,
  EmptyState,
  MiniCard,
  SectionTitle,
  StatCard,
  StatRing,
  Timeline,
  Skeleton
} from "@/components/ui";

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
  mine: {
    attendancePct?: number;
    avg?: number;
    subjects?: number;
    assessments?: number;
    mySubjects?: number;
    mentees?: number;
  };
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

function trendTone(pct: number): "up" | "down" | "flat" {
  if (pct >= 75) return "up";
  if (pct >= 60) return "flat";
  return "down";
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
  const isFaculty = user?.role === "FACULTY";

  const chartData = branch ? analytics?.divisionChart || [] : analytics?.branchChart || [];
  const attendancePct = analytics?.attendancePct ?? stats?.attendancePct ?? 0;
  const progressPct = analytics?.progressPct ?? 0;

  /* ------------------------------------------------------------ KPI row */
  const kpis = isStudent
    ? [
        {
          label: "My attendance",
          value: stats?.mine.attendancePct ?? "–",
          suffix: "%",
          ring: { value: Number(stats?.mine.attendancePct || 0) },
          trend: Number(stats?.mine.attendancePct || 0) >= 75 ? "Above 75% cut-off" : "Below 75% cut-off",
          trendTone: trendTone(Number(stats?.mine.attendancePct || 0))
        },
        {
          label: "Assessment average",
          value: stats?.mine.avg ?? "–",
          suffix: "%",
          spark: [58, 62, 66, 64, 71, Number(stats?.mine.avg || 70)],
          trend: "Internals to date",
          trendTone: "flat" as const
        },
        { label: "Subjects", value: stats?.mine.subjects ?? "–", trend: "This semester", trendTone: "flat" as const },
        { label: "Tests recorded", value: stats?.mine.assessments ?? "–", trend: "Graded so far", trendTone: "flat" as const }
      ]
    : isMainAdmin
      ? [
          {
            label: "Colleges",
            value: stats?.colleges?.length ?? "–",
            icon: <School className="h-5 w-5" />,
            trend: "On the platform",
            trendTone: "flat" as const
          },
          {
            label: "College admins",
            value: (stats?.colleges || []).reduce((s, c) => s + Number(c.admin_count || 0), 0),
            icon: <Users className="h-5 w-5" />,
            trend: "Appointed",
            trendTone: "flat" as const
          },
          {
            label: "Students (all)",
            value: stats?.students ?? "–",
            icon: <GraduationCap className="h-5 w-5" />,
            spark: [820, 940, 1010, 1180, 1260, Number(stats?.students || 1300)],
            trend: "Across all colleges",
            trendTone: "up" as const
          },
          {
            label: "Faculty (all)",
            value: stats?.faculty ?? "–",
            icon: <Users className="h-5 w-5" />,
            trend: "Teaching staff",
            trendTone: "flat" as const
          }
        ]
      : isAdminDesk
        ? [
            {
              label: "Students",
              value: analytics?.students ?? "–",
              icon: <GraduationCap className="h-5 w-5" />,
              trend: branch ? `Branch ${branch}` : "Whole college",
              trendTone: "flat" as const
            },
            {
              label: "Attendance",
              value: attendancePct,
              suffix: "%",
              ring: { value: attendancePct },
              trend: attendancePct >= 75 ? "Healthy" : "Needs attention",
              trendTone: trendTone(attendancePct)
            },
            {
              label: "Progress (UT avg)",
              value: progressPct,
              suffix: "%",
              spark: chartData.slice(0, 6).map((d) => d.progress || 0),
              trend: "Unit test average",
              trendTone: trendTone(progressPct)
            },
            {
              label: "Defaulters",
              value: analytics?.defaulters ?? "–",
              icon: <ClipboardList className="h-5 w-5" />,
              trend: "Below cut-off",
              trendTone: "down" as const
            }
          ]
        : [
            {
              label: "Students",
              value: stats?.students ?? "–",
              icon: <GraduationCap className="h-5 w-5" />,
              trend: "Enrolled",
              trendTone: "flat" as const
            },
            {
              label: "Faculty",
              value: stats?.faculty ?? "–",
              icon: <Users className="h-5 w-5" />,
              trend: "Teaching staff",
              trendTone: "flat" as const
            },
            {
              label: "Institute attendance",
              value: stats?.attendancePct ?? "–",
              suffix: "%",
              ring: { value: Number(stats?.attendancePct || 0) },
              trend: Number(stats?.attendancePct || 0) >= 75 ? "Healthy" : "Needs attention",
              trendTone: trendTone(Number(stats?.attendancePct || 0))
            },
            {
              label: "Defaulter rows",
              value: stats?.defaulters ?? "–",
              icon: <ClipboardList className="h-5 w-5" />,
              trend: "Below cut-off",
              trendTone: "down" as const
            }
          ];

  const notices = stats?.recentNotices || [];

  return (
    <div className="amp-fade">
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
            <select
              className="field max-w-xs"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              aria-label="Filter by branch"
            >
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

      {/* row 1 — four KPI cards */}
      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {!stats && !user
          ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
          : kpis.map((k) => (
              <StatCard
                key={k.label}
                label={k.label}
                value={k.value as string | number}
                suffix={"suffix" in k ? (k.suffix as string) : undefined}
                trend={k.trend}
                trendTone={k.trendTone}
                spark={"spark" in k ? (k.spark as number[]) : undefined}
                ring={"ring" in k ? (k.ring as { value: number }) : undefined}
                icon={"icon" in k ? (k.icon as React.ReactNode) : undefined}
              />
            ))}
      </section>

      {/* row 2 — area chart + ring cards */}
      <section className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <SectionTitle
            eyebrow="Trend"
            title={branch ? `${branch} by division` : isStudent ? "Your progress" : "Attendance & progress"}
            hint={
              chartData.length
                ? "Violet tracks attendance, coral tracks unit-test progress."
                : "No analytics available for this selection yet."
            }
          />

          {chartData.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                  <defs>
                    <linearGradient id="fillAttendance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.violetLight} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={CHART.violetDeep} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillProgress" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.coralLight} stopOpacity={0.42} />
                      <stop offset="100%" stopColor={CHART.coralDeep} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...CHART_GRID_PROPS} />
                  <XAxis dataKey="name" {...CHART_AXIS_PROPS} interval={0} angle={-28} textAnchor="end" height={58} />
                  <YAxis domain={[0, 100]} {...CHART_AXIS_PROPS} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ stroke: CHART.violet, strokeOpacity: 0.25 }} />
                  <Area
                    type="monotone"
                    dataKey="attendance"
                    name="Attendance %"
                    stroke={CHART.violet}
                    strokeWidth={2.5}
                    fill="url(#fillAttendance)"
                  />
                  <Area
                    type="monotone"
                    dataKey="progress"
                    name="UT average %"
                    stroke={CHART.coral}
                    strokeWidth={2.5}
                    fill="url(#fillProgress)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              title="Nothing to plot yet"
              message="Once attendance and unit tests are recorded for this selection, the trend appears here."
            />
          )}
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle eyebrow="Health" title="At a glance" />
          <div className="flex flex-wrap items-center justify-around gap-6 pt-2">
            <StatRing
              value={isStudent ? Number(stats?.mine.attendancePct || 0) : attendancePct}
              label="Attendance"
              sublabel="avg"
            />
            <StatRing
              value={isStudent ? Number(stats?.mine.avg || 0) : progressPct}
              label={isStudent ? "Internals" : "Progress"}
              sublabel="UT"
              size={110}
            />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {[
              {
                k: isStudent ? stats?.mine.subjects ?? "–" : stats?.classes ?? "–",
                v: isStudent ? "Subjects" : "Classes"
              },
              {
                k: isStudent ? stats?.mine.mentees ?? "–" : analytics?.defaulters ?? stats?.defaulters ?? "–",
                v: isStudent ? "Mentoring notes" : "Defaulters"
              }
            ].map((s) => (
              <div key={s.v} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-center">
                <p className="text-[22px] font-bold leading-none text-white">{s.k}</p>
                <p className="mt-1.5 text-[10px] uppercase tracking-[1.2px] text-ink-400">{s.v}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* row 3 — main admin college grid / student shortcuts / notices + timeline */}
      {isMainAdmin ? (
        <section className="mt-6">
          <SectionTitle eyebrow="Colleges" title="Campuses on the platform" />
          {stats?.colleges?.length ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {stats.colleges.map((c) => (
                <Card key={c.id} interactive>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="badge badge-violet">{c.code}</span>
                      <p className="mt-2 truncate text-[15px] font-semibold text-white">{c.name}</p>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {[
                      { k: c.student_count, v: "Students" },
                      { k: c.faculty_count, v: "Faculty" },
                      { k: c.dept_count, v: "Depts" }
                    ].map((s) => (
                      <div key={s.v} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-2 py-2.5">
                        <dt className="text-[9.5px] uppercase tracking-[1.1px] text-ink-400">{s.v}</dt>
                        <dd className="mt-1 text-[16px] font-bold text-white">{s.k ?? 0}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No colleges yet"
              message="Add your first college and appoint its administrator to get started."
              action={
                <Link href="/app/colleges" className="btn btn-primary">
                  <School className="h-4 w-4" /> Add a college
                </Link>
              }
            />
          )}
        </section>
      ) : isStudent ? (
        <section className="mt-6 grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <SectionTitle eyebrow="Shortcuts" title="Your desk" />
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { href: "/app/attendance", icon: ClipboardList, label: "View attendance" },
                { href: "/app/marks", icon: BookOpen, label: "My assessments" },
                { href: "/app/homework", icon: ClipboardList, label: "Assignments" },
                { href: "/app/timetable", icon: CalendarDays, label: "Timetable" }
              ].map((q) => (
                <Link
                  key={q.href}
                  href={q.href}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-[13.5px] font-medium text-ink-600 transition duration-200 hover:-translate-y-0.5 hover:border-violet/40 hover:text-white"
                >
                  <q.icon className="h-4 w-4 text-violet-800" />
                  {q.label}
                </Link>
              ))}
            </div>

            <div className="mt-6">
              <p className="eyebrow mb-3">Notices</p>
              {notices.length ? (
                <ul className="space-y-3">
                  {notices.slice(0, 4).map((n) => (
                    <li key={n.id} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5">
                      <p className="text-[13.5px] font-semibold text-white">{n.title}</p>
                      <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink-600">{n.body}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No notices yet" message="Announcements from your college will appear here." />
              )}
            </div>
          </Card>

          <div className="space-y-6 lg:col-span-2">
            <MiniCard title="Standing">
              <p className="text-[13px] font-semibold text-white">
                {Number(stats?.mine.attendancePct || 0) >= 75 ? "Above the 75% cut-off" : "Below the 75% cut-off"}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-600">
                Institute minimum attendance is 75%. Keep an eye on subjects where you are close to the line.
              </p>
            </MiniCard>

            <Card>
              <SectionTitle eyebrow="Activity" title="Recent" />
              <Timeline
                items={notices.slice(0, 4).map((n, i) => ({
                  title: n.title,
                  meta: n.body?.slice(0, 70),
                  tone: i === 0 ? "violet" : "muted"
                }))}
              />
            </Card>
          </div>
        </section>
      ) : (
        <section className="mt-6 grid gap-6 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <SectionTitle
              eyebrow="By department"
              title="Enrolment distribution"
              hint="Students registered per department in this college."
            />
            {stats?.byDept?.length ? (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th className="text-right">Students</th>
                      <th className="text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byDept.map((d) => {
                      const total = stats.byDept.reduce((s, x) => s + Number(x.c || 0), 0) || 1;
                      const share = Math.round((Number(d.c || 0) / total) * 100);
                      return (
                        <tr key={d.name}>
                          <td data-primary="true" data-label="Department">
                            <strong>{d.name}</strong>
                          </td>
                          <td data-label="Students" className="sm:text-right">
                            {d.c}
                          </td>
                          <td data-label="Share" className="sm:text-right">
                            <span className="badge badge-violet">{share}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No enrolment data" message="Departments appear once students are added." />
            )}
          </Card>

          <Card className="lg:col-span-2">
            <SectionTitle eyebrow="Activity" title="Latest notices" />
            {notices.length ? (
              <Timeline
                items={notices.slice(0, 5).map((n, i) => ({
                  title: n.title,
                  meta: n.body?.slice(0, 72),
                  tone: i === 0 ? "violet" : i === 1 ? "coral" : "muted"
                }))}
              />
            ) : (
              <EmptyState title="No notices yet" message="Published circulars show up here." />
            )}
          </Card>
        </section>
      )}

      {isFaculty ? (
        <section className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "My subjects", value: stats?.mine.mySubjects ?? "–", icon: <BookOpen className="h-5 w-5" /> },
            { label: "Mentees", value: stats?.mine.mentees ?? "–", icon: <Brain className="h-5 w-5" /> },
            { label: "Classes", value: stats?.classes ?? "–", icon: <School className="h-5 w-5" /> },
            { label: "Notices", value: stats?.notices ?? "–", icon: <Bell className="h-5 w-5" /> }
          ].map((s) => (
            <Card key={s.label} interactive className="flex items-center gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-grad-violet-soft text-violet-800">
                {s.icon}
              </span>
              <div>
                <p className="eyebrow">{s.label}</p>
                <p className="mt-1 text-[24px] font-bold leading-none text-white">{s.value}</p>
              </div>
            </Card>
          ))}
        </section>
      ) : null}

      {!stats && user ? (
        <section className="mt-6">
          <Skeleton className="h-40 w-full" />
        </section>
      ) : null}
    </div>
  );
}
