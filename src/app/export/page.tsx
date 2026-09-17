"use client";

import { useState } from "react";

export default function ExportPage() {
  const [script, setScript] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadScript() {
    const r = await fetch("/write-portal.ps1");
    if (!r.ok) throw new Error("Could not load script");
    return r.text();
  }

  async function copy() {
    setBusy(true);
    setMsg("");
    try {
      const text = script || (await loadScript());
      setScript(text);
      await navigator.clipboard.writeText(text);
      setMsg("Copied. Notepad → Paste → Save as write-portal.ps1 (All files) on Desktop.");
    } catch {
      setMsg("Clipboard blocked. Click Show script, then Ctrl+A, Ctrl+C.");
    } finally {
      setBusy(false);
    }
  }

  async function show() {
    setBusy(true);
    setMsg("");
    try {
      setScript(await loadScript());
      setMsg("Select all in the box (Ctrl+A) then copy (Ctrl+C).");
    } catch {
      setMsg("Could not load script.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-3xl">Copy script — full latest project</h1>
      <p className="mt-2 text-sm text-ink-600">
        Includes teacher contact on parent emails, Postgres URL, SMTP, and all latest fixes. Overwrites code in{" "}
        <code>C:\Users\User\OneDrive\Attachments\Desktop\VIT-Academic-Monitoring-Portal-LIVE</code>. Does{" "}
        <strong>not</strong> delete <code>data\academic.db</code>.
      </p>
      <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-ink-700">
        <li>Click Copy script (or Show script → Ctrl+A, Ctrl+C).</li>
        <li>
          Notepad → Paste → Save as <code>write-portal.ps1</code>, type All files.
        </li>
        <li>Right-click → Run with PowerShell.</li>
        <li>
          Then:
          <pre className="mt-1 rounded-lg bg-ink-950 p-3 text-[11px] text-white">{`cd C:\\Users\\User\\OneDrive\\Attachments\\Desktop\\VIT-Academic-Monitoring-Portal-LIVE
npm.cmd install
npm.cmd run dev`}</pre>
        </li>
        <li>Open http://localhost:3000</li>
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn-accent" type="button" disabled={busy} onClick={copy}>
          {busy ? "Working…" : "Copy script"}
        </button>
        <button className="btn-ghost" type="button" disabled={busy} onClick={show}>
          Show script
        </button>
      </div>
      {msg ? <p className="mt-2 text-sm text-brand-700">{msg}</p> : null}
      {script ? (
        <textarea
          className="mt-4 h-[420px] w-full rounded-xl border border-ink-200 p-2 font-mono text-[10px]"
          value={script}
          readOnly
        />
      ) : null}
    </div>
  );
}
