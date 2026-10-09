// /api/setup — GET + POST. Initialize DB tables, seed Bidangs + admin + demo staff.
import { NextResponse } from "next/server";
import {
  raw,
  ensureTables,
  countUsers,
  countBidangs,
  countReports,
  upsertBidang,
  getUserByEmail,
  getBidangByCode,
  genId,
} from "@/lib/db-raw";
import { hashPassword } from "@/lib/auth";
import { BIDANG_LIST, ROLE_LABELS } from "@/lib/constants";

// Inline user upsert that explicitly sets updatedAt (works with legacy Prisma-migrated schema
// where User table has NOT NULL updatedAt without default).
async function upsertUserRobust(
  email: string,
  name: string,
  role: string,
  passwordHash: string,
  bidangId: string | null
): Promise<void> {
  const ex = await getUserByEmail(email);
  if (ex) {
    await raw().execute({
      sql: `UPDATE "User" SET "name"=?, "role"=?, "password"=?, "bidangId"=?, "updatedAt"=datetime('now') WHERE "email"=?`,
      args: [name, role, passwordHash, bidangId, email],
    });
  } else {
    await raw().execute({
      sql: `INSERT INTO "User" ("id","email","password","name","role","bidangId","createdAt","updatedAt") VALUES (?,?,?,?,?,?,datetime('now'),datetime('now'))`,
      args: [genId(), email, passwordHash, name, role, bidangId],
    });
  }
}

async function runSetup(key?: string) {
  // Auth gate
  const setupKeyEnv = process.env.SETUP_KEY;
  if (setupKeyEnv) {
    if (key !== setupKeyEnv) {
      return NextResponse.json({ error: "Setup key salah" }, { status: 403 });
    }
  } else {
    const userCount = await countUsers();
    if (userCount > 0) {
      return NextResponse.json(
        { error: "DB sudah ada user. Hubungi admin untuk reset." },
        { status: 403 }
      );
    }
  }

  // Validate admin creds from env
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword || adminPassword.length < 10) {
    return NextResponse.json(
      { error: "ADMIN_EMAIL & ADMIN_PASSWORD (min 10 char) wajib di-set di environment." },
      { status: 400 }
    );
  }
  const adminName = process.env.ADMIN_NAME ?? "Kasatpol PP Jabar";

  await ensureTables();

  // Seed bidangs
  for (const b of BIDANG_LIST) {
    await upsertBidang(b.code, b.name, b.description);
  }

  // Resolve bidang id for TRANTIBUM (used by demo staff)
  const trantibum = await getBidangByCode("TRANTIBUM");

  // Admin user (PIMPINAN_KASATPOL, no bidang)
  await upsertUserRobust(adminEmail, adminName, "PIMPINAN_KASATPOL", hashPassword(adminPassword), null);

  // Demo staff
  const demoStaff: Array<{ email: string; name: string; role: string; bidangCode: string | null; password: string }> = [
    { email: "operator@jabar.go.id", name: "Operator Trantibum Jabar", role: "OPERATOR", bidangCode: "TRANTIBUM", password: "OperatorJabar!Tegas26" },
    { email: "kabidsatpol@jabar.go.id", name: "Kabid Trantibum Jabar", role: "PIMPINAN_KABID", bidangCode: "TRANTIBUM", password: "KabidSatpolJabar26" },
    { email: "sekretaris@jabar.go.id", name: "Sekretaris Satpol PP Jabar", role: "PIMPINAN_SEKRETARIS", bidangCode: null, password: "SekretarisJabar!Mantap26" },
  ];
  for (const s of demoStaff) {
    let bidangId: string | null = null;
    if (s.bidangCode) {
      const b = await getBidangByCode(s.bidangCode);
      bidangId = b ? String(b.id) : null;
    }
    await upsertUserRobust(s.email, s.name, s.role, hashPassword(s.password), bidangId);
  }

  const summary = {
    bidang: await countBidangs(),
    user: await countUsers(),
    report: await countReports(),
  };

  return NextResponse.json({
    ok: true,
    message: "Setup berhasil. Tabel dibuat, bidang & user admin ter-seed.",
    summary,
    accounts: {
      admin: { email: adminEmail, name: adminName, role: "PIMPINAN_KASATPOL", label: ROLE_LABELS.PIMPINAN_KASATPOL, bidangCode: null },
      staff: demoStaff.map((s) => ({
        email: s.email,
        name: s.name,
        role: s.role,
        label: ROLE_LABELS[s.role],
        bidangCode: s.bidangCode,
      })),
      trantibumBidangId: trantibum ? String(trantibum.id) : null,
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const key = (body as Record<string, unknown>).key;
    return await runSetup(typeof key === "string" ? key : undefined);
  } catch (err) {
    return NextResponse.json(
      { error: "Gagal setup", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key") ?? undefined;
    return await runSetup(key);
  } catch (err) {
    return NextResponse.json(
      { error: "Gagal setup", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
