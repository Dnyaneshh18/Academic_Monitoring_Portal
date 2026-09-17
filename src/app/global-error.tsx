"use client";

import { AmbientGlows, DashedClouds } from "@/components/ui";
import "./globals.css";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans">
        <div className="relative grid min-h-screen place-items-center overflow-hidden px-6 py-16">
          <AmbientGlows />
          <DashedClouds />
          <div className="relative w-full max-w-lg text-center">
            <p className="text-[clamp(88px,20vw,160px)] font-bold leading-none tracking-[-3px]">
              <span className="grad-text">500</span>
            </p>
            <h1 className="mt-4 text-[clamp(22px,4vw,28px)] font-semibold text-white">The portal hit an error</h1>
            <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-ink-600">
              A critical error stopped the application from rendering. Reload the page to try again.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <button onClick={reset} className="btn btn-primary">
                Reload the portal
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
