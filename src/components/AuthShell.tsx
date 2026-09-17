"use client";

import Link from "next/link";
import { ArrowLeft, GraduationCap, MailCheck } from "lucide-react";
import type { ReactNode } from "react";
import { AmbientGlows, DashedClouds } from "@/components/ui";

/** Shared chrome for every pre-auth screen (forgot / reset / confirmation). */
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-12">
      <AmbientGlows />
      <DashedClouds />

      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-grad-violet shadow-glow-violet">
            <GraduationCap className="h-5 w-5 text-white" />
          </span>
          <div>
            <p className="text-[15px] font-semibold leading-tight text-white">Academic Monitoring Portal</p>
            <p className="text-[10px] uppercase tracking-[1.6px] text-ink-400">Multi-college platform</p>
          </div>
        </Link>

        <div className="glass p-6 sm:p-7">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-1.5 text-[26px] font-semibold text-white">{title}</h1>
          {subtitle ? <p className="mt-2 text-[13.5px] leading-relaxed text-ink-600">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>

        <div className="mt-5 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-[13px] text-ink-600 transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </Link>
        </div>

        {footer ? <div className="mt-6">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Success / confirmation state used after a reset request. */
export function ConfirmationPanel({ title, message, children }: { title: string; message: string; children?: ReactNode }) {
  return (
    <div className="text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-grad-violet shadow-glow-violet">
        <MailCheck className="h-6 w-6 text-white" />
      </span>
      <p className="mt-4 text-[17px] font-semibold text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-600">{message}</p>
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}
