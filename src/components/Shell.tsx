"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  History,
  Layers,
  LogOut,
  School,
  ScrollText,
  Users,
  AlertTriangle,
  MessageSquareHeart,
  UserPlus,
  UserRound,
  Mail,
  Brain
} from "lucide-react";
import { useEffect, useState } from "react";
import type { SessionUser } from "@/lib/auth";
import { api, clearToken } from "@/lib/client";
import clsx from "clsx";

const NAV: { href: string; label: string; icon: typeof LayoutDashboard; roles: SessionUser["role"][] }[] = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, roles: ["ADMIN", "COLLEGE_ADMIN", "HOD", "FACULTY", "STUDENT"] },
  { href: "/app/desk", label: "My desk", icon: Layers, roles: ["FACULTY", "HOD"] },
  { href: "/app/attendance", label: "Attendance", icon: ClipboardList, roles: ["HOD", "FACULTY", "STUDENT"] },
  { href: "/app/sessions", label: "Saved sessions", icon: History, roles: ["HOD", "FACULTY"] },
  { href: "/app/marks", label: "Assessments", icon: BookOpen, roles: ["HOD", "FACULTY", "STUDENT"] },
  { href: "/app/homework", label: "Assignments", icon: ClipboardList, roles: ["HOD", "FACULTY", "STUDENT"] },
  { href: "/app/defaulters", label: "Defaulters", icon: AlertTriangle, roles: ["HOD", "FACULTY"] },
  { href: "/app/alerts", label: "Parent alerts", icon: Mail, roles: ["HOD", "FACULTY"] },
  { href: "/app/ml", label: "ML analysis", icon: Brain, roles: ["COLLEGE_ADMIN", "HOD", "FACULTY"] },
  { href: "/app/mentoring", label: "Mentoring", icon: MessageSquareHeart, roles: ["ADMIN", "COLLEGE_ADMIN", "HOD", "FACULTY", "STUDENT"] },
  { href: "/app/students", label: "Students", icon: GraduationCap, roles: ["ADMIN", "COLLEGE_ADMIN", "HOD", "FACULTY"] },
  { href: "/app/faculty", label: "Faculty", icon: Users, roles: ["ADMIN", "COLLEGE_ADMIN", "HOD"] },
  { href: "/app/allotments", label: "Assign faculty", icon: UserPlus, roles: ["ADMIN", "COLLEGE_ADMIN", "HOD"] },
  { href: "/app/colleges", label: "Colleges", icon: School, roles: ["ADMIN"] },
  { href: "/app/manage", label: "Manage data", icon: Layers, roles: ["ADMIN", "COLLEGE_ADMIN"] },
  { href: "/app/academics", label: "Classes & subjects", icon: School, roles: ["ADMIN", "COLLEGE_ADMIN", "HOD"] },
  { href: "/app/timetable", label: "Timetable", icon: CalendarDays, roles: ["ADMIN", "COLLEGE_ADMIN", "HOD", "FACULTY", "STUDENT"] },
  { href: "/app/notices", label: "Notices", icon: Bell, roles: ["ADMIN", "COLLEGE_ADMIN", "HOD", "FACULTY", "STUDENT"] },
  { href: "/app/reports", label: "Reports", icon: ScrollText, roles: ["ADMIN", "COLLEGE_ADMIN", "HOD"] }
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    api<{ user: SessionUser }>("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => {
        if (typeof window !== "undefined" && !window.localStorage.getItem("amp_token")) {
          window.location.href = "/login";
        }
      });
  }, []);

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* still leave */
    }
    clearToken();
    window.location.href = "/login";
  }

  const isMainAdmin = user?.role === "ADMIN" && !user.collegeId;
  const links = NAV.filter((n) => {
    if (!user) return true;
    if (isMainAdmin) return n.href === "/app" || n.href === "/app/colleges";
    return n.roles.includes(user.role);
  });

  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 flex h-screen w-[17.5rem] flex-col border-r border-white/5 bg-ink-950 text-white">
        <div className="relative overflow-hidden px-5 py-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(280px_120px_at_20%_-20%,rgba(39,169,150,0.35),transparent)]" />
          <div className="relative flex items-center gap-3">
            {user?.collegeCode === "VIT" ? (
              <Image src="/crest.png" alt="" width={42} height={42} className="rounded-full crest-ring" />
            ) : (
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600 shadow-lift">
                <GraduationCap className="h-5 w-5" />
              </span>
            )}
            <div>
              <p className="font-display text-[17px] leading-tight">
                {isMainAdmin ? "Main admin" : user?.collegeCode || user?.collegeName || "Portal"}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-gold-400">
                {isMainAdmin ? "All colleges" : "Academic desk"}
              </p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] transition",
                  active
                    ? "bg-brand-600 text-white shadow-lift"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <l.icon className="h-4 w-4 shrink-0 opacity-90" />
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10">
              <UserRound className="h-4 w-4 text-gold-400" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium leading-tight">{user?.name || "…"}</p>
              <p className="text-[11px] uppercase tracking-wide text-white/45">
                {isMainAdmin ? "MAIN ADMIN" : user?.role === "COLLEGE_ADMIN" ? "COLLEGE ADMIN" : user?.role}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/70 hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6 md:p-9">{children}</main>
    </div>
  );
}

export function PageHeader({
  kicker,
  title,
  hint,
  action
}: {
  kicker?: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {kicker ? <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-700">{kicker}</p> : null}
        <h1 className="font-display mt-1 text-[2rem] leading-tight text-ink-900 md:text-[2.35rem]">{title}</h1>
        {hint ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}
