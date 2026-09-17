"use client";

import clsx from "clsx";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; title: string; message?: string; tone: ToastTone };

const ToastCtx = createContext<{
  toast: (t: { title: string; message?: string; tone?: ToastTone }) => void;
}>({ toast: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

const ICON = {
  success: CheckCircle2,
  error: TriangleAlert,
  info: Info
};

const TONE_CLS: Record<ToastTone, string> = {
  success: "text-success",
  error: "text-danger",
  info: "text-violet-light"
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, message, tone = "info" }: { title: string; message?: string; tone?: ToastTone }) => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { id, title, message, tone }]);
      setTimeout(() => remove(id), 5000);
    },
    [remove]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div
        className="no-print pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[min(92vw,360px)] flex-col gap-3"
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        {items.map((t) => {
          const Icon = ICON[t.tone];
          return (
            <div key={t.id} className="glass pointer-events-auto flex items-start gap-3 p-4 shadow-glass">
              <Icon className={clsx("mt-0.5 h-4 w-4 shrink-0", TONE_CLS[t.tone])} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold leading-snug text-white">{t.title}</p>
                {t.message ? <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-600">{t.message}</p> : null}
              </div>
              <button onClick={() => remove(t.id)} aria-label="Dismiss notification" className="icon-btn h-6 w-6 shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
