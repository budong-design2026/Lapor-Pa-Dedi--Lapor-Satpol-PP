# Yeuh Satpol! — Worklog

This file tracks the rebuild tasks for the Yeuh Satpol! pengaduan app (Next.js 16 + raw libsql, no Prlesia).

## Task R2 — Backend rebuild (raw libsql API routes)
**Agent**: full-stack-developer
**Task ID**: R2
**Date**: 2026-10-08
**Status**: ✅ Complete

### Scope
Rebuilt ALL 19 backend API routes under `src/app/api/` using raw libsql (via `@/lib/db-raw`) — no `import from "@/lib/db"` (Prlesia). Foundation files (db-raw, constants, auth, report-helpers, globals.css, layout, store, api-client) untouched.

### Files created (19)
1. `src/app/api/auth/register/route.ts` — POST. MASYARAKAT public self-reg OR staff (PIMPINAN_KASATPOL/SEKRETARIS gate).
2. `src/app/api/auth/login/route.ts` — POST. Email/password → JWT cookie.
3. `src/app/api/auth/logout/route.ts` — POST. Clears session cookie.
4. `src/app/api/auth/me/route.ts` — GET. Returns fresh user via getUserById.
5. `src/app/api/auth/change-password/route.ts` — POST. Min 8 char new password, verifyPassword on current.
6. `src/app/api/reports/route.ts` — POST (create) + GET (list with filters: status/riskLevel/kabupaten/category/search/sort). PII masked for non-staff / anonymous.
7. `src/app/api/reports/upload/route.ts` — POST multipart. Image (jpg/png/webp) ≤2MB OR video (mp4/mov/webm) ≤5MB. 413 / 415 errors.
8. `src/app/api/reports/[id]/route.ts` — GET detail (staff) + PATCH update (staff). Dynamic UPDATE; sets verifiedAt/inProgressAt/resolvedAt; recalculates slaDeadline on riskLevel change; createProgressNote; merges photosAfter.
9. `src/app/api/reports/track/[ticket]/route.ts` — GET public. Returns report + progressNotes (with authorName). PII masked if anonymous or non-staff caller.
10. `src/app/api/reports/stats/route.ts` — GET public. totalReports, thisMonth, completed, completionRate, byCategory, byKabupaten, byRisk, byStatus, last7Days, avgResponseHours.
11. `src/app/api/operator/inbox/route.ts` — GET (OPERATOR/PIMPINAN). Buckets: all/unverified/in_progress/critical/overdue. Search, sort, pagination.
12. `src/app/api/operator/dashboard/route.ts` — GET (OPERATOR). queueToday, unverified, inProgress, criticalActive, overdue, avgResponseHours, closeRate, slaCompliance.
13. `src/app/api/pimpinan/dashboard/route.ts` — GET (PIMPINAN). Scoped to bidang if PIMPINAN_KABID. byRisk/byStatus/byCategory/byKabupaten/byBidang, criticalActive, trend, avgResponseHours, closeRate, slaCompliance.
14. `src/app/api/pimpinan/critical/route.ts` — GET (PIMPINAN). Active CRITICAL reports. Optional bidang filter.
15. `src/app/api/pimpinan/kpi/route.ts` — GET (PIMPINAN). Per-bidang KPI: activeReports, resolvedThisMonth, avgResponseHours, closeRate, slaCompliance.
16. `src/app/api/pimpinan/approve/[id]/route.ts` — POST (PIMPINAN). Sets status=DIPROSES, inProgressAt=now. createProgressNote "ESCALATE" with pimpinan role label.
17. `src/app/api/setup/route.ts` — GET + POST. ensureTables, seed BIDANG_LIST + admin + 3 demo staff. SETUP_KEY env gate OR countUsers()===0 gate.
18. `src/app/api/bidangs/route.ts` — GET (any logged-in). Lists all bidangs.
19. `src/app/api/ai/analyze-report/route.ts` — POST. Uses z-ai-web-dev-sdk (dynamic import, thinking disabled). Returns riskLevel/bidang/pasal/reasoning. Heuristic fallback on SDK error.

### Helper file created
- `src/lib/api-helpers.ts` — isStaff, isOperator, isPimpinan, shapeReport (parse JSON arrays + booleans), maskReport (PII gating), shapeUser.

### Validation results
- ✅ `bun run lint` — clean, no errors.
- ✅ `grep -rl 'from "@/lib/db"' src/app/api/` — no matches (no Prlesia).
- ✅ `curl /api/setup` — first run 200 OK (5 bidangs, 4 users seeded); subsequent 403 "DB sudah ada user".
- ✅ All auth flows tested: register (MASYARAKAT + staff by pimpinan), login, me, change-password, logout.
- ✅ All report flows tested: create, list (with filters), detail (staff), patch (staff), track by ticket (public), stats (public).
- ✅ Operator endpoints: inbox (all buckets), dashboard.
- ✅ Pimpinan endpoints: dashboard (scoped), critical, kpi, approve.
- ✅ AI analyze-report: returns valid JSON (3.3s avg response); heuristic fallback verified.
- ✅ Edge cases: 401 (no auth), 403 (insufficient role), 404 (bad ID/ticket), 400 (validation), 413 (file too big), 415 (wrong type).

### Quirks encountered
1. **Prisma-migrated User table schema differs from db-raw ensureTables**: existing `User` table has `updatedAt NOT NULL` without default (Prisma migration created it). Foundation's `upsertUser()` omits `updatedAt` in INSERT → fails. Workaround: register & setup routes pass `datetime('now')` explicitly in the INSERT. Setup route also defines inline `upsertUserRobust()` instead of using foundation `upsertUser()`. NOTE: This is a foundation bug — recommend updating db-raw.ts to either DROP+recreate the User table OR include updatedAt explicitly in INSERT.

2. **countReportsWhereArgs prepends WHERE**: foundation helper hardcodes `SELECT COUNT(*) FROM "Report" WHERE ${whereSql}`. If caller passes `"WHERE ..."` it produces `WHERE WHERE ...` → syntax error. Fix: pass conditions only (no `WHERE` keyword) — implemented in reports/list and operator/inbox routes.

3. **z-ai-web-dev-sdk quirk**: `await import("z-ai-web-dev-sdk")` returns a module object where `mod.create` may be undefined; I check both `mod.create` and `mod.default.create` for safety. AI response may include code fences around JSON — regex-extract first `{...}` block before `JSON.parse`. Avg response time ~3.3s.

4. **INSERT placeholder count bug (fixed)**: Initial register INSERT had 12 `?` + 2 `datetime('now')` = 14 placeholders for 13 columns. Fixed to 11 `?` + 2 `datetime('now')` = 13 placeholders.

### Accounts seeded by /api/setup
- Admin: `kasatpol@jabar.go.id` / `SatpolPPJabar!BareTegas26` (PIMPINAN_KASATPOL)
- Operator: `operator@jabar.go.id` / `OperatorJabar!Tegas26` (OPERATOR, TRANTIBUM bidang)
- Kabid: `kabidsatpol@jabar.go.id` / `KabidSatpolJabar26` (PIMPINAN_KABID, TRANTIBUM bidang)
- Sekretaris: `sekretaris@jabar.go.id` / `SekretarisJabar!Mantap26` (PIMPINAN_SEKRETARIS)

## Task R3 — Shared UI shell + common components rebuild
**Agent**: full-stack-developer
**Task ID**: R3
**Date**: 2026-10-08
**Status**: ✅ Complete

### Scope
Rebuilt ALL 19 shared UI components under `src/components/shared/` for the Yeuh Satpol! SPA shell. Foundation files (constants, store, api-client, globals.css, layout, prisma) untouched. Did NOT create `src/app/page.tsx` (Lead assembles). Did NOT create view components (other agents).

### Foundation files consumed (READ-ONLY)
- `src/lib/constants.ts` — APP_NAME/SHORT/TAGLINE/TRADEMARK/SATPOL_TASKS/LEGAL_BASIS, CATEGORIES (icon field = lucide name), RISK_LEVELS (CRITICAL/HIGH/MEDIUM/LOW), REPORT_STATUSES, ROLES, ROLE_LABELS, PIMPINAN_ROLES
- `src/store/app-store.ts` — useAppStore (area/view/setArea/setView/openReport/user/setUser/theme/toggleTheme/hydrated/setHydrated), viewFromQuery
- `src/lib/api-client.ts` — apiFetch, ApiError
- `src/components/ui/*` — shadcn (button, card, badge, dialog, input, label, skeleton, toast/toaster, sonner)
- `src/hooks/use-toast.ts` — toast() hook
- `public/logo-satpol.svg` — placeholder emblem (real Pemprov/SatpolPP logos to be uploaded by user later)

### Files created (19) — all under `src/components/shared/`
1. `theme-provider.tsx` — SSR-safe; on mount reads `useAppStore.theme` and applies `dark`/`light` class to `documentElement`. Subscribes to theme changes.
2. `app-shell.tsx` — `<div className="app-shell min-h-screen flex flex-col">` with SiteHeader, `<main className="app-main flex-1">` (Framer `AnimatePresence mode="wait"` keyed on `view`, 180ms fade+slide, `pb-24 sm:pb-0`), SiteFooter, BottomNav.
3. `site-header.tsx` — sticky top-0 z-50 glass. Left: LogoSatpolpp (h-9, NOT rounded) + "Yeuh Satpol!" gold-shimmer + tagline. Right: staff→ RoleBadge + bidang name + "Ganti Password" (KeyRound, opens ChangePasswordDialog) + "Keluar" (POST /api/auth/logout → setUser null); masyarakat → "Masuk Operator/Pimpinan" (setView login). Theme toggle (Sun/Moon). Mobile: logo + theme + compact staff strip.
4. `site-footer.tsx` — `mt-auto` footer, `md:grid-cols-3`. Col1: © 2026 Satpol PP Prov. Jawa Barat + SATPOL_TASKS + LEGAL_BASIS. Col2: quick links (Beranda/Lapor/Lacak/Transparansi). Col3: gold "⚡ Budong_production2026" badge (`bg-jabar-gold`, `shadow-[0_0_18px_rgba(255,214,0,0.45)]`). `pb-[env(safe-area-inset-bottom)]`.
5. `bottom-nav.tsx` — `sm:hidden fixed bottom-0`. Tabs by area: masyarakat (Beranda/Lapor-gold/Lacak/Transparansi/Masuk), operator (Inbox/Dashboard/Akun), pimpinan (Command/Critical/KPI/Akun). Lucide icons, active text-jabar-gold. Min-h-[52px] touch targets.
6. `glass-card.tsx` — wrapper over shadcn Card + `glass-card rounded-xl` class.
7. `gold-shimmer-text.tsx` — `<Tag className="gold-shimmer font-black tracking-tight">`, Tag ∈ span/h1/h2/h3.
8. `risk-badge.tsx` — riskLevel → Badge with emoji+label+color (RISK_LEVELS). CRITICAL adds `critical-pulse`.
9. `status-badge.tsx` — status → Badge (REPORT_STATUSES) with dot+label+color.
10. `role-badge.tsx` — role → Badge (ROLE_LABELS). Pimpinan gets gold styling. **Omit<..., "role"> to avoid ARIA `role` attribute type conflict.**
11. `stat-card.tsx` — GlassCard with big number + label + icon + accent (gold/blue/red/green/amber). Each accent gets matching border + glow shadow.
12. `category-icon.tsx` — code→lucide icon (Map, Route, Bus, Waves, Leaf, Store, Building2, Users, HeartPulse, AlertTriangle, ShieldCheck, TreePine, Fish, Zap, Landmark, Briefcase, FileText, MessageCircle). Fallback MessageCircle. Uses `React.createElement(IconComp, ...)` for linter-friendly dispatch.
13. `loading.tsx` — `Loading` (block centered, Loader2 spin, role=status), `LoadingSpinner` (inline), `RowSkeleton` (list placeholder using Skeleton).
14. `empty-state.tsx` — icon + title + description + optional action (GlassCard wrapper).
15. `app-boot.tsx` — on mount: read `?view=` from URL via `viewFromQuery` → `setView`, clean URL via `history.replaceState`; `apiFetch('/api/auth/me')` → `setUser(result.user || null)` → `setHydrated(true)`. Render `<ThemeProvider><AppShell>{children}</AppShell></ThemeProvider>`. Shows `Loading` until hydrated.
16. `change-password-dialog.tsx` — shadcn Dialog. Props open/onOpenChange. Fields: Password Lama, Password Baru (min 8), Konfirmasi. Submit `apiFetch('/api/auth/change-password',{method POST, body})`. On success: toast "Password berhasil diubah" + close + reset. On 401 "Password lama salah": highlight current-password field. On 401 (session expired): `setUser(null)` + `setView('login')` + close. Gold submit button, Loader2 spin while submitting.
17. `logo-satpolpp.tsx` — `img src="/logo-satpol.svg" alt="Satpol PP"` h-9 w-auto object-contain NOT rounded.
18. `logo-pemprov.tsx` — `img src="/logo-satpol.svg" alt="Pemprov Jabar (placeholder)" w-16 NOT rounded (note: user will re-upload real logos).
19. `map-preview.tsx` — GlassCard with MapPin + coords (6-decimal) + "Buka di Google Maps" link (`https://www.google.com/maps?q=lat,lng`, `target=_blank`).

### Validation
- ✅ `bun run lint` — clean, EXIT=0 (eslint .)
- ✅ `bunx tsc --noEmit -p tsconfig.json` — clean for all `src/components/shared/*` files (no type errors in R3 scope; remaining TS errors are in R2 backend + foundation `db-raw.ts` which are out of R3 scope)
- ✅ `tail -30 dev.log` (non-prisma lines) — only `✓ Compiled in Nms` entries, no compile errors

### Critical design points
1. **Sticky footer MANDATORY** — `app-shell min-h-screen flex flex-col`, `main flex-1`, `footer mt-auto`. Confirmed in `app-shell.tsx` + `site-footer.tsx`.
2. **Budong badge** — `bg-jabar-gold text-background shadow-[0_0_18px_rgba(255,214,0,0.45)]` in `site-footer.tsx` col 3. ✅
3. **Dark mode DEFAULT** — Zustand `theme` initial = `"dark"`; `ThemeProvider` applies class on mount; html has `className="dark"` SSR. NO next-themes package. ✅
4. **Hydration-safe** — no `navigator`/`window` at module top-level; all browser APIs only in `useEffect`. ✅
5. **Mobile-first responsive** — `BottomNav sm:hidden`, sticky glass header, `pb-24 sm:pb-0` on animated main region so content doesn't hide behind bottom nav on mobile. ✅
6. **Accessibility** — semantic HTML (`header`/`main`/`footer`/`nav`/`section`), ARIA (`role`, `aria-label`, `aria-current`, `aria-live`, `aria-hidden`, `sr-only`). All buttons are `<button type="button">` with descriptive `aria-label`. ✅
7. **Midnight navy palette** — uses Tailwind CSS vars from `globals.css` (`bg-background`, `text-foreground`, `bg-jabar-gold`, `text-jabar-blue`, etc.). No indigo/blue (only jabar-blue dark navy accent). ✅
8. **Framer Motion v12** — `AnimatePresence mode="wait"` keyed on `view`, 180ms fade+slide (`opacity:0,y:8` → `opacity:1,y:0`). ✅
9. **Indonesian UI text** — all labels in Bahasa Indonesia (Beranda, Lapor, Lacak, Transparansi, Masuk, Keluar, Ganti Password, Password Lama/Baru, Konfirmasi, Buka di Google Maps, Menyimpan…, etc.). ✅

### Lucide icon names verified
All 18 category icons exist in `lucide-react@0.525.0`:
- Map, Route, Bus, Waves, Leaf, Store, Building2, Users, HeartPulse, AlertTriangle, ShieldCheck, TreePine, Fish, Zap, Landmark, Briefcase, FileText, MessageCircle (fallback).
- Header/nav icons: Sun, Moon, LogOut, KeyRound, LogIn, Home, Megaphone, Search, BarChart3, Inbox, LayoutDashboard, User, ShieldAlert, Target, Gauge, Loader2, MapPin, ExternalLink, Zap — all valid.
- **None missing.** Route exists. All others verified by successful `import` + ESLint pass.

### Quirks encountered
1. **`role` HTML attribute type conflict in `RoleBadgeProps`** — extending `React.HTMLAttributes<HTMLSpanElement>` while redeclaring `role?: string | null | undefined` caused `TS2430`. Fix: `extends Omit<React.HTMLAttributes<HTMLSpanElement>, "role">` (the JSX `role` ARIA attr is no longer passed through; the badge text content suffices for accessibility).
2. **`CardProps` not exported from shadcn card** — initial attempt to `import { Card, type CardProps }` failed. Fix: declare `type GlassCardProps = React.ComponentProps<"div">` since shadcn Card extends div props.
3. **Sonner toaster still wired to `next-themes`'s `useTheme`** (pre-existing in `src/components/ui/sonner.tsx`) — since next-themes is unconfigured, sonner defaults to `system` theme but uses CSS vars from `globals.css` so styling remains consistent with Zustand dark default. NOT in R3 scope (would require modifying foundation's sonner.tsx). Workaround acceptable since R3 uses radix `useToast` (radix `<Toaster />` is also mounted in layout).

### Lead handoff notes
- `AppBoot` is the intended top-level wrapper for `src/app/page.tsx`. The Lead should render `<AppBoot>{view-specific component}</AppBoot>` and call `useAppStore(s => s.view)` to pick the correct view component.
- All view components should import `GlassCard`, `RiskBadge`, `StatusBadge`, `RoleBadge`, `StatCard`, `CategoryIcon`, `Loading`, `RowSkeleton`, `EmptyState`, `MapPreview`, `GoldShimmerText`, `LogoPemprov`, `LogoSatpolpp`, `LoadingSpinner` as needed.
- `ChangePasswordDialog` is wired into `SiteHeader` — no extra setup needed.
- The `?view=` deep-link hand-off in `AppBoot` only maps `lapor/track/transparency/login` to views (matching `viewFromQuery`); deep-links for staff views (`operator-inbox` etc.) require login and are not URL-addressable. Lead should rely on store state for staff navigation.

## Task R4a — Masyarakat (public) views rebuild
**Agent**: full-stack-developer
**Task ID**: R4a
**Date**: 2026-10-08
**Status**: ✅ Complete

### Scope
Rebuilt ALL 6 masyarakat (public) views under `src/components/views/masyarakat/`. All `"use client"`. Did NOT create `src/app/page.tsx` (Lead assembles). Did NOT modify foundation/shared UI/backend/other view folders.

### Foundation files consumed (READ-ONLY)
- `src/lib/constants.ts` — CATEGORIES (18), KABUPATEN_KOTA (27), RISK_LEVELS, REPORT_STATUSES, MAX_PHOTOS=3, MAX_PHOTO_SIZE_MB=2, APP_NAME, TAGLINE.
- `src/store/app-store.ts` — useAppStore (view, setView, setUser, user), ViewKey.
- `src/lib/api-client.ts` — apiFetch, apiUpload, ApiError.
- `src/components/shared/*` — GlassCard, GoldShimmerText, StatCard, CategoryIcon, Loading, RowSkeleton, EmptyState, MapPreview, LogoSatpolpp, LogoPemprov, StatusBadge, RiskBadge.
- `src/components/ui/*` — Button, Input, Label, Textarea, Switch, Select, Badge.
- `src/hooks/use-toast.ts` — useToast (radix).
- Backend: POST /api/reports, POST /api/reports/upload, GET /api/reports/track/[ticket], GET /api/reports/stats, POST /api/auth/login.

### Files created (6) — all under `src/components/views/masyarakat/`
1. `masyarakat-views.tsx` — orchestrator. Reads `view` from store. home→LandingView, lapor→LaporView, track→TrackView, transparency→TransparencyView, login→LoginView, default→LandingView. Returns null for operator-*/pimpinan-* views (other agents handle). Wraps each in `<motion.div key={view}>` (AnimatePresence mode="wait", 0.18s fade+slide, initial opacity0 y8 → animate opacity1 y0 → exit opacity0 y-8). Container `pt-6 max-w-6xl mx-auto px-4 sm:px-6`.
2. `landing-view.tsx` — Hero with GoldShimmerText as=h1 (APP_NAME, text-3xl sm:text-5xl), tagline. 2 CTAs: "Lapor Sekarang" (gold→setView lapor), "Lacak Laporan" (outline→setView track), + "Transparansi" ghost. Logos row (LogoSatpolpp h-56 + LogoPemprov h-64, NOT rounded) with divider. "✦ JABAR ISTIMEWA ✦" gold-shimmer badge. Stats strip: 4 StatCards from /api/reports/stats (totalReports, thisMonth, completionRate%, avgResponseHours+" jam"), useEffect+useState (no tanstack-query), RowSkeleton while loading. "17 Ketertiban + Lainnya" grid (grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3) of all 18 CATEGORIES, each clickable GlassCard→setView lapor with CategoryIcon + name + description (line-clamp-2). "Cara Kerja" 4-step (ClipboardList→Search→Cog→CheckCircle2). "Tingkat Risiko & SLA" legend (4 cards: CRITICAL🟠 HIGH🟠 MEDIUM🟡 LOW🟢 + SLA hours). "Masuk Operator/Pimpinan" ghost button → setView login.
3. `lapor-view.tsx` — The complaint form (golden path). 4 GlassCard sections:
   - **§1 Identitas Pelapor**: Nama (req), NIK (req, 16 digit regex, numeric-only filter, /16 digit), Tempat Lahir, Tanggal Lahir (date), Alamat (textarea), No. HP (optional). Switch "Lapor sebagai anonim" with helper "Identitas disembunyikan dari publik, dicatat untuk operator". When anon → PII fields omitted from submit body, reporterName="Anonim".
   - **§2 Detail Pelanggaran**: kategori Select (group "17 Ketertiban" + "Lainnya" via SelectGroup+SelectSeparator), sub-kategori Input, Deskripsi Textarea (min 20 char, char counter, max 1000), Alamat Kejadian Textarea, Kabupaten Select (KABUPATEN_KOTA, 27 entries).
   - **§3 Lokasi GPS**: "Deteksi GPS Otomatis" button via navigator.geolocation.getCurrentPosition (GUARD typeof navigator; lazy useState(() => null) for gps). On success → store {lat,lng} → MapPreview. On error → EmptyState + manual lat/lng number Inputs (always visible as fallback when no GPS). Manual coords validated on submit.
   - **§4 Upload Bukti Foto**: file input accept=image/* multiple. Validates count ≤ MAX_PHOTOS (3) AND each ≤ MAX_PHOTO_SIZE_MB (2) MB BEFORE upload (rejects with toast + skips). Thumbnail grid (3 cols, aspect-square) with remove (X). Per-file status overlay (Menunggu/Mengunggah Loader2/Terunggah CheckCircle2/Gagal X). On submit: upload each via apiUpload('/api/reports/upload', formData with field 'file') sequentially, collect urls. Videos: hint card "Video menyusul — sampaikan via operator". URL.createObjectURL thumbnails; revokeObjectURL on remove + on unmount (useRef ref to capture latest photos array).
   - **Submit**: validate locally (Nama req, NIK /^\d{16}$/, category req, desc ≥20, address req, kabupaten req, GPS req). POST /api/reports with all + photos:string[]. On success: big gold mono ticketNumber + "Lacak Laporan Ini" (setView track + push ?ticket= URL) + "Lapor Lagi" (resetForm). On error: toast + inline red alert. Plain useState (no react-hook-form/zod — simpler). Sticky submit bar at bottom (bottom-16 sm:bottom-4) so it stays visible on long forms.
4. `track-view.tsx` — Input ticket (mono font, uppercase transform, placeholder "YP-20260101-1234") + "Lacak" gold button. GET /api/reports/track/{ticket}. Loading state shows <Loading>. On found: GlassCard with ticket (gold mono, 2xl-3xl, break-all) + StatusBadge + RiskBadge (md). Detail grid: category icon+name+description+sub, description (whitespace-pre-wrap), address+kabupaten, createdAt timeAgo. MapPreview. Pipeline (4-step Diterima→Diverifikasi→Diproses→Selesai) as 4-col grid with current=gold (border-jabar-gold/60 bg-jabar-gold/10), done=green, pending=muted; DITOLAK shown as red alert box. Timeline (vertical ol with left border) of progressNotes — icon by type: PROGRESS=MessageSquare, VERIFY=Search, ASSIGN=Send, STATUS=RefreshCw, ESCALATE=AlertTriangle; note + authorName + timeAgo. 404 → EmptyState "Tiket tidak ditemukan" + "Lapor Baru" button. Pre-fill from ?ticket= query (useEffect+window.location, hydration-safe; auto-search). timeAgo helper inline (Indonesian: "baru saja", "X menit lalu", "X jam lalu", "X hari lalu", "X bulan lalu", "X tahun lalu").
5. `transparency-view.tsx` — Public dashboard. GET /api/reports/stats via useEffect+useState. 4 StatCards (Total Laporan gold, Bulan Ini blue, Selesai green, Penyelesaian % amber with hint avgResponseHours). recharts v2 named imports (BarChart/Bar/XAxis/YAxis/CartesianGrid/Tooltip/PieChart/Pie/Cell/LineChart/Line/Legend/ResponsiveContainer):
   - **BarChart** (top 8 categories by count, gold bars #ffd600, angle=-35 X-axis labels with "Tertib " prefix stripped, custom Tooltip with full name).
   - **PieChart donut** (byStatus, innerRadius 60 outerRadius 95, REPORT_STATUSES colors as Cell fill, Legend bottom).
   - **LineChart** (last7Days gold line width 3, gold dots, custom Tooltip, X-axis dd-MMM Indonesian).
   - **Horizontal bar list** byKabupaten top 10 (custom div-based bars with gradient from-jabar-gold/70 to-jabar-gold, count badge).
   - **Risk distribution** 4 mini cards (CRITICAL/HIGH/MEDIUM/LOW with emoji + count + SLA hours, colored borders).
   - **All categories full list** (18 items, scrollable max-h-72 custom-scroll).
   - Privacy note GlassCard "Data agregat. Detail laporan tidak dipublikasikan."
   - All charts height 300px desktop / ResponsiveContainer 100% width. Loading state: 4 RowSkeletons + <Loading>. Error state: red GlassCard.
6. `login-view.tsx` — Centered form (flex min-h-[60vh] items-center justify-center). GlassCard max-w-md. Header: LogoSatpolpp + LogoPemprov (with divider, NOT rounded) + GoldShimmerText as=h1 "Masuk Staf" + "Area Terbatas" gold badge (ShieldCheck). Fields: email (type=email, autocomplete=email, placeholder nama@jabar.go.id), password (type=password). Submit button gold "Masuk" (LogIn icon, Loader2 spin while submitting). POST /api/auth/login → on success setUser(result.user) (store auto-routes to operator/pimpinan area + toast "Selamat datang"). On 401: toast "Email atau password salah" (destructive) + inline red alert. On 400: same. Footer: "Kembali ke Beranda" (ghost, setView home) + "Saya warga, ingin lapor" (ghost gold, setView lapor). Hint card: "Warga tidak perlu login — gunakan menu Lapor".

### Validation
- ✅ `bun run lint` — clean EXIT 0 (no errors, no warnings) after fixing 3 issues:
  1. JSDoc comment in masyarakat-views.tsx contained `operator-*/pimpinan-*` which prematurely closed the comment block (`*/` in middle) → changed to `operator-X / pimpinan-X`.
  2. Unused `eslint-disable-next-line @next/next/no-img-element` directive in lapor-view.tsx (rule wasn't firing on plain `<img>` for object URLs) → removed directive, kept explanatory comment.
  3. Unused `eslint-disable-next-line react-hooks/exhaustive-deps` in track-view.tsx useEffect → removed directive.
- ✅ `bunx tsc --noEmit -p tsconfig.json` — ZERO errors in `src/components/views/masyarakat/*` (remaining TS errors are in R2 backend + foundation db-raw.ts, out of R4a scope).
- ✅ `tail -30 dev.log` (non-API lines) — only `✓ Compiled in Nms` entries, no compile errors.

### Critical design points
1. **All "use client"** ✅ — every file starts with `"use client";`.
2. **Hydration-safe** ✅ — no `navigator`/`window` at module/render top-level. GPS uses `useState(() => null)` lazy init + `typeof navigator === "undefined"` guard inside event handler. URL pre-fill in TrackView uses `if (typeof window === "undefined") return;` inside useEffect. Login "Lacak Laporan Ini" URL push uses `if (typeof window !== "undefined")` guard.
3. **File upload validation BEFORE upload** ✅ — `onPhotoSelect` checks `photos.length + files.length > MAX_PHOTOS` (3) AND `file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024` (2MB) client-side, rejects with toast, skips invalid files. Server-side 413/415 still active as final gate.
4. **URL.createObjectURL thumbnails** ✅ — created on select, revoked on remove (single item) AND on unmount (all items via `photosRef.current` ref pattern).
5. **recharts named imports** ✅ — `import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, LineChart, Line, Legend, ResponsiveContainer } from "recharts"`.
6. **framer-motion v12** ✅ — `import { AnimatePresence, motion } from "framer-motion"`; AnimatePresence mode="wait" with motion.div keyed on view, 0.18s easeOut.
7. **Toast feedback** ✅ — useToast() (radix) for all user actions (upload rejected, validation fail, submit success, login fail, ticket not found).
8. **Logos NOT rounded** ✅ — LogoSatpolpp/LogoPemprov use `object-contain` class with no rounded-* classes; aspect preserved via height attr + width auto.
9. **Dark theme midnight navy + gold** ✅ — `bg-background` (#060912), `text-foreground`, `text-jabar-gold` (#ffd600), glass-card class. NO indigo/purple anywhere. jabar-blue only as dark navy accent.
10. **Mobile-first responsive** ✅ — grid-cols-2 → sm:grid-cols-3 → lg:grid-cols-4 patterns; sticky submit bar bottom-16 sm:bottom-4 (clears mobile bottom nav); min-h-[52px] touch targets.
11. **Sticky footer** ✅ — AppShell (shared, not modified) already enforces `min-h-screen flex flex-col` + `footer mt-auto`.
12. **Accessibility** ✅ — semantic `<section>`/`<header>`/`<form>`/`<ol>`, aria-label on inputs/buttons, sr-only labels, role="alert" on error states, aria-invalid on form fields with errors.
13. **Indonesian UI text** ✅ — all labels/buttons in Bahasa Indonesia (Lapor Sekarang, Lacak Laporan, Deteksi GPS Otomatis, Kirim Laporan, Lacak Laporan Ini, Lapor Lagi, Kembali ke Beranda, Saya warga ingin lapor, Tiket tidak ditemukan, Lapor Baru, dll).

### Lead handoff notes
- **`MasyarakatViews`** is the default export target. Lead should render `<AppBoot><MasyarakatViews/></AppBoot>` in `src/app/page.tsx` (alongside the operator/pimpinan orchestrators that other agents will produce).
- The orchestrator returns `null` for `operator-*` and `pimpinan-*` views — those will be handled by `OperatorViews`/`PimpinanViews` orchestrators (other agents). Lead should compose: `<AppBoot>{view.startsWith('operator-') ? <OperatorViews/> : view.startsWith('pimpinan-') ? <PimpinanViews/> : <MasyarakatViews/>}</AppBoot>`.
- The `?ticket=` URL parameter is auto-read by TrackView on mount (in addition to `?view=track` which AppBoot already handles). If user lands on `/?view=track&ticket=YP-...`, AppBoot sets view=track, then TrackView pre-fills & auto-searches.
- Lapor success screen pushes `?ticket=YP-...` to URL before calling `setView('track')` — so TrackView will auto-search the just-submitted ticket on transition.
- No new packages installed — all dependencies (recharts v2, framer-motion v12, lucide-react, sonner/radix-toast, shadcn) already in package.json from foundation.

## Task R4b — Operator (Penatakelola) views rebuild
**Agent**: full-stack-developer
**Task ID**: R4b
**Date**: 2026-10-08
**Status**: ✅ Complete

### Scope
Rebuilt ALL 4 operator (Penatakelola) views under `src/components/views/operator/`. All `"use client"`. Did NOT create `src/app/page.tsx` (Lead assembles). Did NOT modify foundation/shared UI/backend/other view folders (R3 shared, R2 backend, R4a masyarakat — read-only consumption).

### Foundation files consumed (READ-ONLY)
- `src/lib/constants.ts` — RISK_LEVELS (CRITICAL/HIGH/MEDIUM/LOW + slaHours), BIDANG_LIST (5), REPORT_STATUSES, ROLES/ROLE_LABELS, getCategory(), getBidang().
- `src/lib/report-helpers.ts` — timeAgo, slaTimeRemaining({ms,label,overdue}), calculateSlaDeadline.
- `src/store/app-store.ts` — useAppStore (view/setView/openReport(id)→sets selectedReportId+view='operator-detail', user, setUser).
- `src/lib/api-client.ts` — apiFetch, apiUpload, ApiError.
- Shared UI (R3): GlassCard, GoldShimmerText, RiskBadge, StatusBadge, RoleBadge, StatCard, CategoryIcon, Loading, LoadingSpinner, RowSkeleton, EmptyState, MapPreview.
- shadcn/ui: Button, Input, Label, Textarea, Select, Tabs, Dialog, Badge, Progress.
- `useToast` (radix) for feedback.
- Framer Motion v12 (AnimatePresence mode="wait" + motion.div).
- Backend (R2): GET /api/operator/inbox, GET /api/operator/dashboard, GET /api/reports/[id], PATCH /api/reports/[id], POST /api/ai/analyze-report, POST /api/reports/upload, GET /api/bidangs.

### Files created (4) — all under `src/components/views/operator/`
1. `operator-views.tsx` (92 lines) — orchestrator. Reads `view` + `user` from store. Maps operator-inbox→OperatorInboxView, operator-detail→OperatorDetailView, operator-dashboard→OperatorDashboardView, default→null (other orchestrators handle). **Auth guard**: if `!user || user.role !== 'OPERATOR'` → EmptyState "Akses ditolak — halaman ini untuk Operator" + gold "Kembali ke Beranda" button. Wraps each in `<motion.div key={view}>` (AnimatePresence mode="wait", 180ms fade+slide, `opacity:0,y:8 → opacity:1,y:0 → opacity:0,y:-8`). Container `pt-6 max-w-7xl mx-auto px-4 sm:px-6` (per spec, wider than masyarakat's max-w-6xl).
2. `operator-inbox-view.tsx` (622 lines) — Real-time inbox.
   - Top bar: Inbox icon + GoldShimmerText "Inbox Laporan" + RoleBadge + bidang name (from user.bidangName) + "Segarkan" button (Loader2 spin while refreshing) + last-updated time (`toLocaleTimeString("id-ID", {hour,minute,second})`, hydration-safe — null initially).
   - 4 mini StatCards (Antrian Hari Ini / Belum Diverifikasi / Critical Aktif / Overdue) — fetches `/api/operator/dashboard` in parallel every 30s; falls back to counts from inbox response.
   - Filter tabs (shadcn Tabs): Semua / Belum Diverifikasi / Diproses / Critical / Overdue — each tab shows count Badge from `counts.{all,unverified,inProgress,critical,overdue}`.
   - Search input (500ms debounce via separate effect + clearTimeout) + sort Select (Terbaru/Terlama/Risiko tertinggi).
   - Report list: vertical `InboxReportCard` sub-component (GlassCard). Row1: ticket (mono gold break-all) + StatusBadge + RiskBadge + SLA timer pill (red overdue, amber <25% remaining via RISK_LEVELS[riskLevel].slaHours, green else) computed via `formatSlaTimer()` using `report.slaRemaining`. Row2: CategoryIcon + category name (via `getCategory()`) + subCategory + kabupaten. Row3: description (2-line truncate) + first photo thumbnail (or ImageOff placeholder). Row4: createdAt timeAgo + reporter name (or Anonim badge w/ UserX) + "Tinjau" button (`openReport(id)`). Critical/overdue cards: red left border + red glow + critical-pulse dot.
   - Loading→RowSkeleton x5. Empty→EmptyState (with "Lihat Dashboard" ghost button). Error→EmptyState + "Coba lagi" button.
   - Pagination "Muat Lebih Banyak" (single-fetch model: `page` state counts PAGE_SIZE batches; fetch uses `limit = page * PAGE_SIZE` at `page=1` to replace list with all-loaded-in-one-shot; "Menampilkan X dari Y" footnote when no more).
   - **Polling**: `useEffect([filter, search, sort, page])` builds `setInterval(refetch, 15000)`; cleanup `clearInterval` on unmount/filter/search/sort/page change. Silent refetch (no loading spinner) to avoid flicker. Manual "Segarkan" button calls `fetchInbox()` directly. `firstLoadRef` distinguishes initial load (full Loading state) vs polling (silent).
   - API errors: 401 → toast "Sesi berakhir" + redirect to login (handled by store setUser(null)). 403 → toast "Akses ditolak".
3. `operator-detail-view.tsx` (1200 lines) — Verification + action view.
   - Reads `selectedReportId` from store. If null → EmptyState "Pilih laporan dari inbox" + gold "Buka Inbox" button. If 404/403 → EmptyState + "Kembali ke Inbox" outline button.
   - GET `/api/reports/[id]` → full PII for staff (reporterName/Phone/Nik/BirthPlace/BirthDate/Address all populated even for anonymous). `loadReport()` callback depends on `selectedReportId`.
   - Header GlassCard: ticket (gold mono 2xl) + createdAt timeAgo + kabupaten + StatusBadge + RiskBadge + SLA timer pill.
   - **2-column layout** (lg:grid-cols-2, stacked mobile):
     - **Left (main)**: (1) Pelapor info GlassCard — `InfoField` sub-component for each field (Nama/Anonim badge, No. HP, NIK, TTL, Alamat) with Phone/IdCard/Calendar/Home icons. (2) Detail GlassCard — CategoryIcon + category name + sub + description (whitespace-pre-wrap) + address+kabupaten. (3) MapPreview (Lokasi Kejadian). (4) Bukti Foto GlassCard — thumbnail grid (3-4 cols, aspect-square) → click → `Dialog` enlarge (max-h-[80vh] object-contain).
     - **Right (sticky desktop, `lg:sticky lg:top-4 lg:self-start`)**:
       - **AI Suggestion Card** (`AiSuggestionCard` sub-component): "Saran AI" gold button → POST /api/ai/analyze-report body {description, category, address, kabupaten}. LoadingSpinner during request. Result: source badge (gold "✦ AI" / muted "Heuristik"), grid 2-col → suggestedRiskBadge + "Terap" button (sets riskLevel state) / suggested bidang name + "Terap" button (sets assignedBidangId state) / pasal list (bordered li) / reasoning paragraph. `suggestedBidangInfo` lookup uses bidangs array (from API) for `id`; falls back to `getBidang(code)` for display name when bidangs not yet loaded.
       - **Verifikasi & Assign form**: risk Select (CRITICAL/HIGH/MEDIUM/LOW — labels include SLA hours e.g. "🔴 Critical — SLA 1 jam"), SLA preview "SLA: X jam dari sekarang" via `RISK_LEVELS[riskLevel].slaHours`, Bidang Select (from `/api/bidangs` if loaded, falls back to `BIDANG_LIST` constants), sub-kategori Input, "Verifikasi & Teruskan" gold button → PATCH {status:'DIPROSES', riskLevel, assignedBidangId, subCategory, progressNote:'Laporan diverifikasi & diteruskan ke Bidang ...', progressNoteType:'ASSIGN'}.
       - **Update Status section**: status Select (Diproses/Selesai/Ditolak) + catatan progress Textarea (min-h-[80px]) + "Update Status" outline button → PATCH {status, progressNote, progressNoteType:'STATUS'}.
       - **Foto Penanganan upload**: dashed-border drop-zone label wrapping hidden file input (accept image/jpeg,png,webp, multiple). Sequential `apiUpload('/api/reports/upload', formData)` per file. On success → PATCH {photosAfter: newUrls} (server merges with existing). Existing photosAfter shown in grid (click → same Dialog).
       - **Critical escalation** (only if `report.riskLevel === 'CRITICAL'`): red GlassCard with critical-pulse icon + "Eskalasi 1-Klik" red button → PATCH {status:'DIPROSES', progressNote:'ESKALASI: ...', progressNoteType:'ESCALATE', riskLevel:'CRITICAL'} + WhatsApp preview link (`https://wa.me/?text=<encoded message>` with ticket, category, description (400 char), address, kabupaten, Maps link `https://www.google.com/maps?q=lat,lng`).
   - **Progress Notes Timeline** at bottom: vertical `<ol>` w/ left border + per-note icon by type (PROGRESS=MessageSquare, VERIFY=Search, ASSIGN=Send, STATUS=RefreshCw, ESCALATE=AlertTriangle) + note text + authorName + timeAgo.
   - **PATCH helper**: `patchReport(body, successMsg, errMsg)` — calls PATCH, on success updates local `report` state from response (no full refetch), refreshes form fields from updated report, toast success. On 401 → toast + setUser(null) + setView('login'). On other errors → toast destructive.
4. `operator-dashboard-view.tsx` (421 lines) — Mini dashboard.
   - Header: LayoutDashboard icon + GoldShimmerText "Dashboard Operator" + "Segarkan" outline button + "Buka Inbox" gold button (`setView('operator-inbox')`).
   - **6 StatCards** (grid-cols-2 lg:grid-cols-3): Antrian Hari Ini (gold, queueToday) / Belum Diverifikasi (blue, unverified) / Diproses (amber, inProgress) / Critical Aktif (red, criticalActive) / Overdue (amber, overdue) / Close Rate % (green, `${closeRate}%` with hint "X dari Y selesai").
   - **Rata-rata Response Time** StatCard (gold, `${avgResponseHours} jam`) + **SLA Compliance** GlassCard (lg:col-span-2) — big % number (color: green≥80/amber 60-80/red<60 via `slaColor()`) + TrendingUp icon + shadcn `Progress` bar with `[&_[data-slot=progress-indicator]]:bg-{green,amber,red}-500` class override to color the indicator + 0%/Target: 80%+/100% scale.
   - **Recent activity** (`/api/reports?limit=5&sort=newest`) → 5 `RecentActivityCard` sub-components (clickable → `openReport(id)`): mini GlassCard with CategoryIcon + ticket mono gold + StatusBadge + RiskBadge + ⚠ Overdue tag (if slaRemaining.overdue) + description line-clamp-1 + category+kabupaten+timeAgo. "Lihat semua" ghost button → inbox.
   - Loading→Loading + 6 RowSkeletons. Error→EmptyState + "Coba lagi".
   - Polling every 30s (silent) — `loadAll({silent: true})`.

### Validation
- ✅ `bun run lint` — EXIT 0, clean (no errors, no warnings). Fixed 4 unused `eslint-disable-next-line @next/next/no-img-element` directives on plain `<img>` tags (rule wasn't firing on them — these were on inline-upload thumbnails and the photo Dialog preview, not next/image).
- ✅ `bunx tsc --noEmit -p tsconfig.json` — ZERO errors in `src/components/views/operator/*` (fixed 1 TS error: `suggestedBidangInfo.id` access on `Bidang | BidangInfo` union — split into separate `suggestedBidangInfo` (Bidang|null) and `suggestedBidangName` (string fallback chain)).
- ✅ `tail -40 dev.log` — only "✓ Compiled in Nms" entries, no compile errors. The single `EADDRINUSE :::3000` block at the head is from the init-fullstack script's startup race (system started a 2nd dev server while one was already running); the original dev server is what's serving and it's compiling cleanly.
- ✅ `curl /api/operator/inbox?...` returns expected `{"error":"Akses ditolak. Login sebagai staff."}` (403 in JSON) — confirms API route exists and auth guard works.

### Critical design points
1. **All "use client"** ✅ — every file starts with `"use client";`.
2. **Hydration-safe** ✅ — no `navigator`/`window`/`document` at module/render top-level. `window.setInterval`/`window.clearInterval` only inside `useEffect`. `lastUpdated.toLocaleTimeString("id-ID")` rendered as null initially (only set after first fetch in useEffect). `URL.createObjectURL` not used here (uploaded photos already have URLs from server).
3. **Inbox 15s polling** ✅ — `useEffect([filter, search, sort, page])` builds `window.setInterval(() => fetchInbox({silent:true}), 15000)`; cleanup `window.clearInterval` on unmount AND on every filter/search/sort/page change. Manual "Segarkan" button calls `fetchInbox()` directly. Silent refetch (no loading spinner) avoids flicker on every 15s tick.
4. **Filter tabs with counts** ✅ — 5 tabs (Semua/Belum Diverifikasi/Diproses/Critical/Overdue) each showing a Badge with the matching count from `counts` (camelCase: `all/unverified/inProgress/critical/overdue`).
5. **SLA timer** ✅ — `formatSlaTimer(report)` returns `{text, tone: "red"|"amber"|"green"|"muted"}`. Red when `slaRemaining.overdue` (text "Lewat Xj Ym" computed from `Math.abs(sla.ms)`). Amber when remaining < 25% of `RISK_LEVELS[riskLevel].slaHours * 3600_000`. Green otherwise. Pill styled `border + bg-{color}-500/10 + text-{color}-400`.
6. **Detail AI suggestion + risk/bidang assign + status update + photosAfter upload + critical escalation with WhatsApp link** ✅ — all 5 features wired as described in scope. PATCH responses update local state (no full refetch). `Dialog` for photo enlarge. WhatsApp link `https://wa.me/?text=<encoded>` with ticket+category+description+address+kabupaten+Maps URL.
7. **Dashboard 6 StatCards + SLA Progress bar** ✅ — 6 StatCards in grid-cols-2 lg:grid-cols-3. SLA Compliance GlassCard (lg:col-span-2) with shadcn `Progress` bar whose indicator color is overridden via `[&_[data-slot=progress-indicator]]:bg-{green,amber,red}-500` class.
8. **Toast feedback** ✅ — useToast (radix) on every action: verify & assign, status update, photo upload, critical escalation, AI suggestion apply (risk/bidang), AI suggestion failure, session expiry (401), access denied (403).
9. **PATCH returns updated report → update local state (don't blindly refetch all)** ✅ — `patchReport()` helper sets `setReport(data.report)` from the PATCH response and refreshes form fields. No global refetch.
10. **Auth guard** ✅ — orchestrator checks `user?.role !== 'OPERATOR'` → EmptyState "Akses ditolak". API 401 → toast "Sesi berakhir, masuk lagi" + `setUser(null)` + `setView('login')`.
11. **Dark theme midnight navy + gold** ✅ — `bg-background` (#060912), `text-foreground`, `text-jabar-gold` (#ffd600), glass-card class. NO indigo/purple. Red accent for critical/overdue, green/amber for SLA status.
12. **Mobile-first responsive** ✅ — grid-cols-2 → lg:grid-cols-3 patterns; lg:grid-cols-2 detail layout stacks on mobile; sticky right-column actions on desktop only (`lg:sticky lg:top-4`). Touch-friendly button sizes (min h-8 sm:h-9).
13. **Accessibility** ✅ — semantic `<header>`/`<section>`/`<button>`/`<ol>`/`<label>`, `aria-label` on inputs/buttons, `aria-hidden` on icons, `sr-only` DialogTitle/DialogDescription, `role="alert"`-equivalent destructive toasts, keyboard-accessible buttons (`type="button"`).
14. **Indonesian UI text** ✅ — all labels/buttons in Bahasa Indonesia (Inbox Laporan, Segarkan, Muat Lebih Banyak, Tinjau, Verifikasi & Teruskan, Update Status, Foto Penanganan, Eskalasi 1-Klik, Pratinjau Pesan WhatsApp, Buka Inbox, Kembali ke Inbox, Aktivitas Terbaru, Rata-rata Response Time, SLA Compliance, dll).
15. **No `src/app/page.tsx`** ✅ — Lead assembles. Exported `OperatorViews` is the intended top-level target. Lead should render `<AppBoot>{view.startsWith('operator-') ? <OperatorViews/> : view.startsWith('pimpinan-') ? <PimpinanViews/> : <MasyarakatViews/>}</AppBoot>` (mirroring R4a handoff).

### Quirks encountered
1. **`getBidang()` returns `BidangInfo` (no `id`), but `/api/bidangs` returns `Bidang` with `id`** — TS error on `suggestedBidangInfo.id` access (union type `Bidang | BidangInfo`). Fix: split into `suggestedBidangInfo: Bidang | null` (from API lookup) and `suggestedBidangName: string` (with fallback chain `suggestedBidangInfo?.name ?? getBidang(code)?.name ?? code`). "Terap" button only renders when `suggestedBidangInfo?.id` is truthy (i.e. when API bidangs are loaded).
2. **shadcn `Progress` indicator color override** — `Progress` uses `bg-primary` on the inner indicator. To color it green/amber/red based on SLA threshold, used Tailwind v4 arbitrary descendant selector `[&_[data-slot=progress-indicator]]:bg-green-500` on the Progress wrapper. The `data-slot="progress-indicator"` attribute is set by the shadcn component so the selector works. Avoided initial hacky overlay approach (negative-margin duplicate bar) — switched to clean class override.
3. **Tailwind v4 dynamic class concatenation** — `"border-" + sla.accent + "-500/40"` doesn't get picked up by Tailwind v4 JIT (it can't statically analyze runtime strings). Fix: explicit `ring` field in `slaColor()` return with full class strings: `"border-green-500/40"`, `"border-amber-500/40"`, `"border-red-500/40"`.
4. **`useCallback` deps for `loadAll`** — initially had `[dashboard, toast]` which recreated `loadAll` on every dashboard state change → re-ran the polling interval effect each time (worked but redundant). Refactored to `[toast]` only + `firstLoadRef` to distinguish initial load vs polling (mirrors `operator-inbox-view.tsx` pattern).
5. **`@next/next/no-img-element` not firing on plain `<img>` for object/upload URLs** — 4 directives were unused (3 in detail view, 1 in inbox view). Removed all 4 (rule apparently only fires on certain `<img>` configurations; the inline thumbnails for `/uploads/...` URLs weren't triggering it). Kept plain `<img>` tags since these are dynamically-served server URLs (not statically imported assets that would benefit from next/image optimization).

### Lead handoff notes
- **`OperatorViews`** is the default export target. Lead should render `<AppBoot>{view.startsWith('operator-') ? <OperatorViews/> : view.startsWith('pimpinan-') ? <PimpinanViews/> : <MasyarakatViews/>}</AppBoot>` (mirroring R4a handoff).
- The orchestrator returns `null` for `home/lapor/track/transparency/login` views (MasyarakatViews handles) AND for `pimpinan-*` views (PimpinanViews handles).
- Staff deep-links (`operator-inbox`/`operator-detail`/`operator-dashboard`) are NOT URL-addressable via `viewFromQuery` (R3 scope) — Lead should rely on store state for staff navigation. The `setUser()` flow already auto-routes to `operator-inbox` when an OPERATOR logs in (foundation store behavior).
- `openReport(id)` (store action) is the canonical way to navigate from inbox/dashboard → detail. It sets `selectedReportId` + `view='operator-detail'` atomically.
- The detail view's right-column "Verifikasi & Teruskan" PATCH sets `status='DIPROSES'` + `riskLevel` + `assignedBidangId` + `subCategory` + a `progressNote` of type `ASSIGN` ("Laporan diverifikasi & diteruskan ke Bidang ..."). The backend R2 PATCH route handles `slaDeadline` recalculation when `riskLevel` changes (foundation behavior).
- The 1-click critical escalation PATCH sets `status='DIPROSES'` (not changing risk since it's already CRITICAL, but explicitly setting `riskLevel:'CRITICAL'` to trigger SLA recalculation to 1 hour from now — important for already-CRITICAL reports whose SLA may have drifted).
- The WhatsApp escalation link uses `https://wa.me/?text=<encoded>` (no specific phone number — user picks recipient from their WhatsApp contacts). Includes ticket, category, description (truncated to 400 chars to stay under wa.me URL length limits), address, kabupaten, and a Google Maps link.

## Task R4c — Pimpinan (Kasatpol PP / Kabid / Sekretaris) views rebuild
**Agent**: full-stack-developer
**Task ID**: R4c
**Date**: 2026-10-08
**Status**: ✅ Complete

### Scope
Rebuilt ALL 5 pimpinan views under `src/components/views/pimpinan/`. All `"use client"`. Did NOT create `src/app/page.tsx` (Lead assembles). Did NOT modify foundation/shared UI/backend/other view folders (R3 shared, R2 backend, R4a masyarakat, R4b operator — read-only consumption).

### Foundation files consumed (READ-ONLY)
- `src/lib/constants.ts` — CATEGORIES (18), KABUPATEN_KOTA (27), BIDANG_LIST (5) via `getBidang()`, RISK_LEVELS, REPORT_STATUSES, ROLES/ROLE_LABELS/PIMPINAN_ROLES.
- `src/lib/report-helpers.ts` — timeAgo, slaTimeRemaining({ms,label,overdue}).
- `src/store/app-store.ts` — useAppStore (view/setView/openReport(id)→sets selectedReportId+view='operator-detail', user, setUser, theme, hydrated). ViewKey type.
- `src/lib/api-client.ts` — apiFetch, ApiError.
- Shared UI (R3): GlassCard, GoldShimmerText, RiskBadge, StatusBadge, RoleBadge, StatCard, CategoryIcon, Loading, LoadingSpinner, RowSkeleton, EmptyState.
- shadcn/ui: Button, Switch, Select (Trigger/Content/Item/Value), Table (Table/Header/Body/Row/Head/Cell), Badge.
- `useToast` (radix) for feedback.
- Framer Motion v12 (AnimatePresence mode="wait" + motion.div fade+slide).
- recharts v2 named imports: BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend, AreaChart, Area, ResponsiveContainer.
- Backend (R2): GET /api/pimpinan/dashboard, GET /api/pimpinan/critical?bidang=, GET /api/pimpinan/kpi, POST /api/pimpinan/approve/[id], GET /api/bidangs.

### Files created (5) — all under `src/components/views/pimpinan/`
1. `pimpinan-views.tsx` (≈130 lines) — orchestrator. Maps pimpinan-command→PimpinanCommandView, pimpinan-critical→PimpinanCriticalView, pimpinan-kpi→PimpinanKpiView, pimpinan-trend→PimpinanTrendView, default null. Auth guard: `!user?.role?.startsWith('PIMPINAN')` → EmptyState "Akses ditolak — halaman ini untuk Pimpinan" + gold "Kembali ke Beranda". Top banner GlassCard: "Anda masuk sebagai {ROLE_LABELS[role]} · {scopeText}" + RoleBadge. scopeText = `bidangName` for Kabid OR "Akses penuh semua Bidang" for Kasatpol/Sekretaris. motion.div fade+slide 180ms. Container pt-6 max-w-7xl mx-auto px-4 sm:px-6.
2. `pimpinan-command-view.tsx` (≈720 lines) — Command Center. GoldShimmerText as=h1 "COMMAND CENTER" (text-2xl sm:text-4xl) + subtitle. GET /api/pimpinan/dashboard every 20s (silent). Top KPI strip 6 StatCards (Laporan Hari Ini gold / Minggu Ini blue / Bulan Ini amber / Critical Aktif red / Close Rate % green / SLA Compliance % conditional). Critical Alert banner (if criticalActive.length>0): red pulsing alert + "Lihat Semua Critical" setView pimpinan-critical. Two-col donuts: Risk distribution (recharts PieChart byRisk, RISK_LEVELS colors, Legend emoji+label formatter, RiskTooltip) + Status distribution (byStatus REPORT_STATUSES colors, StatusTooltip). Both 220px mobile / 300px desktop. By Category horizontal BarChart (layout=vertical, gold fill #ffd600, YAxis tickFormatter strips "Tertib ", top 10 desc, CategoryTooltip). By Kabupaten top 10 custom bars (gradient gold, ratio-based width). By Bidang shadcn Table (name + count + mini progress, % col hidden on mobile). Mini heatmap 27 kabupaten grid (grid-cols-9 aspect-square cells, gold opacity 0.08→0.95 by ratio, hover tooltip, zero-fill from KABUPATEN_KOTA, legend strip). Critical active mini-list top 5 (GlassCard border-l-2 red, ticket mono gold + RiskBadge + kabupaten + cat icon + SLA timer pill red/amber/green + "Tinjau →" openReport). Empty mini-list → EmptyState "Tidak ada laporan critical aktif 🎉" green check. Footer lastUpdated + avgResponse + closeRate + "Data diperbarui otomatis setiap 20 detik".
3. `pimpinan-critical-view.tsx` (≈430 lines) — Critical Alert Panel. Header: ShieldAlert (red, ping animation when active) + GoldShimmerText as=h1 "Critical Alert Panel" + subtitle "{filtered}/{total} ditampilkan". GET /api/pimpinan/critical?bidang= every 20s + manual Segarkan + last-updated. Bidang Select filter ("Semua Bidang" + 5 from /api/bidangs) — ONLY for Kasatpol/Sekretaris; Kabid sees Badge "Bidang {bidangName}" (backend auto-scopes). "Hanya Overdue" Switch (client filter on slaRemaining.overdue). Loading → RowSkeleton x3. Empty → EmptyState "Tidak ada laporan critical aktif 🎉" green CheckCircle2. Critical cards full-width GlassCard border-l-4 border-l-red-500/70 + critical-pulse. Row1: ticket mono gold + RiskBadge CRITICAL + StatusBadge + big SLA timer (red overdue "Lewat Xj Ym" / amber<15min / green via formatCriticalSla using report.slaRemaining from API + client fallback). Row2: CategoryIcon + cat name + kabupaten (MapPin) + address + Maps link (Google Maps q=lat,lng target=_blank). Row3 grid sm:grid-cols-3: description (line-clamp-2) + Pelapor (UserX if Anonim, UserCheck if named) + Bidang Penanganan (ShieldCheck+name OR red "Belum di-assign" badge with ShieldAlert). Row4 actions: "Tinjau Detail" outline (openReport) + "Approve Eskalasi" gold (POST /api/pimpinan/approve/[id] → toast + refetch, LoadingSpinner per-id, 404 toast) + "Buka WhatsApp Alert" green link (wa.me/?text=encoded message with ticket/cat/risk/kabupaten/alamat/desc≤400/bidang/Maps) + timeAgo(createdAt).
4. `pimpinan-kpi-view.tsx` (≈400 lines) — KPI per Bidang. Header: Target icon (gold) + GoldShimmerText as=h1 "KPI per Bidang" + subtitle. Kabid scope note GlassCard border-jabar-gold/30: "Menampilkan KPI Bidang Anda — {bidangName}". Frontend safety filter to user.bidangId (if Kabid). Summary strip 5 StatCards (Total Aktif gold / Selesai Bulan Ini green / Rata-rata Response blue `${avg}j` / Close Rate amber / SLA Compliance conditional). Grid of GlassCards (grid-cols-1 md:grid-cols-2 lg:grid-cols-3, 1 per Bidang). Each card: bidang name (gold) + description (line-clamp-2 from /api/bidangs first, fallback getBidang(code).description) + SLA tier badge + 4 MiniStats (Aktif/Selesai Bulan Ini/Avg Response/Close Rate) + custom SLA Compliance Progress bar (`<div role="progressbar" aria-valuenow/min/max>` with gradient inner bar): green≥80% "Sangat Baik" / amber 60-80% "Perlu Perhatian" / red<60% "Kritis". Scale footnote "0% / Target: 80%+ / 100%". GET /api/pimpinan/kpi once on mount + 60s silent polling. /api/bidangs fetched once (cached in state). Legend footer GlassCard with SLA tier legend + "Auto-refresh setiap 60 detik".
5. `pimpinan-trend-view.tsx` (≈460 lines) — Trend Analitik. Header: LineChartIcon (gold) + GoldShimmerText as=h1 "Trend Analitik" + subtitle. Segarkan + "Ekspor Laporan (PDF)" gold button (handlePrint → `if (typeof window !== "undefined") window.print()`). GET /api/pimpinan/dashboard once + 60s silent polling. recharts AreaChart (gold line strokeWidth 2.5 + gold gradient fill `<linearGradient id="trendGoldFill">` 0.55→0.04 opacity, gold dots r=3, activeDot r=5 white stroke gold, custom TrendTooltip Indonesian dd-MMM). Height 240px mobile / 300px desktop. Header "Hari ini: {today}" badge. Month comparison grid lg:grid-cols-3: StatCard "Bulan Ini" gold (thisMonth) + StatCard "Periode Lalu" blue (totalReports - thisMonth) + delta GlassCard (ArrowUp red if delta>0=more=bad / ArrowDown green if delta<0=fewer=good / TrendingUp muted if 0). Prediction GlassCard border-jabar-gold/30 Sparkles header "Prediksi 7 hari ke depan" — 3 cells: Rata-rata per hari (sum/7, gold), Estimasi 7 hari (avg×7, jabar-blue), Tren mingguan (Naik/Turun/Stabil with matching arrow). Footnote disclaimer "estimasi naif moving average 7 hari, akurasi dipengaruhi oleh musim/kejadian luar biasa/perubahan kebijakan". Top 8 categories shadcn Table (# / kategori / laporan / % — % hidden on mobile, computed from categoryTotal of top 8). Top 5 kabupaten ranked list (numbered circle 1-5 + name + gradient bar + count). Footer avgResponse + closeRate + sla + "Data diperbarui otomatis setiap 60 detik".

### Validation
- ✅ `bun run lint` — EXIT 0, clean (no errors, no warnings). Fixed 1 issue: unused `eslint-disable-next-line react-hooks/exhaustive-deps` directive inside KpiView's initial useEffect (rule wasn't firing on `[load]` deps array — removed directive, kept `[load]` deps).
- ✅ `bunx tsc --noEmit -p tsconfig.json` — ZERO errors in `src/components/views/pimpinan/*` (remaining TS errors are in R2 backend routes + foundation `db-raw.ts` + examples/skills — out of R4c scope, noted in R4a/R4b worklogs).
- ✅ `tail -100 dev.log` (non-API lines) — only "✓ Compiled in Nms" entries + the pre-existing `EADDRINUSE :::3000` startup race from init-fullstack (already explained in R4b worklog; the running dev server is fine and compiling my new pimpinan views cleanly).

### Critical design points
1. **All "use client"** ✅ — every file starts with `"use client";`.
2. **Hydration-safe** ✅ — no `navigator`/`window`/`document` at module/render top-level. `window.setInterval`/`clearInterval` only inside `useEffect`. `lastUpdated.toLocaleTimeString("id-ID")` rendered null initially. `window.print()` guarded with `typeof window !== "undefined"`.
3. **Auth: PIMPINAN_* only** ✅ — orchestrator checks `!user?.role?.startsWith('PIMPINAN')` → EmptyState. API 401 → toast "Sesi berakhir" + return. API 403 → toast "Akses ditolak".
4. **Polling intervals** ✅: Command 20s, Critical 20s (+ refetch on bidang filter change), KPI 60s, Trend 60s. All cleared on unmount.
5. **recharts named imports** ✅ — no default imports. All charts use ResponsiveContainer width 100%.
6. **framer-motion v12** ✅ — AnimatePresence mode="wait" + motion.div keyed on view, 180ms easeOut fade+slide.
7. **Kabid scoping** ✅ — backend filters via `scopeBidangId` in /api/pimpinan/dashboard and /api/pimpinan/critical. Frontend shows scope note (KPI view) + bidang badge (Critical filter bar). KPI view also has frontend safety filter to `user.bidangId`. No backend override.
8. **Toast feedback** ✅ — useToast (radix) on approve eskalasi, 401/403/404, dashboard/critical/kpi/trend load failures.
9. **Dark theme midnight navy + gold** ✅ — `bg-background`, `text-foreground`, `text-jabar-gold` (#ffd600), glass-card class. NO indigo/purple. Red accent for critical/overdue, green/amber for SLA.
10. **Mobile-first responsive** ✅ — grid-cols-2 → lg:grid-cols-3/5 patterns; charts 220/240px mobile / 300px desktop; tables hide % column on mobile; touch-friendly button sizes.
11. **Accessibility** ✅ — semantic `<header>`/`<section>`/`<footer>`/`<button>`/`<table>`, `aria-label` on inputs/buttons/links, `role="progressbar"` + `aria-valuenow/min/max` on SLA bar, `aria-hidden` on icons.
12. **Indonesian UI text** ✅ — all labels in Bahasa Indonesia (Command Center, Segarkan, Lihat Semua Critical, Approve Eskalasi, Buka WhatsApp Alert, Belum di-assign, Hanya Overdue, Semua Bidang, Sangat Baik, Perlu Perhatian, Kritis, Prediksi 7 hari ke depan, Ekspor Laporan, Bulan Ini, Periode Lalu, Naik/Turun/Stabil, dll).

### Lead handoff notes
- **`PimpinanViews`** is the default export target. Lead should render `<AppBoot>{view.startsWith('operator-') ? <OperatorViews/> : view.startsWith('pimpinan-') ? <PimpinanViews/> : <MasyarakatViews/>}</AppBoot>` (mirrors R4a/R4b handoff pattern).
- The orchestrator returns `null` for non-`pimpinan-*` views.
- `openReport(id)` (store action) is the canonical drill-in from Command Center's critical mini-list and Critical Panel's "Tinjau Detail" button → sets `selectedReportId` + `view='operator-detail'` atomically. R2 backend /api/reports/[id] GET allows PIMPINAN role since `isStaff()` includes PIMPINAN_*.
- **Polling intervals**: 20s for command+critical (real-time SLA), 60s for KPI+trend (heavier multi-COUNT queries). All silent (no spinner flicker).
- Trend view's "Periode Lalu" = `totalReports - thisMonth` (rough approximation labeled honestly as "Total sebelum bulan ini" — backend only provides 7-day trend + thisMonth count, no per-day breakdown for prior months).
- Approve Eskalasi flow uses POST /api/pimpinan/approve/[id] (R2 backend) — sets status='DIPROSES', inProgressAt=now (if null), creates ESCALATE progress note with pimpinan role label. Critical Panel refetches list on success.

### Quirks encountered
1. **`react-hooks/exhaustive-deps` rule not firing on KpiView's initial useEffect** — initially had `eslint-disable-next-line` directive inside effect body but rule wasn't firing on `[load]` deps. Fix: removed directive, kept `[load]` deps (load is wrapped in useCallback with `[bidangs, toast]` — stable per render unless bidangs changes).
2. **Dashboard `trend` is 7-day not 30-day** — task spec mentions "30-day trend" but backend `countReportsLast7Days()` returns last 7 days only. Honest label "Tren 7 Hari Terakhir" used in AreaChart header. Month comparison uses `thisMonth` count + `totalReports - thisMonth` (rough estimate of all prior months combined).
3. **`criticalActive` shape from /api/pimpinan/dashboard** — backend R2 returns simplified objects `{id, ticketNumber, category, description, kabupaten, address, riskLevel, status, createdAt, slaDeadline}` (NOT the full shapeReport output). For Command Center mini-list, this is sufficient (no PII). For Critical Panel, the dedicated /api/pimpinan/critical endpoint returns full `shapeReport()` output with `slaRemaining`, `reporterName`, `isAnonymous`, `latitude`, `longitude`, `assignedBidangId`, `photos`, etc.
4. **`byRisk` key is `level`, not `riskLevel`** — backend R2 dashboard returns `[{level: 'CRITICAL', count: 3}]`. PieChart's `nameKey="level"` and Legend formatter receives the level key, looks up `RISK_LEVELS[level]` for emoji+label.
5. **`bidangFilter` change re-runs both Critical useEffects** — initial-fetch effect and polling effect both have `[bidangFilter, load]` deps. When bidangFilter changes: (1) initial effect calls `load({bidang: newFilter})` once, (2) polling effect tears down old interval and starts new one with new bidangFilter. Confirmed correct — no double-fetch (initial effect's load() returns promise; polling effect's setInterval only fires after 20s).

---
Task ID: R-FINAL (rebuild after sandbox reset)
Agent: Lead (main)
Task: Rebuild entire app from scratch after sandbox reset wiped all code+deliverables

Work Log:
- Sandbox reset (Oct 8) wiped ALL: src/, deliverables, worklog. Restored scaffold via init-fullstack.
- R1 Foundation (Lead): prisma/schema.prisma, lib/constants.ts (18 cats, 27 kab, 5 bidang, RISK/STATUS/ROLES, TRADEMARK, upload 3×2MB), lib/auth.ts (JWT scrypt), lib/report-helpers.ts, lib/db-raw.ts (raw libsql + ensureTables + all helpers incl updateUserPassword), lib/api-client.ts, store/app-store.ts (Zustand SPA), globals.css (midnight navy), layout.tsx (dark, PWA), public/manifest+sw+offline-data+logo-satpol.svg+icons. Install @prisma/adapter-libsql@6.11.1+@libsql/client. db:push.
- R2 Backend (subagent): 19 API routes raw libsql — auth (register/login/logout/me/change-password), reports (POST+GET/upload/[id]/track/stats), operator (inbox/dashboard), pimpinan (dashboard/critical/kpi/approve), bidangs, setup (create tables+5 bidang+4 staff), ai/analyze-report. Added lib/api-helpers.ts. 0 Prlesia imports. Lint clean.
- R3 Shared UI (subagent): 19 components — AppShell, SiteHeader (with Ganti Password button), SiteFooter (sticky Budong badge), BottomNav, GlassCard, GoldShimmerText, RiskBadge, StatusBadge, RoleBadge, StatCard, CategoryIcon, Loading, EmptyState, AppBoot, ChangePasswordDialog, ThemeProvider, LogoSatpolpp/Pemprov, MapPreview.
- R4a Masyarakat views (subagent): masyarakat-views (orchestrator), landing (hero+stats+17 cats+cara kerja+risk legend), lapor (4 sections: identitas NIK+detail+GPS+upload 3×2MB+anonim), track (timeline+pipeline), transparency (recharts bar/pie/line), login.
- R4b Operator views (subagent): operator-views, inbox (15s polling+5 filter tabs+SLA timer), detail (AI Saran+verifikasi+assign+status+photosAfter+critical eskalasi WhatsApp), dashboard (6 StatCards+SLA Progress).
- R4c Pimpinan views (subagent): pimpinan-views, command (20s polling+critical banner+risk/status donuts+category bars+kabupaten heatmap+critical mini-list), critical (20s polling+SLA timer+approve+WhatsApp), kpi (per-Bidang cards+SLA progress+Kabid scope), trend (recharts AreaChart+month compare+prediction+window.print).
- R5 Assembly: page.tsx (AppBoot + 3 lazy-loaded orchestrators). seed-samples (8 reports). Lint clean. Login verified: kasatpol → 200 PIMPINAN_KASATPOL. Browser: landing + login + Command Center + Critical + KPI all load.
- R6 Deliverables: download/yeuh-satpol-source.zip (369KB, 183 files, 0 Prlesia), resume-yeuh-satpol.pdf (2MB, 6 pages, with creds), pedoman-penggunaan-yeuh-satpol.pdf (1.7MB, 6 pages, no passwords).

Stage Summary:
- ✅ APLIKASI PARIPURNA REBUILT: 19 backend routes raw libsql + 19 shared UI + 3 role views (masyarakat 5 + operator 4 + pimpinan 5) + PWA + 3 deliverables.
- ✅ Semua koreksi user terpenuhi: ganti password (semua akun), upload 3×2MB, kabid baru (kabidsatpol@jabar.go.id), alur lapor di-fix (raw libsql).
- ✅ 3 deliverable di download/: ZIP source (re-upload ke GitHub), resume PDF (pimpinan internal+creds), pedoman PDF (user umum, no password).
- User: re-upload ZIP ke GitHub Desktop → Vercel auto-deploy → set SETUP_KEY → /api/setup?key=... → semua fitur jalan.
