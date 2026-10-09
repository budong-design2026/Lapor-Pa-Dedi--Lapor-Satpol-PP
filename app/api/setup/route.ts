// /api/setup — Initialize Turso DB + create ALL staff accounts (admin + operator + kabid + sekretaris).
// Uses raw libsql (bypass Prlesia).
import { NextResponse } from "next/server";
import {
  ensureTables,
  countUsers,
  countBidangs,
  countReports,
  upsertBidang,
  upsertUser,
  hashPassword,
  getBidangByCode,
} from "@/lib/db-raw";
import { BIDANG_LIST } from "@/lib/constants";

export async function POST(req: Request) {
  try {
    const setupKey = process.env.SETUP_KEY?.trim();
    let body: { key?: string } = {};
    try {
      body = await req.json();
    } catch {}

    // Auth gate
    if (setupKey) {
      if (body.key !== setupKey) {
        return NextResponse.json(
          { error: "Setup key salah. Kirim ?key=... atau { key: '...' } di body." },
          { status: 401 }
        );
      }
    } else {
      // No SETUP_KEY: allow only on empty DB (first bootstrap)
      await ensureTables();
      if (await countUsers() > 0) {
        return NextResponse.json(
          { error: "DB sudah ada user. Set env SETUP_KEY lalu buka /api/setup?key=... untuk setup ulang + buat semua akun staf." },
          { status: 403 }
        );
      }
    }

    const adminEmail = process.env.ADMIN_EMAIL?.trim();
    const adminPassword = process.env.ADMIN_PASSWORD?.trim();
    const adminName = process.env.ADMIN_NAME?.trim() || "Kepala Satpol PP Prov. Jawa Barat";

    if (!adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: "ADMIN_EMAIL & ADMIN_PASSWORD harus diset di env." },
        { status: 400 }
      );
    }
    if (adminPassword.length < 10) {
      return NextResponse.json({ error: "ADMIN_PASSWORD min 10 char." }, { status: 400 });
    }

    // 1. Create tables
    await ensureTables();

    // 2. Seed 5 Bidang
    for (const b of BIDANG_LIST) {
      await upsertBidang(b.code, b.name, b.description ?? "");
    }

    // 3. Seed super admin (Kasatpol PP) — from env
    await upsertUser(adminEmail, adminName, "PIMPINAN_KASATPOL", hashPassword(adminPassword));

    // 4. Seed demo staff accounts (operator, kabid, sekretaris)
    // These let leadership demo each role's view.
    const trantibum = await getBidangByCode("TRANTIBUM");
    const trantibumId = trantibum?.id ?? null;

    const staff = [
      {
        email: "operator@jabar.go.id",
        password: "OperatorJabar!Tegas26",
        name: "Operator Bidang Trantibum",
        role: "OPERATOR",
        bidangId: trantibumId,
      },
      {
        email: "kabidsatpol@jabar.go.id",
        password: "KabidSatpolJabar26",
        name: "Kepala Bidang Satpol PP",
        role: "PIMPINAN_KABID",
        bidangId: trantibumId,
      },
      {
        email: "sekretaris@jabar.go.id",
        password: "SekretarisJabar!Mantap26",
        name: "Sekretaris Satpol PP",
        role: "PIMPINAN_SEKRETARIS",
        bidangId: null,
      },
    ];
    for (const s of staff) {
      await upsertUser(s.email, s.name, s.role, hashPassword(s.password), s.bidangId);
    }

    return NextResponse.json({
      ok: true,
      message: "Database berhasil diinisialisasi. Semua akun staf dibuat. Sistem siap pakai.",
      summary: {
        bidang: await countBidangs(),
        user: await countUsers(),
        report: await countReports(),
      },
      accounts: {
        superAdmin: { email: adminEmail, role: "PIMPINAN_KASATPOL", password: "(dari env ADMIN_PASSWORD)" },
        operator: { email: "operator@jabar.go.id", role: "OPERATOR", password: "OperatorJabar!Tegas26" },
        kabid: { email: "kabidsatpol@jabar.go.id", role: "PIMPINAN_KABID", password: "KabidSatpolJabar26" },
        sekretaris: { email: "sekretaris@jabar.go.id", role: "PIMPINAN_SEKRETARIS", password: "SekretarisJabar!Mantap26" },
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Setup gagal.", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  return POST(
    new Request(req.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: key ?? undefined }),
    })
  );
}
