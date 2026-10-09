# DEPLOY.md — Yeuh Satpol! ke Vercel

## Environment Variables (Vercel Project Settings)
| Key | Value |
|---|---|
| `DATABASE_URL` | Turso `libsql://yeuh-satpol-xxx.turso.io` |
| `DATABASE_AUTH_TOKEN` | Turso auth token (Sensitive) |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` (Sensitive, WAJIB) |
| `NEXTAUTH_URL` | `https://nama-proyek.vercel.app` |
| `ADMIN_EMAIL` | `kasatpol@jabar.go.id` |
| `ADMIN_PASSWORD` | password kuat min 10 char (Sensitive) |
| `ADMIN_NAME` | `Kepala Satpol PP Prov. Jawa Barat` |

## Langkah
1. Push repo ke GitHub (via GitHub Desktop: Add local repository → Publish).
2. Vercel → New Project → Import repo. JANGAN Deploy dulu → set 7 env vars di atas (Production tercentang).
3. Deploy. Build: `next build` (Vercel auto-detect Next.js).
4. Setelah Ready, buka `https://URL.vercel.app/api/setup` sekali → inisialisasi DB (5 Bidang + 4 akun staf).
5. Login di halaman utama.

## Setup Ulang / Buat Akun Staf
Set env `SETUP_KEY` (string acak, Sensitive). Buka `/api/setup?key=SETUP_KEY` → upsert semua akun (admin dari env + operator/kabid/sekretaris demo). Idempoten.

## Catatan
- Database permanen: Turso (Singapore region). Vercel filesystem ephemeral — WAJIB pakai Turso, BUKAN SQLite file.
- App pakai raw libsql (bukan Prlesia engine) — terbukti jalan di Vercel serverless.
- PWA: manifest.json + sw.js + offline-data.json di /public.

© 2026 Satpol PP Provinsi Jawa Barat. ⚡ Budong_production2026
