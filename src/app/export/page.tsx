"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardCopy, Download, Eye, FileCode2, GraduationCap, Terminal } from "lucide-react";
import { AmbientGlows, DashedClouds, Button, Card, SectionTitle } from "@/components/ui";

const POWERSHELL_SNIPPET = `cd C:\\Users\\User\\OneDrive\\Attachments\\Desktop\\VIT-Academic-Monitoring-Portal-LIVE
npm.cmd install
npm.cmd run dev`;

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
    <div className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-8">
      <AmbientGlows />
      <DashedClouds />

      <div className="relative mx-auto max-w-4xl">
        <Link href="/" className="mb-6 inline-flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-grad-violet shadow-glow-violet">
            <GraduationCap className="h-5 w-5 text-white" />
          </span>
          <div>
            <p className="text-[15px] font-semibold leading-tight text-white">Academic Monitoring Portal</p>
            <p className="text-[10px] uppercase tracking-[1.6px] text-ink-400">Deployment helper</p>
          </div>
        </Link>

        <div className="glass p-6 sm:p-7">
          <p className="eyebrow">PowerShell export</p>
          <h1 className="mt-1.5 text-[clamp(22px,4vw,30px)] font-semibold text-white">Copy script — full latest project</h1>
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-600">
            Includes teacher contact on parent emails, the Postgres URL, SMTP settings and all latest fixes. Overwrites code in{" "}
            <code className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[12px] text-violet-800">
              C:\Users\User\OneDrive\Attachments\Desktop\VIT-Academic-Monitoring-Portal-LIVE
            </code>
            . Does <strong className="text-white">not</strong> delete{" "}
            <code className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[12px] text-violet-800">data\academic.db</code>.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={copy} disabled={busy}>
              <ClipboardCopy className="h-4 w-4" />
              {busy ? "Working…" : "Copy script"}
            </Button>
            <Button variant="ghost" onClick={show} disabled={busy}>
              <Eye className="h-4 w-4" /> Show script
            </Button>
            <a
              href="/write-portal.ps1"
              download="write-portal.ps1"
              className="btn btn-ghost"
              title="Download write-portal.ps1 directly"
            >
              <Download className="h-4 w-4" /> Open raw .ps1
            </a>
            <Link href="/" className="btn btn-quiet">
              <ArrowLeft className="h-4 w-4" /> Back to portal
            </Link>
          </div>

          {msg ? (
            <p className="mt-4 text-[13px] text-violet-800" role="status">
              {msg}
            </p>
          ) : null}
        </div>

        {/* runbook */}
        <Card className="mt-6">
          <SectionTitle
            eyebrow="Runbook"
            title="Apply it on your machine"
            hint="Five steps, in order. Run PowerShell as your normal user."
          />
          <ol className="space-y-4">
            {[
              { n: "1", t: "Click Copy script", d: "Or use Show script → Ctrl+A, Ctrl+C." },
              { n: "2", t: "Open Notepad and paste", d: "Save as write-portal.ps1 with file type set to All files." },
              { n: "3", t: "Right-click the file → Run with PowerShell", d: "It rewrites the project code in place." },
              {
                n: "4",
                t: "Install and start",
                d: "Run the two commands below in the project folder.",
                code: POWERSHELL_SNIPPET
              },
              { n: "5", t: "Open http://localhost:3000", d: "Sign in with your college account." }
            ].map((s) => (
              <li key={s.n} className="flex gap-3.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-grad-violet text-[12px] font-bold text-white shadow-glow-violet">
                  {s.n}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-white">{s.t}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-600">{s.d}</p>
                  {s.code ? (
                    <pre className="mt-2.5 overflow-x-auto rounded-xl border border-white/[0.07] bg-[#14141D] p-3 text-[11.5px] leading-relaxed text-violet-800">
                      <Terminal className="mb-1 inline h-3.5 w-3.5" /> {s.code}
                    </pre>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </Card>

        {script ? (
          <Card className="mt-6">
            <SectionTitle
              eyebrow="Script"
              title="write-portal.ps1"
              action={<span className="badge badge-violet">{script.split("\n").length} lines</span>}
            />
            <div className="flex items-center gap-2 pb-2 text-[12px] text-ink-400">
              <FileCode2 className="h-3.5 w-3.5" /> Read-only — select all and copy
            </div>
            <textarea
              className="field h-[420px] w-full font-mono text-[11px] leading-relaxed"
              value={script}
              readOnly
              aria-label="PowerShell script contents"
            />
          </Card>
        ) : null}
      </div>
    </div>
  );
}
