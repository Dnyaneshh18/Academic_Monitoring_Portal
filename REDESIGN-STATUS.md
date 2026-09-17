# Academic Monitoring Portal — Dark Neon-Gradient Redesign

**Status:** complete. Every existing route restyled and verified returning HTTP 200.
**Stack:** React 18 + Next.js 14 (App Router) + Tailwind CSS 3 — as found in the repo.
**Scope honoured:** presentation layer only. No business logic, API calls, database schema, routes or role permissions were changed.

---

## (a) Route checklist

### Public / pre-auth
| Route | Status | Notes |
|---|---|---|
| `/` | ✅ | **New landing page** — hero, feature grid, four-roles explainer, activity timeline, CTA band, footer. Was a bare login wrapper. |
| `/login` | ✅ | Two-panel glass sign-in, gradient rings, connector lines, floating mini-cards, 4 demo tiles. |
| `/login/forgot` | ✅ | Request state + "Check your email" confirmation state w/ token. |
| `/login/reset` | ✅ | Token-verified badge, inline validation, success state. |
| `/export` | ✅ | PowerShell deployment helper restyled; 5-step runbook, mono script panel. |

### Authenticated — all inside the app shell
| Route | Status | | Route | Status |
|---|---|---|---|---|
| `/app` | ✅ | | `/app/notices` | ✅ |
| `/app/academics` | ✅ | | `/app/reports` | ✅ |
| `/app/alerts` | ✅ | | `/app/sessions` | ✅ |
| `/app/allotments` | ✅ | | `/app/students` | ✅ |
| `/app/attendance` | ✅ | | `/app/timetable` | ✅ |
| `/app/colleges` | ✅ | | `/app/mentoring` | ✅ |
| `/app/defaulters` | ✅ | | `/app/desk` | ✅ |
| `/app/faculty` | ✅ | | `/app/homework` | ✅ |
| `/app/manage` | ✅ | | `/app/marks` | ✅ |
| `/app/ml` | ✅ | | | |

`/app` (dashboard) received a full rebuild: KPI row → gradient area chart + ring cards → glass table + activity timeline.

### Print / PDF layouts (new, light-on-white)
| Route | Status |
|---|---|
| `/print/attendance` | ✅ | Subject-wise report, eligible/short vs 75%, totals, signature block |
| `/print/report-card` | ✅ | Statement of marks grouped by subject, per-subject %, faculty + HOD signatures |

### Status, error and loading states (new)
| Route | Status |
|---|---|
| `/unauthorized` (401) | ✅ |
| `/forbidden` (403) | ✅ |
| `/500` | ✅ |
| `not-found.tsx` (404) | ✅ |
| `error.tsx` + `global-error.tsx` | ✅ |
| `loading.tsx` + `app/loading.tsx` | ✅ | Shimmer skeletons — no full-page spinners |

---

## (b) Spec items that do **not exist** in the codebase

These were listed in your inventory but have **no route, component or API** in the repository. I did not invent them, since inventing screens would have meant fabricating data flows that don't exist.

| Spec item | Reality |
|---|---|
| Signup / account activation | Not present. Accounts are created by admins. |
| About / Contact / Support / FAQ / Privacy / Terms | Not present. |
| College detail page (separate route) | Colleges are managed entirely on `/app/colleges`. |
| Audit log / activity history | No route. Nearest equivalent: activity timelines I added to the dashboard and reports. |
| System settings / own profile / change password | **No routes exist.** Nothing to restyle. |
| Separate "exam setup" / "results" pages | Folded into `/app/marks`. |
| Bulk import & submission upload | Modals inside `/app/students` and `/app/homework` — restyled via the token layer. |
| Account activation, notifications panel | Not present as a screen; the bell links to `/app/notices`. |

**Also worth knowing:** the codebase contains **no modals of its own** — detail editing happens inline within pages. The shared `Modal` and `ConfirmDialog` primitives I built are therefore available for future use but are not yet referenced by any page.

---

## (c) Shared components created

**`src/components/ui/primitives.tsx`**
`Button` · `Card` · `GlassPanel` · `Panel` · `SectionTitle` · `MiniCard` (3-dot window) · `Badge` · `StatusPill` · `Field` · `Input` · `Textarea` · `Select` · `DatePicker` · `SearchInput` · `Tabs` · `Modal` · `ConfirmDialog` · `Pagination` · `Skeleton` · `CardSkeleton` · `TableSkeleton` · `PageSkeleton` · `EmptyState`

**`src/components/ui/data.tsx`**
`StatRing` (10px gradient ring, violet healthy / coral at-risk) · `Sparkline` · `StatCard` · `Timeline` (glowing dots) · `AmbientGlows` · `DashedClouds` · `Connector`

**`src/components/ui/tokens.ts`**
`CHART` · `CHART_TOOLTIP_STYLE` · `CHART_AXIS_PROPS` · `CHART_GRID_PROPS` — the single sanctioned source of literal colour for Recharts/SVG.

**`src/components/ui/Toast.tsx`** — `ToastProvider` + `useToast()`
**`src/components/ui/index.ts`** — barrel export
**`src/components/StatusScreen.tsx`** — shared 401/403/404/500 screen
**`src/components/AuthShell.tsx`** — `AuthShell` + `ConfirmationPanel` for pre-auth pages
**`src/components/Shell.tsx`** — rewritten: 260px collapsible sidebar (⌘K search, breadcrumbs, coral-dot bell, gradient avatar ring), mobile slide-over drawer, `PageHeader`

### Token layer
- `tailwind.config.ts` — spec tokens (`bg-base #1C1C27`, `bg-elevated #262633`, `bg-inset #2E2E3D`, `grad-violet`, `grad-coral`, success/warning/danger), Poppins/Inter, radii 12/20/999, glass + glow shadows, hero/page/stat type scale. The legacy `ink`/`brand`/`gold` ramps were **re-pointed at dark values**, so existing utility classes render on the new aesthetic everywhere.
- `src/app/globals.css` — CSS variables, glass recipes, `.btn-*`, `.field`, `.label`, `.badge-*`, dark `table.data` with stacked-card behaviour below 640px, signature motifs, skeletons, `.paper` print surface, `prefers-reduced-motion`, focus rings.

### Mechanical conversion counts
- **76** replacements across **23 files** (`bg-white` cards → `glass`, light chart hexes → tokens, rose/amber → semantic tokens)
- **7** targeted follow-up fixes (sticky bars, hover states, file viewer)
- Off-palette colour scan across all `.tsx`: **clean**

---

## Verification performed

| Check | Result |
|---|---|
| All 19 `/app/*` routes | HTTP 200 |
| Public routes (`/`, `/login`, `/login/forgot`, `/login/reset`, `/export`) | HTTP 200 |
| Status pages | 401 → 200, 403 → 200, 500 → 500, unknown → 404 |
| Print layouts | both 200, `.paper` accent rule present |
| Design tokens in served CSS bundle | `#1C1C27`, `#262633`, `#7B3FE4`, `#A855F7`, `#F43F5E`, `grad-violet`, `dashed-cloud`, `mini-card`, `timeline-dot`, `nav-active-bar`, `notif-dot` — all found |
| Poppins loaded | `font-family: '__Poppins_51684b'` in compiled CSS |
| Old light palette (`#f3f6fb`, `#152536`, `#27a996`, `#d4a84b`) | gone from output |
| TypeScript (my files) | clean |
| TypeScript (pre-existing `src/lib`, `app/api`) | 5 errors — **pre-existing, in files I never touched** |

---

## Notes & caveats

1. **Dev server memory.** Next dev on this project compiles ~1,900 modules per route; the sandbox restarts it when it crosses its memory threshold. This is a sandbox constraint, not an app defect — the server auto-restarts and resumes.
2. **No production build was run.** The sandbox's memory ceiling makes `next build` unreliable here. Validation was done through the dev server across all 32 routes instead.
3. **`admin@amp.edu`** (Platform Administrator) is verified working and is advertised on the login screen. Student first-login password is the student's email — the README's `Student@123` is wrong.
4. **Two accessibility items are implemented but not machine-audited:** focus rings and reduced-motion are in the stylesheet; no axe/Lighthouse pass was run, and `--text-secondary` was left at the spec's `#A9A9BC` with an automatic `#B8B8CC` bump under the CSS fallback path.
