"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/Shell";
import { api } from "@/lib/client";
import type { SessionUser } from "@/lib/auth";

type Notice = { id: string; title: string; body: string; audience: string; pinned: number; author_name: string; created_at: string };

export default function NoticesPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<Notice[]>([]);
  const [form, setForm] = useState({ title: "", body: "", audience: "ALL", pinned: false });

  async function load() {
    try {
      setRows(await api<Notice[]>("/api/notices"));
    } catch {
      setRows([]);
    }
  }
  useEffect(() => {
    api<{ user: SessionUser }>("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => {});
    load();
  }, []);

  return (
    <div>
      <PageHeader kicker="Circulars" title="Notice board" />
      {user?.role !== "STUDENT" ? (
        <div className="mb-6 space-y-3 rounded-2xl border border-ink-100 bg-white p-4">
          <input className="field" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea className="field" rows={3} placeholder="Body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <div className="flex flex-wrap gap-3">
            <select className="field max-w-xs" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
              {["ALL", "FACULTY", "STUDENT", "HOD"].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
              Pin to top
            </label>
            <button
              className="btn-accent"
              onClick={async () => {
                await api("/api/notices", { method: "POST", body: JSON.stringify(form) });
                setForm({ title: "", body: "", audience: "ALL", pinned: false });
                load();
              }}
            >
              Publish
            </button>
          </div>
        </div>
      ) : null}
      <div className="space-y-3">
        {rows.map((n) => (
          <article key={n.id} className="rounded-2xl border border-ink-100 bg-white p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-xl">{n.title}</h3>
              {n.pinned ? <span className="badge bg-gold-400/40 text-ink-900">Pinned</span> : null}
            </div>
            <p className="mt-2 text-sm text-ink-700">{n.body}</p>
            <p className="mt-3 text-xs text-ink-500">
              {n.audience} · {n.author_name} · {n.created_at}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
