"use client";

import { useState } from "react";
import { getToken } from "@/lib/client";

export function FileOpen({
  href,
  label,
  className
}: {
  href: string;
  label: string;
  className?: string;
}) {
  const [viewer, setViewer] = useState<{ url: string; type: string; name: string } | null>(null);
  const [err, setErr] = useState("");

  async function open(downloadOnly = false) {
    setErr("");
    const token = getToken();
    const url = href.includes("access_token=") || !token ? href : href + (href.includes("?") ? "&" : "?") + "access_token=" + encodeURIComponent(token);
    const res = await fetch(url, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}`, "X-Amp-Token": token } : {}
    });
    if (!res.ok) {
      setErr("Could not open file");
      return;
    }
    const blob = await res.blob();
    const type = blob.type || "application/octet-stream";
    const objectUrl = URL.createObjectURL(blob);
    const name = (res.headers.get("content-disposition") || "").match(/filename="?([^"]+)"?/)?.[1] || "file";
    if (!downloadOnly && (type.includes("pdf") || type.startsWith("image/"))) {
      setViewer({ url: objectUrl, type, name });
      return;
    }
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
  }

  return (
    <>
      <span className="inline-flex flex-wrap items-center gap-2">
        <button type="button" className={className || "text-sm font-semibold text-brand-700 underline"} onClick={() => open(false)}>
          {label}
        </button>
        <button type="button" className="text-xs text-ink-500 underline" onClick={() => open(true)}>
          Download
        </button>
        {err ? <span className="text-xs text-rose-700">{err}</span> : null}
      </span>
      {viewer ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/70 p-4">
          <div className="mb-2 flex items-center gap-3 text-white">
            <p className="font-medium">{viewer.name}</p>
            <button className="btn-accent ml-auto" type="button" onClick={() => open(true)}>
              Download
            </button>
            <button
              className="btn-ghost bg-white"
              type="button"
              onClick={() => {
                URL.revokeObjectURL(viewer.url);
                setViewer(null);
              }}
            >
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl bg-white">
            {viewer.type.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewer.url} alt={viewer.name} className="mx-auto max-h-full" />
            ) : (
              <iframe title={viewer.name} src={viewer.url} className="h-full w-full" />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
