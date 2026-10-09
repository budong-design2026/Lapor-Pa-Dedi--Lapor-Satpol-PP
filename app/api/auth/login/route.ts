// /api/auth/login — Verify password via raw libsql (bypass Prlesia).
import { NextResponse } from "next/server";
import {
  getUserByEmail,
  verifyPassword,
  getBidangByCode,
  raw,
} from "@/lib/db-raw";
import { signToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email & password wajib" }, { status: 400 });
    }

    const user = await getUserByEmail(String(email).trim().toLowerCase());
    if (!user || !verifyPassword(String(password), user.password)) {
      return NextResponse.json(
        { error: "Email atau password salah" },
        { status: 401 }
      );
    }

    let bidangName: string | null = null;
    if (user.bidangId) {
      const res = await raw().execute({
        sql: `SELECT * FROM "Bidang" WHERE "id" = ? OR "code" = ? LIMIT 1`,
        args: [user.bidangId, user.bidangId],
      });
      if (res.rows[0]) {
        bidangName = String((res.rows[0] as Record<string, unknown>).name);
      } else {
        const byCode = await getBidangByCode(user.bidangId);
        if (byCode) bidangName = byCode.name;
      }
    }

    const token = signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      bidangId: user.bidangId,
      name: user.name,
    });
    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        bidangId: user.bidangId,
        bidangName,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Login gagal", detail: msg }, { status: 500 });
  }
}
