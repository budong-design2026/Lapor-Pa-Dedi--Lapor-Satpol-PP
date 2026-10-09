// prisma/seed.ts — Production seed for Yeuh Satpol!
// Creates ONLY the real organisational structure (5 Bidang Satpol PP Jabar) +
// ONE bootstrap admin account read from environment variables.
//
// NO demo reports, NO demo user accounts, NO mock/simulation data.
//
// Usage:
//   bun prisma/seed.ts
//
// Environment (for bootstrap admin):
//   ADMIN_EMAIL     e.g. kasatpol@jabar.go.id
//   ADMIN_PASSWORD  a STRONG password (min 10 chars) — set via Vercel env or secret
//   ADMIN_NAME      e.g. "Kepala Satpol PP Prov. Jawa Barat"
//
// If ADMIN_EMAIL / ADMIN_PASSWORD are not set, the script still seeds the 5
// Bidang but prints instructions for creating the first admin via the API.
import { PrismaClient } from "@prisma/client";
import { scryptSync, randomBytes } from "node:crypto";
import { BIDANG_LIST } from "../src/lib/constants";

const db = new PrismaClient();

// Local hashPassword impl (mirrors src/lib/auth.ts) — avoids importing next/headers
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

async function main() {
  console.log("=== Yeuh Satpol! — Production Seed ===\n");

  // ── 1. Five Bidang (real Satpol PP Jabar organisational structure) ──
  console.log("→ Membuat 5 Bidang Satpol PP Jabar…");
  const bidangMap: Record<string, string> = {};
  for (const b of BIDANG_LIST) {
    const rec = await db.bidang.upsert({
      where: { code: b.code },
      update: { name: b.name, description: b.description },
      create: { code: b.code, name: b.name, description: b.description },
    });
    bidangMap[b.code] = rec.id;
    console.log(`  ✓ ${b.code} — ${b.name}`);
  }

  // ── 2. Bootstrap admin (from env, ONE account, Kasatpol PP) ──
  const adminEmail = env("ADMIN_EMAIL");
  const adminPassword = env("ADMIN_PASSWORD");
  const adminName = env("ADMIN_NAME") || "Kepala Satpol PP Prov. Jawa Barat";

  console.log("\n→ Bootstrap admin (PIMPINAN_KASATPOL)…");
  if (!adminEmail || !adminPassword) {
    console.log("  ⚠  ADMIN_EMAIL / ADMIN_PASSWORD tidak diset di environment.");
    console.log("     Skip pembuatan admin. Hanya 5 Bidang yang dibuat (sistem siap).");
    console.log("\n     Untuk membuat admin pertama, jalankan:");
    console.log("       ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME=... bun prisma/seed.ts");
    console.log("     Setelah itu, admin bisa mendaftarkan operator/kabid/sekretaris via UI.\n");
  } else {
    if (adminPassword.length < 10) {
      throw new Error(
        "ADMIN_PASSWORD harus minimal 10 karakter untuk produksi. " +
          "Gunakan password yang kuat (campuran huruf, angka, simbol)."
      );
    }
    await db.user.upsert({
      where: { email: adminEmail },
      update: { name: adminName, role: "PIMPINAN_KASATPOL", password: hashPassword(adminPassword) },
      create: {
        email: adminEmail,
        name: adminName,
        role: "PIMPINAN_KASATPOL",
        password: hashPassword(adminPassword),
      },
    });
    console.log(`  ✓ Admin Kasatpol PP dibuat: ${adminEmail}`);
    console.log("     → Ganti password ini segera setelah login pertama via prosedur internal.");
  }

  // ── 3. Summary ──
  const bidangCount = await db.bidang.count();
  const userCount = await db.user.count();
  const reportCount = await db.report.count();
  console.log("\n=== Ringkasan ===");
  console.log(`  Bidang       : ${bidangCount}`);
  console.log(`  User         : ${userCount} (hanya admin bootstrap jika env diset)`);
  console.log(`  Laporan      : ${reportCount} (0 — bersih, siap diisi laporan nyata)`);
  console.log(`  ProgressNote : ${await db.progressNote.count()}`);
  console.log(`  AuditLog     : ${await db.auditLog.count()}`);
  console.log("\n✓ Seed selesai. Sistem siap pakai — tanpa data dummy.\n");
}

main()
  .catch((e) => {
    console.error("✗ Seed gagal:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
