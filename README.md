# Yeuh Satpol! — Pengaduan Trantibumlinmas Jabar

> **Yeuh Pa Dedi, yeuh SatpolPP Jabar, aya pelanggaran !!!**
> ⚡ Budong_production2026

Aplikasi pengaduan masyarakat Satpol PP Provinsi Jawa Barat. Next.js 16 + TypeScript + Turso (libSQL) + raw libsql (tanpa Prlesia engine, jalan di Vercel serverless).

## Stack
- Next.js 16 App Router, TypeScript 5, Tailwind CSS 4, shadcn/ui, Framer Motion, recharts.
- Database: Turso (libSQL, region Singapore) via raw `@libsql/client` (bypass Prlesia — reliable di Vercel).
- Auth: custom JWT (crypto.scrypt + HS256, httpOnly cookie).
- AI: z-ai-web-dev-sdk (smart routing risk + Bidang + pasal Perda).

## 3 Role
- **Masyarakat** (publik, tanpa login): lapor (3 foto × 2MB, GPS, NIK, anonim), lacak tiket, transparansi publik.
- **Operator** (login): inbox real-time (15s polling), verifikasi, AI Saran, assign risk+Bidang, eskalasi Critical 1-klik WhatsApp.
- **Pimpinan** (login): Command Center (20s polling), Critical Alert Panel, KPI per Bidang, Trend Analitik.

## Run lokal
```bash
bun install
bun run db:push
bun run dev   # http://localhost:3000
```
Buka `/api/setup` sekali untuk inisialisasi DB (5 Bidang + admin dari env ADMIN_*).

## Deploy Vercel
Set env vars: `DATABASE_URL` (libsql://...), `DATABASE_AUTH_TOKEN`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`. Lihat **DEPLOY.md**.

## Akun demo (dibuat /api/setup)
- Super Admin: `kasatpol@jabar.go.id` / dari env ADMIN_PASSWORD
- Operator: `operator@jabar.go.id` / `OperatorJabar!Tegas26`
- Kabid: `kabidsatpol@jabar.go.id` / `KabidSatpolJabar26`
- Sekretaris: `sekretaris@jabar.go.id` / `SekretarisJabar!Mantap26`

Semua akun bisa ganti password sendiri via tombol "Ganti Password" di header.

## Legalitas
Perda No. 13 Tahun 2018 jo. Perda No. 5 Tahun 2021. Tugas Satpol PP Jabar: Penegakan Perda dan Perkada, Penyelenggaraan Trantibum, dan Perlindungan Masyarakat.

© 2026 Satpol PP Provinsi Jawa Barat. ⚡ Budong_production2026
