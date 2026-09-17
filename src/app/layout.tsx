import type { Metadata } from "next";
import "./globals.css";
import { ClientGuard } from "@/components/ClientGuard";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "Academic Monitoring Portal",
  description: "Multi-college academic monitoring — attendance, assessments, mentoring and reports."
};

export const viewport = {
  themeColor: "#1C1C27",
  colorScheme: "dark" as const
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans">
        <ClientGuard />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
