"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, KeyRound } from "lucide-react";
import { api } from "@/lib/client";
import { AuthShell, ConfirmationPanel } from "@/components/AuthShell";
import { Button, Field, Input } from "@/components/ui";

export default function ForgotPage() {
  const [login, setLogin] = useState("12312939");
  const [msg, setMsg] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function request() {
    setError("");
    setMsg("");
    setLoading(true);
    try {
      const r = await api<{ hint: string; token?: string }>("/api/auth/forgot", {
        method: "POST",
        body: JSON.stringify({ login })
      });
      setMsg(r.hint);
      setToken(r.token || "");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to request a reset");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthShell eyebrow="Password reset" title="Check your email">
        <ConfirmationPanel
          title="Reset link generated"
          message={
            msg ||
            "If that PRN or email belongs to a student account, a reset link is on its way. The link expires shortly, so use it soon."
          }
        >
          {token ? (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-left">
              <p className="eyebrow mb-1.5">Demo reset token</p>
              <code className="block break-all text-[12px] text-violet-800">{token}</code>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {token ? (
              <Link href={`/login/reset?token=${encodeURIComponent(token)}`} className="btn btn-primary">
                Continue to new password <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
            <button onClick={() => setDone(false)} className="btn btn-ghost">
              Use a different PRN
            </button>
          </div>
        </ConfirmationPanel>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Password reset"
      title="Reset student password"
      subtitle="Enter the student's college email or PRN. Their first password is their email."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          request();
        }}
        className="space-y-4"
      >
        <Field label="PRN or college email" htmlFor="forgot-login">
          <Input
            id="forgot-login"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="e.g. 12312939 or you@yourcollege.edu"
            autoComplete="username"
            required
          />
        </Field>

        {error ? (
          <p className="text-[13px] text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" loading={loading} className="w-full py-3">
          {loading ? "Requesting…" : "Request reset link"}
          {!loading ? <KeyRound className="h-4 w-4" /> : null}
        </Button>
      </form>

      <p className="mt-4 text-[12px] leading-relaxed text-ink-400">
        Student accounts only. Faculty and administrators should ask their college admin to reset a password.
      </p>
    </AuthShell>
  );
}
