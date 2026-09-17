"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type SearchOption = { id: string; label: string; hint?: string };

export function SearchSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Type to search…"
}: {
  label?: string;
  value: string;
  onChange: (id: string) => void;
  options: SearchOption[];
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(t) || (o.hint || "").toLowerCase().includes(t) || o.id.toLowerCase().includes(t)
    );
  }, [options, q]);

  useEffect(() => {
    if (!open) setQ(selected?.label || "");
  }, [selected?.label, open, value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={wrap} className="relative">
      {label ? <label className="label">{label}</label> : null}
      <input
        className="field"
        value={open ? q : selected?.label || q}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => {
          setOpen(true);
          setQ("");
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
      />
      {open ? (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-ink-100 bg-white py-1 shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-500">
              {options.length === 0 ? "Nothing allotted yet" : "No match"}
            </li>
          ) : (
            filtered.map((o) => (
              <li key={o.id || "all"}>
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-brand-50 ${o.id === value ? "bg-brand-50 font-medium" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(o.id);
                    setQ(o.label);
                    setOpen(false);
                  }}
                >
                  <span className="block">{o.label}</span>
                  {o.hint ? <span className="block text-[11px] text-ink-400">{o.hint}</span> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
