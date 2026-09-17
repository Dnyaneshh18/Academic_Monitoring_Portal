"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  History,
  Layers,
  LogOut,
  Menu,
  School,
  Search,
  ScrollText,
  Users,
  AlertTriangle,
  MessageSquareHeart,
  UserPlus,
  Mail,
  Brain,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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

function roleLabel(user: SessionUser | null, isMainAdmin: boolean) {
  if (!user) return "…";
  if (isMainAdmin) return "MAIN ADMIN";
  if (user.role === "COLLEGE_ADMIN") return "COLLEGE ADMIN";
  return user.role;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("amp_sidebar_collapsed");
    if (saved === "1") setCollapsed(true);
    api<{ user: SessionUser }>("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => {
        if (typeof window !== "undefined" && !window.localStorage.getItem("amp_token")) {
          window.location.href = "/login";
        }
      });
  }, []);

  // close the mobile drawer on navigation
  useEffect(() => {
    setDrawer(false);
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  // global search shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        searchRef.current?.querySelector("input")?.focus();
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      window.localStorage.setItem("amp_sidebar_collapsed", c ? "0" : "1");
      return !c;
    });
  }

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

  const crumbs = useMemo(() => {
    const segs = pathname.split("/").filter(Boolean);
    const items = [{ label: "Overview", href: "/app" }];
    if (segs[1]) {
      const match = NAV.find((n) => n.href === `/${segs[0]}/${segs[1]}`);
      items.push({ label: match?.label ?? segs[1].replace(/-/g, " "), href: `/${segs[0]}/${segs[1]}` });
    }
    return items;
  }, [pathname]);

  const results = query.trim()
    ? links.filter((l) => l.label.toLowerCase().includes(query.trim().toLowerCase()))
    : links.slice(0, 6);

  const initials = (user?.name || "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const sidebar = (
    <>
      {/* logo + role badge */}
      <div className="relative overflow-hidden px-4 py-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(260px_120px_at_16%_-24%,rgba(123,63,228,0.34),transparent)]" />
        <div className={clsx("relative flex items-center gap-3", collapsed && "justify-center")}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-grad-violet shadow-glow-violet">
            <GraduationCap className="h-5 w-5 text-white" />
          </span>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold leading-tight text-white">
                {isMainAdmin ? "Main admin" : user?.collegeCode || user?.collegeName || "Portal"}
              </p>
              <span className="mt-1 inline-flex rounded-full border border-violet/30 bg-violet/[0.14] px-2 py-[2px] text-[9.5px] font-semibold uppercase tracking-[1.4px] text-violet-800">
                {roleLabel(user, isMainAdmin)}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 pb-4" aria-label="Main navigation">
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              title={collapsed ? l.label : undefined}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition duration-200",
                collapsed && "justify-center px-0",
                active
                  ? "bg-grad-violet text-white shadow-glow-violet"
                  : "text-ink-600 hover:bg-white/[0.06] hover:text-white"
              )}
            >
              {active ? <span className="nav-active-bar" aria-hidden /> : null}
              <l.icon className="h-5 w-5 shrink-0" />
              {!collapsed ? <span className="truncate">{l.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      {/* user + sign out */}
      <div className="border-t border-white/[0.07] p-3">
        {!collapsed ? (
          <div className="mb-2 flex items-center gap-2.5 px-1">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-grad-violet text-[11px] font-bold text-white ring-2 ring-violet/30">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-medium leading-tight text-white">{user?.name || "…"}</p>
              <p className="truncate text-[10.5px] uppercase tracking-[1.2px] text-ink-400">{roleLabel(user, isMainAdmin)}</p>
            </div>
          </div>
        ) : null}
        <button
          onClick={logout}
          title={collapsed ? "Sign out" : undefined}
          className={clsx(
            "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] text-ink-600 transition hover:bg-white/[0.06] hover:text-white",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed ? "Sign out" : null}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* desktop sidebar — glass right edge */}
      <aside
        className={clsx(
          "no-print sticky top-0 hidden h-screen shrink-0 flex-col border-r border-white/[0.07] bg-elevated backdrop-blur-xl transition-[width] duration-200 lg:flex",
          collapsed ? "w-[76px]" : "w-[260px]"
        )}
      >
        {sidebar}
      </aside>

      {/* mobile slide-over drawer */}
      {drawer ? (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-[rgba(12,12,18,0.7)] backdrop-blur-[8px]" onClick={() => setDrawer(false)} />
          <aside className="relative flex h-full w-[268px] flex-col border-r border-white/[0.07] bg-elevated shadow-glass">
            <button
              onClick={() => setDrawer(false)}
              aria-label="Close navigation"
              className="icon-btn absolute right-3 top-4 z-10"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* topbar */}
        <header className="no-print sticky top-0 z-30 border-b border-white/[0.07] bg-[rgba(28,28,39,0.72)] backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-3 px-4 sm:px-8">
            <button onClick={() => setDrawer(true)} aria-label="Open navigation" className="icon-btn lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <button
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="icon-btn hidden lg:grid"
            >
              <ChevronLeft className={clsx("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
            </button>

            {/* breadcrumbs */}
            <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 text-[12.5px] sm:flex">
              {crumbs.map((c, i) => (
                <span key={c.href} className="flex items-center gap-2">
                  {i > 0 ? <span className="text-ink-400">/</span> : null}
                  {i === crumbs.length - 1 ? (
                    <span className="truncate font-semibold text-white">{c.label}</span>
                  ) : (
                    <Link href={c.href} className="truncate text-ink-400 transition hover:text-ink-700">
                      {c.label}
                    </Link>
                  )}
                </span>
              ))}
            </nav>

            {/* global search */}
            <div ref={searchRef} className="relative ml-auto w-[min(38vw,320px)]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 160)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && results[0]) router.push(results[0].href);
                  }}
                  placeholder="Search…"
                  aria-label="Search navigation"
                  className="field field-icon field-icon-end"
                />
                <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-white/[0.09] bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-ink-400">
                  ⌘K
                </kbd>
              </div>
              {searchOpen && results.length ? (
                <div className="glass absolute left-0 right-0 top-[calc(100%+8px)] z-40 overflow-hidden p-1.5">
                  {results.map((r) => (
                    <Link
                      key={r.href}
                      href={r.href}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] text-ink-600 transition hover:bg-white/[0.07] hover:text-white"
                    >
                      <r.icon className="h-4 w-4 text-ink-400" />
                      {r.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            {/* notifications */}
            <Link href="/app/notices" aria-label="Notices and notifications" className="icon-btn relative shrink-0">
              <Bell className="h-5 w-5" />
              <span className="notif-dot" aria-hidden />
            </Link>

            {/* avatar w/ gradient ring */}
            <div className="relative shrink-0">
              <button
                onClick={() => setMenuOpen((m) => !m)}
                aria-label="Account menu"
                aria-expanded={menuOpen}
                className="grid h-9 w-9 place-items-center rounded-full bg-grad-violet text-[11px] font-bold text-white ring-2 ring-violet/40 transition hover:brightness-110"
              >
                {initials}
              </button>
              {menuOpen ? (
                <div className="glass absolute right-0 top-[calc(100%+10px)] z-40 w-56 overflow-hidden p-1.5">
                  <div className="px-3 py-2">
                    <p className="truncate text-[13.5px] font-semibold text-white">{user?.name || "…"}</p>
                    <p className="truncate text-[11.5px] text-ink-400">{user?.email}</p>
                  </div>
                  <div className="divider my-1" />
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] text-ink-600 transition hover:bg-white/[0.07] hover:text-white"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {/* content — 1440px max, 32px gutters, 24px grid gap */}
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {kicker ? <p className="eyebrow">{kicker}</p> : null}
        <h1 className="mt-1.5 text-[clamp(24px,4vw,32px)] font-semibold leading-tight text-white">{title}</h1>
        {hint ? <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-600">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}
