// /api/pimpinan/kpi — auth PIMPINAN. Per-bidang KPI matrix.
import { NextResponse } from "next/server";
import {
  raw,
  ensureTables,
  getBidangs,
  countReportsWhereArgs,
  avgResponseHoursBidang,
} from "@/lib/db-raw";
import { getCurrentUser } from "@/lib/auth";
import { isPimpinan } from "@/lib/api-helpers";

export async function GET() {
  try {
    await ensureTables();
    const session = await getCurrentUser();
    if (!session || !isPimpinan(session.role)) {
      return NextResponse.json({ error: "Akses ditolak. Login sebagai pimpinan." }, { status: 403 });
    }
    const bidangs = await getBidangs();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const kpi = await Promise.all(
      bidangs.map(async (b) => {
        const activeReports = await countReportsWhereArgs(
          `"assignedBidangId"=? AND "status" IN (?,?,?)`,
          [String(b.id), "DITERIMA", "DIVERIFIKASI", "DIPROSES"]
        );
        const resolvedThisMonth = await countReportsWhereArgs(
          `"assignedBidangId"=? AND "status"=? AND "resolvedAt" IS NOT NULL AND "resolvedAt" >= ?`,
          [String(b.id), "SELESAI", monthStart.toISOString()]
        );
        const avgResp = await avgResponseHoursBidang(String(b.id));
        const totalAssigned = await countReportsWhereArgs(`"assignedBidangId"=?`, [String(b.id)]);
        const completed = await countReportsWhereArgs(
          `"assignedBidangId"=? AND "status"=?`,
          [String(b.id), "SELESAI"]
        );
        const closeRate = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0;
        const resolvedOnTime = await countReportsWhereArgs(
          `"assignedBidangId"=? AND "status"=? AND "slaDeadline" IS NOT NULL AND "resolvedAt" IS NOT NULL AND "resolvedAt" <= "slaDeadline"`,
          [String(b.id), "SELESAI"]
        );
        const slaCompliance = completed > 0 ? Math.round((resolvedOnTime / completed) * 100) : 100;
        return {
          bidangId: String(b.id),
          bidangCode: String(b.code),
          bidangName: String(b.name),
          activeReports,
          resolvedThisMonth,
          avgResponseHours: Math.round(avgResp * 10) / 10,
          closeRate,
          slaCompliance,
        };
      })
    );
    // Raw query count helper not needed here, but keep import reference clean
    void raw;
    return NextResponse.json({ kpi });
  } catch (err) {
    return NextResponse.json(
      { error: "Gagal memuat KPI pimpinan", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
