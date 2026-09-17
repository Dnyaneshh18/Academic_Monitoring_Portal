import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";
import { ClientGuard } from "@/components/ClientGuard";

const sans = Outfit({ subsets: ["latin"], variable: "--font-sans" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", style: ["normal"] });

export const metadata: Metadata = {
  title: "Academic Monitoring Portal",
  description: "Multi-college academic monitoring — attendance, assessments, mentoring and reports."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable} font-sans`}>
        <ClientGuard />
        {children}
      </body>
    </html>
  );
}
