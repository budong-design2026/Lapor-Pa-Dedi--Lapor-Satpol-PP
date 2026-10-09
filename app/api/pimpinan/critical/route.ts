// /api/pimpinan/critical — auth PIMPINAN. Active CRITICAL reports (optional bidang filter).
import { NextResponse } from "next/server";
import { raw, ensureTables } from "@/lib/db-raw";
import { getCurrentUser } from "@/lib/auth";
import { isPimpinan, shapeReport } from "@/lib/api-helpers";
import { slaTimeRemaining } from "@/lib/report-helpers";

export async function GET(req: Request) {
  try {
    await ensureTables();
    const session = await getCurrentUser();
    if (!session || !isPimpinan(session.role)) {
      return NextResponse.json({ error: "Akses ditolak. Login sebagai pimpinan." }, { status: 403 });
    }
    const url = new URL(req.url);
    const bidang = url.searchParams.get("bidang") ?? undefined;
    // PIMPINAN_KABID auto-scope to own bidang
    const scopeBidang = session.role === "PIMPINAN_KABID" && session.bidangId ? session.bidangId : bidang;

    const args: unknown[] = [];
    let where = `"riskLevel" = ? AND "status" IN (?,?,?)`;
    args.push("CRITICAL", "DITERIMA", "DIVERIFIKASI", "DIPROSES");
    if (scopeBidang) {
      where += ` AND "assignedBidangId" = ?`;
      args.push(scopeBidang);
    }
    const res = await raw().execute({
      sql: `SELECT * FROM "Report" WHERE ${where} ORDER BY "createdAt" ASC`,
      args,
    });
    const reports = res.rows.map((r) => {
      const shaped = shapeReport(r as Record<string, unknown>);
      if (!shaped) return null;
      const sla = slaTimeRemaining(shaped.slaDeadline as string | null);
      return { ...shaped, slaRemaining: sla };
    }).filter(Boolean);
    return NextResponse.json({ reports, total: reports.length });
  } catch (err) {
    return NextResponse.json(
      { error: "Gagal memuat laporan kritis", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
