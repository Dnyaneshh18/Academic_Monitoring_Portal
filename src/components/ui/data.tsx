"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { CHART } from "./tokens";
import { Card } from "./primitives";

/* ============================================================ StatRing */
/**
 * Circular gradient progress ring — 10px stroke, rounded caps, dark inner
 * disc, big number centered. Violet for healthy metrics, coral for at-risk.
 */
export function StatRing({
  value,
  max = 100,
  size = 132,
  label,
  sublabel,
  tone,
  className
}: {
  value: number;
  max?: number;
  size?: number;
  label?: string;
  sublabel?: string;
  tone?: "violet" | "coral" | "success" | "warning";
  className?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const accent = max > 0 && value <= max * 0.25 ? "coral" : tone ?? "violet";
  const gid = `ring-${accent}-${Math.round(size)}`;

  const stops: Record<string, [string, string]> = {
    violet: CHART.gradViolet,
    coral: CHART.gradCoral,
    success: CHART.gradSuccess,
    warning: ["#D97706", CHART.warning]
  };
  const [from, to] = stops[accent];

  return (
    <div className={clsx("flex flex-col items-center", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${label ?? "Progress"}: ${Math.round(pct * 100)} percent`}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${gid})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            style={{ filter: `drop-shadow(0 0 10px ${from}66)`, transition: "stroke-dashoffset 600ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-[clamp(20px,5vw,30px)] font-bold leading-none text-white">{Math.round(pct * 100)}%</p>
            {sublabel ? <p className="mt-1 text-[10px] uppercase tracking-[1.3px] text-ink-400">{sublabel}</p> : null}
          </div>
        </div>
      </div>
      {label ? <p className="mt-3 text-[12.5px] font-semibold text-ink-600">{label}</p> : null}
    </div>
  );
}

/* ============================================================ Sparkline */
export function Sparkline({
  data,
  width = 110,
  height = 32,
  tone = "violet",
  className
}: {
  data: number[];
  width?: number;
  height?: number;
  tone?: "violet" | "coral" | "success";
  className?: string;
}) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const step = width / Math.max(data.length - 1, 1);
  const pts = data.map((d, i) => [i * step, height - ((d - min) / span) * (height - 4) - 2] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const color = tone === "coral" ? CHART.coral : tone === "success" ? CHART.success : CHART.violet;
  const id = `spark-${tone}-${data.length}-${Math.round(width)}`;

  return (
    <svg width={width} height={height} className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ============================================================ StatCard */
export function StatCard({
  label,
  value,
  suffix,
  trend,
  trendTone,
  spark,
  ring,
  icon,
  hint,
  className
}: {
  label: string;
  value: string | number;
  suffix?: string;
  trend?: string;
  trendTone?: "up" | "down" | "flat";
  spark?: number[];
  ring?: { value: number; max?: number };
  icon?: ReactNode;
  hint?: string;
  className?: string;
}) {
  const toneCls =
    trendTone === "down" ? "badge-danger" : trendTone === "flat" ? "badge-neutral" : "badge-success";

  if (ring) {
    return (
      <Card className={clsx("flex items-center gap-4", className)} interactive>
        <StatRing value={ring.value} max={ring.max ?? 100} size={92} />
        <div className="min-w-0">
          <p className="eyebrow">{label}</p>
          <p className="mt-1 text-[26px] font-bold leading-none text-white">
            {value}
            {suffix ? <span className="ml-1 text-[15px] font-semibold text-ink-400">{suffix}</span> : null}
          </p>
          {trend ? <span className={clsx("badge mt-2", toneCls)}>{trend}</span> : null}
          {hint ? <p className="mt-1.5 text-[12px] text-ink-400">{hint}</p> : null}
        </div>
      </Card>
    );
  }

  return (
    <Card className={clsx("flex flex-col", className)} interactive>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{label}</p>
          <p className="mt-2 text-[clamp(24px,4vw,30px)] font-bold leading-none text-white">
            {value}
            {suffix ? <span className="ml-1 text-[15px] font-semibold text-ink-400">{suffix}</span> : null}
          </p>
        </div>
        {icon ? <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-grad-violet-soft text-violet-light">{icon}</span> : null}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          {trend ? <span className={clsx("badge", toneCls)}>{trend}</span> : null}
          {hint ? <p className="mt-1.5 text-[12px] text-ink-400">{hint}</p> : null}
        </div>
        {spark?.length ? <Sparkline data={spark} tone={trendTone === "down" ? "coral" : "violet"} /> : null}
      </div>
    </Card>
  );
}

/* ============================================================ Timeline */
export function Timeline({
  items,
  className
}: {
  items: { title: string; meta?: string; time?: string; tone?: "violet" | "coral" | "success" | "muted" }[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <ol className={clsx("timeline", className)}>
      {items.map((it, i) => (
        <li key={i} className="timeline-item">
          <span
            className={clsx(
              "timeline-dot",
              it.tone === "coral" && "is-coral",
              it.tone === "success" && "is-success",
              it.tone === "muted" && "is-muted"
            )}
          />
          <p className="text-[14px] font-semibold leading-snug text-white">{it.title}</p>
          {it.meta ? <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-600">{it.meta}</p> : null}
          {it.time ? <p className="mt-1 text-[11px] uppercase tracking-[1.2px] text-ink-400">{it.time}</p> : null}
        </li>
      ))}
    </ol>
  );
}

/* ==================================================== AmbientGlows */
/** One large violet glow + one smaller coral, both ~18% and blurred. */
export function AmbientGlows({ className }: { className?: string }) {
  return (
    <div aria-hidden className={clsx("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      <div className="absolute -left-24 -top-32 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(123,63,228,0.28),transparent_65%)] blur-[70px]" />
      <div className="absolute -bottom-32 -right-24 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(244,63,94,0.22),transparent_65%)] blur-[70px]" />
    </div>
  );
}

/* ==================================================== DashedClouds */
/** Decorative 2px dashed outlines for full-page background corners. */
export function DashedClouds({ className }: { className?: string }) {
  return (
    <div aria-hidden className={clsx("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      <div className="dashed-cloud -left-16 top-24 h-40 w-72 rotate-[-12deg]" />
      <div className="dashed-cloud -right-20 top-[38%] h-52 w-80 rotate-[8deg]" />
      <div className="dashed-cloud bottom-10 left-[22%] h-32 w-56 rotate-[4deg]" />
    </div>
  );
}

/* ==================================================== Connector */
/** 1px connector line ending in a glowing dot, linking a stat card to a hub. */
export function Connector({
  length = 90,
  vertical = false,
  coral,
  className,
  style
}: {
  length?: number;
  vertical?: boolean;
  coral?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={clsx("connector", coral && "connector-coral", className)}
      style={vertical ? { width: 1, height: length, ...style } : { height: 1, width: length, ...style }}
    />
  );
}
