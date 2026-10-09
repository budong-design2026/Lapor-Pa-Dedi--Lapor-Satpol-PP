// /api/bidangs — GET list of all Bidang (raw libsql).
// Operator/Pimpinan use this to populate the "Assign ke Bidang" select with real db ids.
// Auth: any logged-in user (operator/pimpinan). Masyarakat/tamu get 401.
import { NextResponse } from "next/server";
import { getBidangs } from "@/lib/db-raw";
import { getCurrentUser } from "@/lib/auth";
import { BIDANG_LIST } from "@/lib/constants";

export async function GET() {
  try {
    const u = await getCurrentUser();
    if (!u) {
      return NextResponse.json(
        { error: "Unauthorized — silakan login" },
        { status: 401 }
      );
    }

    const rows = await getBidangs();
    // Merge handles + description fallback from constants for richer UI hint
    const merged = rows.map((b) => {
      const meta = BIDANG_LIST.find((c) => c.code === b.code);
      return {
        id: b.id,
        code: b.code,
        name: b.name,
        description: b.description ?? meta?.description ?? "",
        handles: meta?.handles ?? [],
      };
    });

    return NextResponse.json({ bidangs: merged });
  } catch {
    return NextResponse.json(
      { error: "Gagal memuat daftar Bidang" },
      { status: 500 }
    );
  }
}
