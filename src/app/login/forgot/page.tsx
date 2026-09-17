"use client";

import { useState } from "react";
import { api } from "@/lib/client";

export default function ForgotPage() {
  const [login, setLogin] = useState("12312939");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-3xl">Reset student password</h1>
      <p className="mt-2 text-sm text-ink-600">Enter college email or PRN. First login password is your email.</p>
      <input className="field mt-4" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="PRN or email" />
      <button
        className="btn-accent mt-3 w-full"
        onClick={async () => {
          setError("");
          setMsg("");
          try {
            const r = await api<{ hint: string; token?: string }>("/api/auth/forgot", {
              method: "POST",
              body: JSON.stringify({ login })
            });
            setMsg(r.hint + (r.token ? ` Token: ${r.token}` : ""));
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed");
          }
        }}
      >
        Request reset
      </button>
      {msg ? <p className="mt-3 text-sm text-brand-700">{msg}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      <a className="mt-6 inline-block text-sm text-brand-700" href="/login">
        Back to sign in
      </a>
    </div>
  );
}
