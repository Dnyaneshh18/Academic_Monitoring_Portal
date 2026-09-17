"use client";

import Link from "next/link";
import { AmbientGlows, DashedClouds } from "@/components/ui";

/**
 * Full-page status screen used by 401 / 403 / 404 / 500.
 * Big gradient numeral, one-line message, gradient CTA, dashed cloud outlines.
 */
export function StatusScreen({
  code,
  title,
  message,
  actionHref = "/app",
  actionLabel = "Back to dashboard",
  secondaryHref = "/login",
  secondaryLabel = "Sign in",
  reset
}: {
  code: string;
  title: string;
  message: string;
  actionHref?: string;
  actionLabel?: string;
  secondaryHref?: string | null;
  secondaryLabel?: string;
  reset?: () => void;
}) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-6 py-16">
      <AmbientGlows />
      <DashedClouds />

      <div className="relative w-full max-w-lg text-center">
        <p className="text-[clamp(88px,20vw,160px)] font-bold leading-none tracking-[-3px]">
          <span className="grad-text">{code}</span>
        </p>

        <h1 className="mt-4 text-[clamp(22px,4vw,28px)] font-semibold text-white">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-ink-600">{message}</p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href={actionHref} className="btn btn-primary">
            {actionLabel}
          </Link>
          {reset ? (
            <button onClick={reset} className="btn btn-ghost">
              Try again
            </button>
          ) : null}
          {secondaryHref ? (
            <Link href={secondaryHref} className="btn btn-ghost">
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
