"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client";

function ResetForm() {
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-3xl">New password</h1>
      <input className="field mt-4" type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button
        className="btn-accent mt-3 w-full"
        onClick={async () => {
          setError("");
          setMsg("");
          try {
            await api("/api/auth/reset", { method: "POST", body: JSON.stringify({ token, password }) });
            setMsg("Password updated. You can sign in now.");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
          }
        }}
      >
        Save password
      </button>
      {msg ? <p className="mt-3 text-sm text-brand-700">{msg}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      <a className="mt-6 inline-block text-sm text-brand-700" href="/login">
        Sign in
      </a>
    </div>
  );
}

export default function ResetPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
