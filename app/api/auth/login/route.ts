// /api/auth/login — email + password login
import { NextResponse } from "next/server";
import {
  getUserByEmail,
  getBidangById,
  ensureTables,
} from "@/lib/db-raw";
import { verifyPassword, setSessionCookie, signToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await ensureTables();
    const body = await req.json().catch(() => ({}));
    const { email, password } = body as Record<string, string | undefined>;
    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password wajib diisi" }, { status: 400 });
    }
    const user = await getUserByEmail(String(email).toLowerCase());
    if (!user) {
      return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
    }
    const ok = verifyPassword(String(password), String(user.password));
    if (!ok) {
      return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
    }

    let bidangName: string | null = null;
    if (user.bidangId) {
      const b = await getBidangById(String(user.bidangId));
      bidangName = b ? String(b.name) : null;
    }

    const token = signToken({
      sub: String(user.id),
      email: String(user.email),
      name: String(user.name),
      role: String(user.role),
      bidangId: user.bidangId ? String(user.bidangId) : null,
    });
    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: String(user.id),
        email: String(user.email),
        name: String(user.name),
        role: String(user.role),
        bidangId: user.bidangId ?? null,
        bidangName,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Gagal login", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
