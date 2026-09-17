"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ShieldCheck, TriangleAlert } from "lucide-react";
import { api } from "@/lib/client";
import { AuthShell, ConfirmationPanel } from "@/components/AuthShell";
import { Button, Field, Input } from "@/components/ui";

function ResetForm() {
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const tooShort = password.length > 0 && password.length < 6;
  const mismatch = confirm.length > 0 && confirm !== password;

  async function save() {
    setError("");
    if (password.length < 6) return setError("Choose a password with at least 6 characters.");
    if (password !== confirm) return setError("Both passwords must match.");

    setLoading(true);
    try {
      await api("/api/auth/reset", { method: "POST", body: JSON.stringify({ token, password }) });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update the password");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <AuthShell eyebrow="Password reset" title="Password updated">
        <ConfirmationPanel
          title="You're all set"
          message="Your new password is active. Sign in with it now — your attendance, marks and assignments are waiting."
        >
          <a href="/login" className="btn btn-primary">
            <CheckCircle2 className="h-4 w-4" /> Go to sign in
          </a>
        </ConfirmationPanel>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Password reset"
      title="Choose a new password"
      subtitle="Pick something only you know. You'll use it every time you sign in."
    >
      <div className="mb-5">
        {token ? (
          <span className="badge badge-success">
            <ShieldCheck className="h-3.5 w-3.5" /> Reset token verified
          </span>
        ) : (
          <span className="badge badge-warning">
            <TriangleAlert className="h-3.5 w-3.5" /> No reset token in this link
          </span>
        )}
      </div>

      {!token ? (
        <p className="mb-5 rounded-xl border border-warning/40 bg-warning/[0.08] p-3 text-[12.5px] leading-relaxed text-warning">
          This page should be opened from the link in your reset flow. Request a fresh link and try again.
        </p>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-4"
      >
        <Field label="New password" htmlFor="reset-password" error={tooShort ? "Use at least 6 characters." : undefined}>
          <Input
            id="reset-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            aria-invalid={tooShort}
            required
          />
        </Field>

        <Field label="Confirm password" htmlFor="reset-confirm" error={mismatch ? "Passwords don't match." : undefined}>
          <Input
            id="reset-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            aria-invalid={mismatch}
            required
          />
        </Field>

        {error ? (
          <p className="text-[13px] text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" loading={loading} disabled={!token} className="w-full py-3">
          {loading ? "Saving…" : "Save password"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ResetPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
