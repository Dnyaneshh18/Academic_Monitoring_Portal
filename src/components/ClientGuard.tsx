"use client";

import { useEffect } from "react";

/** Keep failed API calls from exploding the Next.js error overlay. */
export function ClientGuard() {
  useEffect(() => {
    const onRej = (e: PromiseRejectionEvent) => {
      e.preventDefault();
      const msg = e.reason instanceof Error ? e.reason.message : String(e.reason || "");
      console.warn("[amp]", msg);
    };
    window.addEventListener("unhandledrejection", onRej);
    return () => window.removeEventListener("unhandledrejection", onRej);
  }, []);
  return null;
}
