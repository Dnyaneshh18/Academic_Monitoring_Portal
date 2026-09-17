"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { api } from "@/lib/client";

type Row = {
  studentId: string;
  name: string;
  rollNo: string;
  className: string;
  attendancePct: number;
  marksPct: number;
  reasons: string[];
  prn?: string;
  parentEmail?: string;
};

export default function AlertsPage() {
  const [smtp, setSmtp] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [log, setLog] = useState<{ student_name: string; parent_email: string; status: string; error: string; created_at: string }[]>(
    []
  );
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState<{ to: string; subject: string; body: string } | null>(null);

  async function load() {
    const d = await api<{ smtp: boolean; students: Row[]; log: typeof log }>("/api/alerts");
    setSmtp(d.smtp);
    setRows(d.students || []);
    setLog(d.log || []);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, []);

  async function previewMail(id: string) {
    setBusy("p-" + id);
    setError("");
    try {
      const r = await api<{ to: string; subject: string; body: string }>("/api/alerts", {
        method: "POST",
        body: JSON.stringify({ studentId: id, preview: true })
      });
      setPreview({ to: r.to, subject: r.subject, body: r.body });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not preview");
    } finally {
      setBusy("");
    }
  }

  async function send(id: string) {
    setBusy(id);
    setError("");
    setMsg("");
    try {
      const r = await api<{ ok: boolean; error?: string; to: string }>("/api/alerts", {
        method: "POST",
        body: JSON.stringify({ studentId: id })
      });
      setMsg(r.ok ? `Email sent to ${r.to}` : r.error || "Not sent");
      setPreview(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <PageHeader
        kicker="ML alerts"
        title="Parent notifications"
        hint="HIGH-risk students (falling scores and/or attendance below 60%). Send a drafted email to the parent."
      />
      <p className={`mb-4 text-sm ${smtp ? "text-brand-700" : "text-warning"}`}>
        {smtp
          ? "SMTP is configured. Send will deliver a real email."
          : "SMTP is not configured yet. Click Send to preview the draft. To deliver to nvasantpatil@gmail.com, add Gmail SMTP_USER + App Password (see .env.example)."}
      </p>
      {msg ? <p className="mb-3 text-sm text-brand-700">{msg}</p> : null}
      {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Student</th>
              <th>PRN</th>
              <th>Att %</th>
              <th>Marks %</th>
              <th>Why</th>
              <th>Parent email</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.studentId}>
                <td>
                  {r.name}
                  <div className="text-[11px] text-ink-400">
                    {r.className} · Roll {r.rollNo}
                  </div>
                </td>
                <td>{r.prn}</td>
                <td className="font-semibold text-danger">{r.attendancePct}%</td>
                <td>{r.marksPct}%</td>
                <td className="text-xs">{r.reasons.join(" · ")}</td>
                <td>{r.parentEmail || "null"}</td>
                <td className="space-x-2 whitespace-nowrap">
                  <button className="btn-ghost text-xs" disabled={!!busy} onClick={() => previewMail(r.studentId)}>
                    {busy === "p-" + r.studentId ? "…" : "Preview"}
                  </button>
                  <button className="btn-accent text-xs" disabled={busy === r.studentId} onClick={() => send(r.studentId)}>
                    {busy === r.studentId ? "Sending…" : "Email parent"}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-ink-500">
                  No HIGH-risk students in your allotments.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <h2 className="font-display mt-8 text-xl">Sent log</h2>
      <div className="mt-2 table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>When</th>
              <th>Student</th>
              <th>To</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {log.map((l, i) => (
              <tr key={i}>
                <td>{l.created_at}</td>
                <td>{l.student_name}</td>
                <td>{l.parent_email}</td>
                <td>
                  {l.status}
                  {l.error ? <div className="text-xs text-danger">{l.error}</div> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
