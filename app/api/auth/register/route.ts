// /api/auth/register — POST register user (raw libsql).
// If body.role is staff (OPERATOR/PIMPINAN_*): require authenticated caller
// with role PIMPINAN_KASATPOL or PIMPINAN_SEKRETARIS (else 403).
// If body.role is MASYARAKAT or omitted: public self-registration allowed.
import { NextResponse } from "next/server";
import { getCurrentUser, signToken, setSessionCookie } from "@/lib/auth";
import {
  hashPassword,
  raw,
  genId,
  getUserByEmail,
  getBidangById,
  getBidangByCode,
  writeAuditLog,
} from "@/lib/db-raw";
import { PIMPINAN_ROLES } from "@/lib/constants";

const STAFF_ROLES = ["OPERATOR", ...PIMPINAN_ROLES];

interface RegisterBody {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
  nik?: string;
  birthPlace?: string;
  birthDate?: string;
  address?: string;
  role?: string;
  bidangId?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as RegisterBody | null;
    if (!body) {
      return NextResponse.json(
        { error: "Body JSON tidak valid" },
        { status: 400 }
      );
    }

    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const role = (body.role ?? "MASYARAKAT").toUpperCase();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nama, email, dan password wajib diisi" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password minimal 6 karakter" },
        { status: 400 }
      );
    }

    // Email uniqueness pre-check
    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 409 }
      );
    }

    let bidangId: string | null = null;
    const isStaff = STAFF_ROLES.includes(role);

    if (isStaff) {
      // Staff registration requires an authenticated PIMPINAN_KASATPOL or PIMPINAN_SEKRETARIS caller
      const caller = await getCurrentUser();
      if (!caller) {
        return NextResponse.json(
          { error: "Pendaftaran staff memerlukan login Kasatpol PP / Sekretaris" },
          { status: 401 }
        );
      }
      const canCreateStaff =
        caller.role === "PIMPINAN_KASATPOL" || caller.role === "PIMPINAN_SEKRETARIS";
      if (!canCreateStaff) {
        return NextResponse.json(
          { error: "Hanya Kasatpol PP / Sekretaris yang dapat mendaftarkan staff" },
          { status: 403 }
        );
      }
      if (role === "OPERATOR" || role === "PIMPINAN_KABID") {
        if (!body.bidangId) {
          return NextResponse.json(
            { error: "bidangId wajib untuk role OPERATOR / PIMPINAN_KABID" },
            { status: 400 }
          );
        }
        // Accept either bidang id OR code
        const b =
          (await getBidangById(String(body.bidangId))) ??
          (await getBidangByCode(String(body.bidangId)));
        if (!b) {
          return NextResponse.json(
            { error: "Bidang tidak ditemukan" },
            { status: 400 }
          );
        }
        bidangId = b.id;
      }
    } else if (role !== "MASYARAKAT") {
      return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
    }

    const hashed = hashPassword(password);
    const id = genId();
    await raw().execute({
      sql: `INSERT INTO "User" (
        "id","email","password","name","phone","role","bidangId",
        "nik","birthPlace","birthDate","address"
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        id,
        email,
        hashed,
        name,
        body.phone?.trim() || null,
        role,
        bidangId,
        body.nik?.trim() || null,
        body.birthPlace?.trim() || null,
        body.birthDate?.trim() || null,
        body.address?.trim() || null,
      ],
    });

    // Look up bidang name (if any)
    let bidangName: string | null = null;
    if (bidangId) {
      const b = await getBidangById(bidangId);
      if (b) bidangName = b.name;
    }

    const token = signToken({
      sub: id,
      email,
      role,
      bidangId,
      name,
    });
    await setSessionCookie(token);
    await writeAuditLog(id, "LOGIN", null, `Register ${role}: ${email}`);

    return NextResponse.json({
      user: {
        id,
        email,
        name,
        role,
        bidangId,
        bidangName,
      },
    });
  } catch (err) {
    // Race-condition: someone inserted the same email between our pre-check and INSERT
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("constraint")) {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Gagal mendaftarkan akun", detail: msg.slice(0, 200) },
      { status: 500 }
    );
  }
}
