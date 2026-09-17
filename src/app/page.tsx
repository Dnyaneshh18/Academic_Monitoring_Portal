import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  BookOpen,
  Brain,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  HeartHandshake,
  School,
  Shield,
  Sparkles,
  Users
} from "lucide-react";
import { AmbientGlows, DashedClouds, Connector, MiniCard, StatRing, StatCard, Timeline } from "@/components/ui";

const FEATURES = [
  { icon: ClipboardList, title: "Attendance", body: "Mark theory and lab sessions in seconds, with instant defaulter detection against your institute's cut-off." },
  { icon: BookOpen, title: "Assessments", body: "Unit tests, assignments and term work in one ledger — per subject, per division, with weighted averages." },
  { icon: Brain, title: "Risk analysis", body: "Clusters students by attendance, marks and trends so mentors reach the right people before results drop." },
  { icon: CalendarDays, title: "Timetable", body: "Class and lab schedules wired to the divisions and batches your faculty are actually allotted." },
  { icon: BellRing, title: "Notices & alerts", body: "Circulars to the whole college, plus parent alerts for absentees and low attendance." },
  { icon: BarChart3, title: "Reports", body: "Division, subject and college-level reporting with CSV export and a light-on-white print layout." }
];

const ROLES = [
  { icon: Shield, name: "Main administrator", body: "Creates colleges and appoints each college's admin. Stays above day-to-day campus data.", tone: "violet" },
  { icon: School, name: "College admin", body: "Owns one campus end to end — students, faculty, classes, subjects, attendance, marks and reports.", tone: "coral" },
  { icon: Users, name: "Faculty & HOD", body: "Work from a personal desk: allotted classes, attendance sessions, marks entry and mentoring notes.", tone: "violet" },
  { icon: GraduationCap, name: "Students", body: "See their own attendance, results, assignments and timetable — and never anyone else's.", tone: "coral" }
] as const;

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      <AmbientGlows />
      <DashedClouds />

      {/* ---------------------------------------------------------- top bar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[rgba(28,28,39,0.72)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 sm:px-8">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-grad-violet shadow-glow-violet">
            <GraduationCap className="h-5 w-5 text-white" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-tight text-white">Academic Monitoring Portal</p>
            <p className="text-[10px] uppercase tracking-[1.6px] text-ink-400">Multi-college platform</p>
          </div>
          <nav className="ml-auto flex items-center gap-2">
            <Link href="/login" className="btn btn-ghost hidden sm:inline-flex">
              Sign in
            </Link>
            <Link href="/login" className="btn btn-primary">
              Enter portal <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </header>

      {/* -------------------------------------------------------------- hero */}
      <section className="relative mx-auto max-w-[1240px] px-4 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-violet/30 bg-violet/[0.12] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[1.5px] text-violet-800">
              <Sparkles className="h-3.5 w-3.5" /> B.Tech academic monitoring
            </span>

            <h1 className="mt-5 text-[clamp(32px,7vw,64px)] font-bold leading-[1.05] tracking-[-1px] text-white">
              One sign-in.
              <br />
              Many colleges.
              <br />
              <span className="grad-text">Each campus in control.</span>
            </h1>

            <p className="mt-5 max-w-xl text-[15px] leading-[1.75] text-ink-600">
              Attendance, assessments, assignments, mentoring and risk analytics for every branch and division — with a
              main administrator who adds colleges and college admins who run their own campus end to end.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/login" className="btn btn-primary btn-lg px-6 py-3 text-[15px]">
                Enter the portal <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="#roles" className="btn btn-ghost px-5 py-3 text-[15px]">
                See the four desks
              </Link>
            </div>

          </div>

          {/* hero visual: rings + connector lines + floating mini-cards */}
          <div className="relative mx-auto w-full max-w-[420px]">
            <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(123,63,228,0.28),transparent_68%)] blur-[52px]" />

            <div className="glass relative mx-auto flex w-full flex-col items-center gap-6 p-8">
              <p className="eyebrow">Live cohort health</p>
              <div className="flex items-center gap-5">
                <StatRing value={87} label="Attendance" sublabel="avg" size={132} />
                <StatRing value={62} label="On track" sublabel="UT avg" size={104} tone="warning" />
              </div>
              <div className="grid w-full grid-cols-2 gap-3 pt-2">
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-center">
                  <p className="text-[20px] font-bold leading-none text-white">38</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[1.2px] text-ink-400">Defaulters</p>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-center">
                  <p className="text-[20px] font-bold leading-none text-white">9</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[1.2px] text-ink-400">At risk</p>
                </div>
              </div>
            </div>

            {/* connector lines from the hub to floating cards */}
            <Connector length={64} className="left-[-52px] top-[38%] hidden sm:block" />
            <Connector length={54} coral className="bottom-[16%] right-[-46px] hidden sm:block" />

            <MiniCard title="Overdue" className="absolute -left-6 bottom-2 hidden w-[178px] sm:block">
              <p className="text-[13px] font-semibold text-white">Assignment 3 · CE-A</p>
              <p className="mt-1 text-[11.5px] text-ink-600">14 submissions pending</p>
            </MiniCard>

            <MiniCard title="Top division" className="absolute -right-4 -top-5 hidden w-[168px] sm:block">
              <p className="text-[13px] font-semibold text-white">CE · Div B</p>
              <p className="mt-1 text-[11.5px] text-ink-600">92% attendance</p>
            </MiniCard>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- features */}
      <section className="mx-auto max-w-[1240px] px-4 pb-16 sm:px-8 sm:pb-20">
        <p className="eyebrow">Everything in one place</p>
        <h2 className="mt-2 max-w-2xl text-[clamp(22px,4vw,32px)] font-semibold leading-tight text-white">
          From the first roll call to the final report card
        </h2>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="glass group p-5 transition duration-200 hover:-translate-y-1 hover:border-violet/30">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-grad-violet-soft text-violet-800">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-[17px] font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-600">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- roles */}
      <section id="roles" className="mx-auto max-w-[1240px] px-4 pb-16 sm:px-8 sm:pb-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="eyebrow">Permissions by design</p>
            <h2 className="mt-2 text-[clamp(22px,4vw,32px)] font-semibold leading-tight text-white">
              Four desks, strict boundaries
            </h2>
            <p className="mt-4 text-[14.5px] leading-[1.75] text-ink-600">
              Nobody sees more than they should. A college admin can never read another campus, and a student only ever
              sees their own record.
            </p>

            <div className="glass mt-8 p-5">
              <p className="eyebrow">Recent activity</p>
              <Timeline
                className="mt-4"
                items={[
                  { title: "Attendance marked · CE-A Physics", meta: "Prof. Amit Shah", time: "2 min ago", tone: "violet" },
                  { title: "Defaulter alert sent to 6 parents", meta: "Attendance below 75%", time: "1 hr ago", tone: "coral" },
                  { title: "UT-2 marks published · IT", meta: "Div A · 5 subjects", time: "yesterday", tone: "success" }
                ]}
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {ROLES.map((r) => (
              <article key={r.name} className="glass p-5">
                <span
                  className={
                    r.tone === "violet"
                      ? "grid h-11 w-11 place-items-center rounded-2xl bg-grad-violet text-white shadow-glow-violet"
                      : "grid h-11 w-11 place-items-center rounded-2xl bg-grad-coral text-white shadow-glow-coral"
                  }
                >
                  <r.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-[17px] font-semibold text-white">{r.name}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-600">{r.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- cta */}
      <section className="mx-auto max-w-[1240px] px-4 pb-20 sm:px-8">
        <div className="glass relative overflow-hidden p-8 text-center sm:p-12">
          <div className="pointer-events-none absolute -left-24 -top-24 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(123,63,228,0.32),transparent_66%)] blur-[64px]" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-[280px] w-[280px] rounded-full bg-[radial-gradient(circle,rgba(244,63,94,0.26),transparent_66%)] blur-[64px]" />
          <div className="relative">
            <HeartHandshake className="mx-auto h-8 w-8 text-violet-800" />
            <h2 className="mt-4 text-[clamp(22px,4vw,30px)] font-semibold text-white">Ready when your semester starts</h2>
            <p className="mx-auto mt-3 max-w-xl text-[14.5px] leading-relaxed text-ink-600">
              Sign in with the account issued by your college. Students use their email as the first password.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/login" className="btn btn-primary px-6 py-3 text-[15px]">
                Enter the portal <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ footer */}
      <footer className="border-t border-white/[0.07] px-4 py-8 sm:px-8">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-grad-violet">
              <GraduationCap className="h-4 w-4 text-white" />
            </span>
            <p className="text-[13px] text-ink-400">Academic Monitoring Portal</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
