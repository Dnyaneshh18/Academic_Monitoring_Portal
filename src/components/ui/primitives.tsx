"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";

/* ============================================================== Button */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "accent" | "ghost" | "quiet";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  // These must be the .btn-sm/.btn-lg classes rather than padding utilities:
  // .btn sets padding/font-size as an unlayered rule, so px-*/py-*/text-* on a
  // .btn are always overridden and the size prop would do nothing.
  const sizeCls = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";
  return (
    <button
      className={clsx(
        "btn",
        `btn-${variant}`,
        sizeCls,
        loading && "pointer-events-none opacity-70",
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
      {children}
    </button>
  );
}

/* ============================================================== Card */
export function Card({
  className,
  children,
  interactive,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={clsx(
        "glass p-5",
        interactive && "transition duration-200 hover:-translate-y-1 hover:border-violet/30",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/** GlassPanel — explicit alias for a translucent glass surface. */
export function GlassPanel({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("glass p-5", className)} {...rest}>
      {children}
    </div>
  );
}

/** Solid elevated surface for dense data regions. */
export function Panel({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("panel p-5", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  hint,
  action,
  className
}: {
  eyebrow?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("mb-4 flex flex-wrap items-end justify-between gap-3", className)}>
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h3 className="text-section text-white">{title}</h3>
        {hint ? <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-600">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* ================================================== MiniCard (3-dot window) */
export function MiniCard({
  title,
  children,
  className,
  action
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div className={clsx("mini-card", className)}>
      <div className="mini-card-bar">
        <span className="mini-dot bg-[#ff5f57]" />
        <span className="mini-dot bg-[#febc2e]" />
        <span className="mini-dot bg-[#28c840]" />
        {title ? (
          <span className="ml-2 truncate text-[11px] font-semibold uppercase tracking-[1.4px] text-ink-400">{title}</span>
        ) : null}
        {action ? <span className="ml-auto">{action}</span> : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/* ============================================================== Badges */
type Tone = "success" | "danger" | "warning" | "violet" | "coral" | "neutral";

export function Badge({
  tone = "neutral",
  children,
  className,
  icon
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span className={clsx("badge", `badge-${tone}`, className)}>
      {icon}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  present: "success",
  pass: "success",
  passed: "success",
  active: "success",
  approved: "success",
  submitted: "violet",
  graded: "success",
  absent: "danger",
  fail: "danger",
  failed: "danger",
  overdue: "danger",
  rejected: "danger",
  pending: "warning",
  late: "warning",
  "at risk": "coral",
  defaulter: "coral",
  draft: "neutral",
  inactive: "neutral"
};

/** StatusPill — never colour-only: always renders the text label. */
export function StatusPill({ status, className }: { status: string; className?: string }) {
  const key = (status || "").toLowerCase().trim();
  const tone = STATUS_TONE[key] ?? "neutral";
  return (
    <span className={clsx("badge", `badge-${tone}`, className)}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {status}
    </span>
  );
}

/* ============================================================== Fields */
export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={className}>
      {label ? (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      {children}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx("field", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx("field", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx("field", className)} {...rest}>
      {children}
    </select>
  );
}

export function DatePicker({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="date" className={clsx("field", className)} {...rest} />;
}

export function SearchInput({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={clsx("relative", className)}>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input className="field field-icon" type="search" {...rest} />
    </div>
  );
}

/* ============================================================== Tabs */
export function Tabs({
  tabs,
  value,
  onChange,
  className
}: {
  tabs: { id: string; label: string; count?: number }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={clsx("flex gap-1 overflow-x-auto border-b border-white/[0.07]", className)} role="tablist">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={clsx(
              "relative whitespace-nowrap px-4 py-2.5 text-[13.5px] font-semibold transition",
              active ? "text-white" : "text-ink-400 hover:text-ink-700"
            )}
          >
            {t.label}
            {typeof t.count === "number" ? (
              <span className="ml-2 rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] text-ink-600">{t.count}</span>
            ) : null}
            {active ? <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-grad-violet" /> : null}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================== Modal */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md"
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const width = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-xl";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[rgba(12,12,18,0.7)] p-4 backdrop-blur-[8px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={clsx("glass w-full p-6 shadow-glass", width)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-card text-white">
              {title}
            </h2>
            {description ? <p className="mt-1 text-[13px] leading-relaxed text-ink-600">{description}</p> : null}
          </div>
          <button onClick={onClose} aria-label="Close dialog" className="icon-btn shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  tone = "primary",
  busy
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: "primary" | "accent";
  busy?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={message}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

/* ============================================================== Pagination */
export function Pagination({
  page,
  pageCount,
  onPage,
  total,
  className
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
  total?: number;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  const pages: (number | "…")[] = [];
  for (let i = 1; i <= pageCount; i++) {
    if (i === 1 || i === pageCount || Math.abs(i - page) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }

  return (
    <nav className={clsx("flex flex-wrap items-center justify-between gap-3 pt-4", className)} aria-label="Pagination">
      <p className="text-[12.5px] text-ink-400">
        {typeof total === "number" ? `${total.toLocaleString()} records · ` : ""}Page {page} of {pageCount}
      </p>
      <div className="flex items-center gap-1.5">
        <button className="icon-btn" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
          ‹
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1.5 text-ink-400">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p)}
              aria-current={p === page ? "page" : undefined}
              className={clsx(
                "grid h-8 min-w-8 place-items-center rounded-full px-2.5 text-[13px] font-semibold transition",
                p === page ? "bg-grad-violet text-white shadow-glow-violet" : "text-ink-600 hover:bg-white/[0.07] hover:text-white"
              )}
            >
              {p}
            </button>
          )
        )}
        <button className="icon-btn" onClick={() => onPage(page + 1)} disabled={page >= pageCount} aria-label="Next page">
          ›
        </button>
      </div>
    </nav>
  );
}

/* ============================================================== Skeletons */
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} aria-hidden />;
}

export function CardSkeleton() {
  return (
    <div className="glass p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-8 w-32" />
      <Skeleton className="mt-4 h-10 w-full" />
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-wrap p-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-4 w-40" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4">
            {Array.from({ length: cols }).map((__, c) => (
              <Skeleton key={c} className="h-9 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <TableSkeleton />
    </div>
  );
}

/* ============================================================== EmptyState */
export function EmptyState({
  title,
  message,
  action,
  icon,
  className
}: {
  title: string;
  message?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("empty-state", className)}>
      {icon ? <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-grad-violet-soft text-violet-light">{icon}</div> : null}
      <p className="text-[15px] font-semibold text-white">{title}</p>
      {message ? <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-ink-600">{message}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/* ============================================================== misc */
export function useLocalToggle(key: string, initial = false) {
  const [value, setValue] = useState<boolean>(() => {
    if (typeof window === "undefined") return initial;
    return window.localStorage.getItem(key) === "1";
  });
  useEffect(() => {
    window.localStorage.setItem(key, value ? "1" : "0");
  }, [key, value]);
  return [value, setValue] as const;
}
