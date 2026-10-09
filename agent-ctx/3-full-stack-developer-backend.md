# Task ID 3 — Backend API routes + seed

Agent: full-stack-developer (backend)

## What I built

### A. Auth API (`src/app/api/auth/`)
- `POST /api/auth/register` — public MASYARAKAT self-reg; staff (OPERATOR/PIMPINAN_*) requires authenticated Kasatpol PP / Sekretaris caller; staff roles OPERATOR/PIMPINAN_KABID require `bidangId`; sets session cookie; 409 on duplicate email.
- `POST /api/auth/login` — verifies password via `verifyPassword`, signs token, sets cookie, writes LOGIN audit log; 401 on bad credentials.
- `POST /api/auth/logout` — clears cookie, writes LOGIN audit log.
- `GET /api/auth/me` — returns `{user: null}` when no session (for SPA hydration), else fetches fresh user from DB to get current bidang name.

### B. Reports API (`src/app/api/reports/`)
- `POST /api/reports` — public create. Validates category, generates ticket via `generateTicketNumber` with 5x retry on unique conflict, stores photos/videos as `stringifyArray`, optional riskLevel → computes slaDeadline, links `reporterId` only when caller is MASYARAKAT. Returns 201 with full serialized report.
- `POST /api/reports/upload` — multipart `file` upload. Images: jpeg/png/webp max 1MB; Videos: mp4/webm/mov max 5MB. Saves to `public/uploads/<uuid>.<ext>`. Returns `{url}`. 413/415 on violation.
- `GET /api/reports` — paginated list with filters (`status, riskLevel, kabupaten, category, assignedBidangId, search, sort`); privacy filter hides reporter PII for anonymous reports OR when caller is not OPERATOR/PIMPINAN_*.
- `GET /api/reports/[id]` — single report with progressNotes (include user name), parsed photos/videos/photosAfter arrays. Same privacy rules.
- `PATCH /api/reports/[id]` — OPERATOR-only. Body fields: `status, riskLevel, assignedBidangId, assignedTo, subCategory, progressNote, progressNoteType, photosAfter`. Auto-sets `verifiedAt`/`inProgressAt`/`resolvedAt` based on status; recalcs slaDeadline on risk change; creates ProgressNote + AuditLog.
- `GET /api/reports/track/[ticket]` — public tracking by ticket number. Returns status timeline + progressNotes (note + createdAt + authorName ONLY, no user IDs / PII). 404 if not found.
- `GET /api/reports/stats` — public aggregate (no PII): totalReports, thisMonth, completed, completionRate, byCategory, byKabupaten (top 10), byRisk, byStatus, avgResponseHours, last7Days. Filterable by `from`/`to`/`kabupaten`.

### C. Operator API (`src/app/api/operator/`)
- `GET /api/operator/inbox` — operator-optimized queue. Default sort: risk-first (CRITICAL > HIGH > MEDIUM > LOW), then newest. Filters: `all|unverified|in_progress|critical|overdue` (overdue = status not SELESAI/DITOLAK AND slaDeadline < now). Includes `slaRemaining` per item + `counts` bucket totals for badges. Full PII visible.
- `GET /api/operator/dashboard` — mini KPI: queueToday, unverified, inProgress, criticalActive, overdue, avgResponseHours, closeRate, slaCompliance.

### D. Pimpinan API (`src/app/api/pimpinan/`)
- `GET /api/pimpinan/dashboard` — command center aggregate. today/thisWeek/thisMonth, byRisk, byCategory, byKabupaten (all 27), byBidang, byStatus, criticalActive list (with slaRemaining), avgResponseHours, closeRate, slaCompliance, trend (30-day bucket). PIMPINAN_KABID scoped to own bidang; Kasatpol/Sekretaris full view.
- `GET /api/pimpinan/critical` — all CRITICAL active reports (status DITERIMA/DIVERIFIKASI/DIPROSES) with slaRemaining + assignee. Optional `bidang` query filter.
- `GET /api/pimpinan/kpi` — KPI per Bidang: activeReports, resolvedThisMonth, avgResponseHours, closeRate, slaCompliance.

### E. AI API (`src/app/api/ai/`)
- `POST /api/ai/analyze-report` — uses `z-ai-web-dev-sdk` (server-side only, dynamic import). System prompt instructs LLM to return STRICT JSON: `{suggestedRiskLevel, suggestedBidang, suggestedPasal[], reasoning}`. On LLM failure (network/parse/SDK), falls back to rule-based heuristic with CRITICAL/HIGH/MEDIUM/LOW keyword matching + BIDANG_LIST routing + pasal-by-category lookup. Always returns valid JSON; `source: "ai" | "heuristic"`. Verified live: real LLM returns structured suggestions.

### F. Shared helper — `src/lib/api-helpers.ts`
- `serializeReport(r, callerRole)` — JSON-safe shape, applies privacy rules (hides reporter PII when anonymous or caller lacks staff role)
- `fetchReportFull(id)` — include assignedBidang/assignee/progressNotes
- `requireOperator()` / `requirePimpinan()` — typed guards returning `{ok: true, user}` or `{ok: false, status, error}`
- `writeAudit(userId, action, reportId?, detail?)` — best-effort AuditLog insert (failures swallowed)
- `canSeePii(role)` — OPERATOR or PIMPINAN_* check
- `dayKey(d)` — `YYYY-MM-DD` helper

### G. Seed (`prisma/seed.ts`) + `bun db:seed` script
- Self-contained (does NOT import `next/headers`-based modules so `bun` can run it directly).
- Creates 5 Bidang (BIDANG_LIST), 5 demo users (hashed via local scrypt impl mirroring `hashPassword`), 8 sample reports across categories/kabupaten/risk/status, 6 progress notes attached, 2 sample AuditLog entries.
- All 8 reports: 2 CRITICAL (active — Bangunan roboh + Tanah longsor), 1 HIGH (anon PKL), 3 MEDIUM, 2 LOW (incl 2 SELESAI).
- Ran successfully via `bun prisma/seed.ts`. Verified via API endpoints.

## Demo login credentials
| Email | Password | Role | Bidang |
|---|---|---|---|
| `warga@jabar.go.id` | `warga123` | MASYARAKAT | — |
| `operator@jabar.go.id` | `operator123` | OPERATOR | Bidang Trantibum |
| `kasatpol@jabar.go.id` | `kasatpol123` | PIMPINAN_KASATPOL | — |
| `kabid.trantibum@jabar.go.id` | `kabid123` | PIMPINAN_KABID | Bidang Trantibum |
| `sekretaris@jabar.go.id` | `sekretaris123` | PIMPINAN_SEKRETARIS | — |

## API route files created
1. `src/app/api/auth/register/route.ts`
2. `src/app/api/auth/login/route.ts`
3. `src/app/api/auth/logout/route.ts`
4. `src/app/api/auth/me/route.ts`
5. `src/app/api/reports/route.ts` (POST + GET)
6. `src/app/api/reports/upload/route.ts`
7. `src/app/api/reports/[id]/route.ts` (GET + PATCH)
8. `src/app/api/reports/track/[ticket]/route.ts`
9. `src/app/api/reports/stats/route.ts`
10. `src/app/api/operator/inbox/route.ts`
11. `src/app/api/operator/dashboard/route.ts`
12. `src/app/api/pimpinan/dashboard/route.ts`
13. `src/app/api/pimpinan/critical/route.ts`
14. `src/app/api/pimpinan/kpi/route.ts`
15. `src/app/api/ai/analyze-report/route.ts`

Shared helpers:
- `src/lib/api-helpers.ts`
- `prisma/seed.ts` (run via `bun db:seed`)

## Seed result
Ran successfully — created 5 Bidang + 5 Users + 8 Reports + ~6 ProgressNotes + 2 AuditLogs.

## z-ai-web-dev-sdk API findings
- SDK default export is a class `ZAI` with `static create(): Promise<ZAI>`.
- Actual API: `const zai = await ZAI.create(); const completion = await zai.chat.completions.create({ messages, thinking: { type: 'disabled' } })` — `model` is optional (SDK uses default from `.z-ai-config`).
- Config file lives at `/etc/.z-ai-config` (root-readable) — SDK auto-discovers it; no env vars needed.
- Response shape: `completion.choices[0].message.content` is a string. We extract JSON via regex `\{[\s\S]*\}` and `JSON.parse` — LLM is told to return STRICT JSON only.
- SDK is ESM-only with `"type": "module"` — used `await import("z-ai-web-dev-sdk")` (dynamic) inside the route handler to avoid any build-time bundler issue; works fine with Next 16 server runtime.
- Verified live: real LLM returns `suggestedRiskLevel="CRITICAL"`, `suggestedBidang="TRANTIBUM"`, `suggestedPasal=["Pasal 124","Pasal 125","Pasal 126"]`, `reasoning="Korban jiwa akibat bangunan roboh..."`. AI mode works.
- Heuristic fallback is also tested by simulating invalid input — returns valid shape with `source: "heuristic"`.

## Lint & dev.log
- `bun run lint`: clean (no errors/warnings in backend files).
- Dev server `dev.log`: only one 500 seen (`/api/operator/dashboard` from a redundant `createdAt: { not: null }` filter that Prisma 6.19 rejected on a non-nullable column) — fixed in commit; subsequent requests return 200.
- Auth boundaries verified live: 401 for unauth, 403 for wrong role, 200 for valid caller.
- Privacy verified: public `/api/reports` hides reporterPhone/Nik/etc. for non-anonymous reports when caller is not staff; operator inbox shows full PII.

## Stage summary
Backend complete. 15 API routes (across 6 namespaces: auth, reports, reports/[id], reports/track, reports/stats, reports/upload, operator/inbox, operator/dashboard, pimpinan/dashboard, pimpinan/critical, pimpinan/kpi, ai/analyze-report). All return JSON via `NextResponse.json`. Auth via custom JWT cookie. Privacy enforced server-side. AuditLog written for create/login/status/assign/escalate/verify. AI route uses z-ai-web-dev-sdk with rule-based fallback. Seed script runnable via `bun db:seed`.

Next agents (frontend): can build SPA against these endpoints. `src/lib/api-client.ts` is already present for typed fetch + upload.
