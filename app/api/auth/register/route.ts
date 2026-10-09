// /api/auth/register — register MASYARAKAT (public) or staff (PIMPINAN-only)
import { NextResponse } from "next/server";
import {
  raw,
  genId,
  hashPassword,
  getUserByEmail,
  getBidangById,
  ensureTables,
} from "@/lib/db-raw";
import { getCurrentUser, setSessionCookie, signToken } from "@/lib/auth";
import { PIMPINAN_ROLES, ROLE_LABELS } from "@/lib/constants";

export async function POST(req: Request) {
  try {
    await ensureTables();
    const body = await req.json().catch(() => ({}));
    const {
      name,
      email,
      password,
      phone,
      nik,
      birthPlace,
      birthDate,
      address,
      role,
      bidangId,
    } = body as Record<string, string | undefined>;

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Nama, email, dan password wajib diisi" }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password minimal 8 karakter" }, { status: 400 });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) {
      return NextResponse.json({ error: "Format email tidak valid" }, { status: 400 });
    }

    const finalRole = role && role !== "MASYARAKAT" ? role : "MASYARAKAT";

    // If registering staff → require auth PIMPINAN_KASATPOL / PIMPINAN_SEKRETARIS
    if (finalRole !== "MASYARAKAT") {
      const session = await getCurrentUser();
      if (!session) {
        return NextResponse.json(
          { error: "Akses ditolak. Login sebagai pimpinan untuk mendaftarkan staff." },
          { status: 401 }
        );
      }
      const authorizedRoles = ["PIMPINAN_KASATPOL", "PIMPINAN_SEKRETARIS"];
      if (!authorizedRoles.includes(session.role)) {
        return NextResponse.json(
          { error: `Hanya ${ROLE_LABELS.PIMPINAN_KASATPOL} / ${ROLE_LABELS.PIMPINAN_SEKRETARIS} yang boleh mendaftarkan staff.` },
          { status: 403 }
        );
      }
      if (!PIMPINAN_ROLES.includes(finalRole) && finalRole !== "OPERATOR") {
        return NextResponse.json({ error: "Role staff tidak valid" }, { status: 400 });
      }
    }

    // Validate bidangId if provided
    let bidangName: string | null = null;
    let resolvedBidangId: string | null = null;
    if (bidangId) {
      const b = await getBidangById(String(bidangId));
      if (!b) {
        return NextResponse.json({ error: "Bidang tidak ditemukan" }, { status: 400 });
      }
      resolvedBidangId = String(b.id);
      bidangName = String(b.name);
    }
    // Staff with OPERATOR/PIMPINAN_KABID must have bidangId
    if ((finalRole === "OPERATOR" || finalRole === "PIMPINAN_KABID") && !resolvedBidangId) {
      return NextResponse.json({ error: "Staff OPERATOR/PIMPINAN_KABID wajib memilih bidang" }, { status: 400 });
    }

    // Email unique
    const existing = await getUserByEmail(String(email).toLowerCase());
    if (existing) {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
    }

    const id = genId();
    const passwordHash = hashPassword(String(password));
    await raw().execute({
      sql: `INSERT INTO "User" ("id","email","password","name","phone","role","bidangId","nik","birthPlace","birthDate","address","createdAt","updatedAt") VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`,
      args: [
        id,
        String(email).toLowerCase(),
        passwordHash,
        String(name),
        phone ?? null,
        finalRole,
        resolvedBidangId,
        nik ?? null,
        birthPlace ?? null,
        birthDate ?? null,
        address ?? null,
      ],
    });

    const token = signToken({
      sub: id,
      email: String(email).toLowerCase(),
      name: String(name),
      role: finalRole,
      bidangId: resolvedBidangId,
    });
    await setSessionCookie(token);

    return NextResponse.json(
      {
        user: {
          id,
          email: String(email).toLowerCase(),
          name: String(name),
          role: finalRole,
          bidangId: resolvedBidangId,
          bidangName,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Gagal mendaftar", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
