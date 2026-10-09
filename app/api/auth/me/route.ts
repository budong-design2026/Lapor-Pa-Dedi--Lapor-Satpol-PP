// /api/auth/me — Return current user from JWT (refresh bidang name via raw libsql).
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserById, getBidangByCode, raw } from "@/lib/db-raw";

export async function GET() {
  try {
    const payload = await getCurrentUser();
    if (!payload) return NextResponse.json({ user: null });

    const u = await getUserById(payload.sub);
    if (!u) return NextResponse.json({ user: null });

    let bidangName: string | null = null;
    if (u.bidangId) {
      // bidangId could be id or code — check both
      const res = await raw().execute({
        sql: `SELECT * FROM "Bidang" WHERE "id" = ? OR "code" = ? LIMIT 1`,
        args: [u.bidangId, u.bidangId],
      });
      if (res.rows[0]) {
        bidangName = String((res.rows[0] as Record<string, unknown>).name);
      } else {
        const byCode = await getBidangByCode(u.bidangId);
        if (byCode) bidangName = byCode.name;
      }
    }

    return NextResponse.json({
      user: {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        bidangId: u.bidangId,
        bidangName,
      },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
