"use client";

import { Suspense, useState } from "react";
import { Building2, GraduationCap, Shield, Users } from "lucide-react";
import { api, setToken } from "@/lib/client";

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
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-ink-950 px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(900px 420px at 10% -10%, rgba(39,169,150,0.28), transparent 55%), radial-gradient(700px 380px at 100% 100%, rgba(212,168,75,0.18), transparent 50%)"
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600">
              <GraduationCap className="h-6 w-6" />
            </span>
            <div>
              <p className="font-display text-xl leading-tight">Academic Monitoring Portal</p>
              <p className="text-[11px] uppercase tracking-[0.22em] text-gold-400">Multi-college platform</p>
            </div>
          </div>
          <h1 className="font-display mt-16 max-w-md text-[2.6rem] leading-[1.15]">
            One sign-in. Many colleges. Each campus runs itself.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70">
            The main administrator adds a college and its admin. That college admin then manages only their students,
            faculty, attendance and marks.
          </p>
        </div>
        <ul className="relative mt-10 space-y-4">
          {[
            { icon: Shield, title: "Main admin", body: "Creates colleges and college admins. Does not run day-to-day campus data." },
            { icon: Building2, title: "College admin", body: "Owns one campus — students, faculty, classes, assignments and reports." },
            { icon: Users, title: "Faculty & students", body: "Sign in to the desk of their own college only." }
          ].map((item) => (
            <li key={item.title} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <item.icon className="mt-0.5 h-5 w-5 text-gold-400" />
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="mt-1 text-sm text-white/65">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <main className="flex items-center bg-ink-50 px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-600 text-white">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-lg leading-tight text-ink-900">Academic Monitoring Portal</p>
              <p className="text-[11px] uppercase tracking-[0.22em] text-brand-700">Sign in</p>
            </div>
          </div>

          <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
            <p className="text-xs uppercase tracking-[0.25em] text-brand-700">Portal access</p>
            <h2 className="font-display mt-1 text-3xl text-ink-900">Sign in</h2>
            <p className="mt-1 text-sm text-ink-600">
              Use the account issued for your college. Students: first password is your email.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label className="label">Email or PRN</label>
                <input
                  className="field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@college.edu"
                  required
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  className="field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  required
                />
              </div>
              {error ? <p className="text-sm text-rose-700">{error}</p> : null}
              <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
                {loading ? "Signing in…" : "Enter portal"}
              </button>
              <a href="/login/forgot" className="block text-center text-sm text-brand-700 hover:underline">
                Forgot password (students)
              </a>
            </form>
          </div>

          <div className="mt-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Demo desks</p>
            {demos.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => {
                  setEmail(d.email);
                  setPassword(d.password);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-ink-100 bg-white px-3 py-2 text-left text-sm hover:border-brand-400"
              >
                <span>
                  <span className="block font-medium">{d.role}</span>
                  <span className="text-[11px] text-ink-500">{d.note}</span>
                </span>
                <span className="text-xs text-ink-500">{d.email}</span>
              </button>
            ))}
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
