"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { ArrowRight, Building2, GraduationCap, LockKeyhole, Mail, Shield, Users } from "lucide-react";
import { api, setToken } from "@/lib/client";
import { AmbientGlows, DashedClouds, Connector, MiniCard, StatRing, Button } from "@/components/ui";

const demos = [
  { role: "Main administrator", email: "admin@amp.edu", password: "Admin@123", note: "Adds colleges & college admins" },
  { role: "VIT college admin", email: "admin@vit.edu", password: "Admin@123", note: "Manages VIT data only" },
  { role: "Faculty · CE", email: "faculty@vit.edu", password: "Faculty@123", note: "VIT faculty desk" },
  { role: "Student", email: "student@vit.edu", password: "student@vit.edu", note: "First login = email" }
];

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api<{ user: { role: string; collegeId?: string }; token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      if (!res.token) throw new Error("No session token returned");
      setToken(res.token);
      const dest =
        res.user.role === "ADMIN" && !res.user.collegeId
          ? "/app/colleges"
          : res.user.role === "FACULTY" || res.user.role === "HOD"
            ? "/app/desk"
            : "/app";
      window.location.href = dest;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <AmbientGlows />
      <DashedClouds />

      {/* ------------------------------------------------ brand panel */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-white/[0.07] bg-elevated px-12 py-12 lg:flex">
        <div className="pointer-events-none absolute -left-20 -top-24 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(123,63,228,0.30),transparent_66%)] blur-[64px]" />
        <div className="pointer-events-none absolute -bottom-24 right-[-80px] h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(244,63,94,0.22),transparent_66%)] blur-[64px]" />

        <div className="relative">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-grad-violet shadow-glow-violet">
              <GraduationCap className="h-6 w-6 text-white" />
            </span>
            <div>
              <p className="text-[17px] font-semibold leading-tight text-white">Academic Monitoring Portal</p>
              <p className="text-[10px] uppercase tracking-[1.8px] text-ink-400">Multi-college platform</p>
            </div>
          </Link>

          <h1 className="mt-14 max-w-md text-[clamp(30px,4vw,44px)] font-bold leading-[1.1] tracking-[-0.5px] text-white">
            One sign-in.
            <br />
            Many colleges.
            <br />
            <span className="grad-text">Each campus runs itself.</span>
          </h1>

          <p className="mt-5 max-w-md text-[14px] leading-[1.75] text-ink-600">
            The main administrator adds a college and its admin. That college admin then manages only their own students,
            faculty, attendance and marks.
          </p>
        </div>

        <div className="relative mt-10">
          <div className="mb-4 flex items-center gap-4">
            <StatRing value={87} size={96} sublabel="attendance" />
            <Connector length={46} className="left-[104px] top-[58%]" />
            <MiniCard title="Live" className="w-[190px]">
              <p className="text-[13px] font-semibold text-white">CE · Div A</p>
              <p className="mt-1 text-[11.5px] text-ink-600">92 of 105 marked today</p>
            </MiniCard>
          </div>

          <ul className="space-y-3">
            {[
              { icon: Shield, title: "Main admin", body: "Creates colleges and college admins." },
              { icon: Building2, title: "College admin", body: "Owns one campus end to end." },
              { icon: Users, title: "Faculty & students", body: "Only their own college's data." }
            ].map((item) => (
              <li key={item.title} className="flex gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-grad-violet-soft text-violet-800">
                  <item.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[13.5px] font-semibold text-white">{item.title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-600">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* ------------------------------------------------ form panel */}
      <main className="relative flex items-center px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-grad-violet shadow-glow-violet">
              <GraduationCap className="h-5 w-5 text-white" />
            </span>
            <div>
              <p className="text-[15px] font-semibold leading-tight text-white">Academic Monitoring Portal</p>
              <p className="text-[10px] uppercase tracking-[1.6px] text-ink-400">Sign in</p>
            </div>
          </Link>

          <div className="glass p-6 sm:p-7">
            <p className="eyebrow">Portal access</p>
            <h2 className="mt-1.5 text-[26px] font-semibold text-white">Sign in</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-600">
              Use the account issued for your college. Students: first password is your email.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label className="label" htmlFor="login-email">
                  Email or PRN
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    id="login-email"
                    className="field field-icon"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@college.edu"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="login-password">
                  Password
                </label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    id="login-password"
                    className="field field-icon"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              {error ? (
                <p className="text-[13px] text-danger" role="alert">
                  {error}
                </p>
              ) : null}

              <Button type="submit" loading={loading} className="w-full py-3">
                {loading ? "Signing in…" : "Enter portal"}
                {!loading ? <ArrowRight className="h-4 w-4" /> : null}
              </Button>

              <Link href="/login/forgot" className="block text-center text-[13px] text-violet-800 transition hover:underline">
                Forgot password (students)
              </Link>
            </form>
          </div>

          <div className="mt-5">
            <p className="eyebrow mb-2.5">Demo desks — tap to fill</p>
            <div className="space-y-2">
              {demos.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(d.password);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 text-left transition duration-200 hover:border-violet/40 hover:bg-white/[0.06]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-white">{d.role}</span>
                    <span className="block truncate text-[11.5px] text-ink-400">{d.note}</span>
                  </span>
                  <span className="shrink-0 truncate text-[11.5px] text-ink-400">{d.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export function LoginScreen() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
