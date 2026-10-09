// /api/auth/me — current session user
import { NextResponse } from "next/server";
import { getUserById, getBidangById, ensureTables } from "@/lib/db-raw";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    await ensureTables();
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ user: null });
    }
    const user = await getUserById(session.sub);
    if (!user) {
      return NextResponse.json({ user: null });
    }
    let bidangName: string | null = null;
    if (user.bidangId) {
      const b = await getBidangById(String(user.bidangId));
      bidangName = b ? String(b.name) : null;
    }
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
      { error: "Gagal memuat user", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
