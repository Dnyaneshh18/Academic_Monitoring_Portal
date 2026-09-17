import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { ClientGuard } from "@/components/ClientGuard";
import { ToastProvider } from "@/components/ui/Toast";

const sans = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap"
});

const display = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap"
});

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
      <body className={`${sans.variable} ${display.variable} font-sans`}>
        <ClientGuard />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
