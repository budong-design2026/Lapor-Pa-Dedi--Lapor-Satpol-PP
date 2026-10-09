// /api/bidangs — auth any logged-in. List bidangs.
import { NextResponse } from "next/server";
import { ensureTables, getBidangs } from "@/lib/db-raw";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    await ensureTables();
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: "Akses ditolak. Silakan login." }, { status: 401 });
    }
    const bidangs = await getBidangs();
    return NextResponse.json({
      bidangs: bidangs.map((b) => ({
        id: String(b.id),
        code: String(b.code),
        name: String(b.name),
        description: b.description ? String(b.description) : null,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Gagal memuat bidang", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
