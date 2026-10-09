// /api/pimpinan/kpi — GET KPI per Bidang (raw libsql).
// Auth: pimpinan only.
// Per Bidang: activeReports, resolvedThisMonth, avgResponseHours, closeRate, slaCompliance.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getBidangs,
  countReportsWhereArgs,
  avgResponseHoursBidang,
  countReportsByBidang,
} from "@/lib/db-raw";

export async function GET() {
  try {
    const u = await getCurrentUser();
    if (!u || !u.role.startsWith("PIMPINAN")) {
      return NextResponse.json(
        { error: "Unauthorized — silakan login" },
        { status: 401 }
      );
    }

    const bidangs = await getBidangs();
    const monthStart = new Date(Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      1
    )).toISOString();

    const kpi = await Promise.all(
      bidangs.map(async (b) => {
        const activeReports = await countReportsWhereArgs(
          `"assignedBidangId" = ? AND "status" IN ('DITERIMA','DIVERIFIKASI','DIPROSES')`,
          [b.id]
        );
        const resolvedThisMonth = await countReportsWhereArgs(
          `"assignedBidangId" = ? AND "status" = 'SELESAI' AND "resolvedAt" >= ?`,
          [b.id, monthStart]
        );
        const total = await countReportsByBidang(b.id);
        const resolvedAll = await countReportsWhereArgs(
          `"assignedBidangId" = ? AND "status" = 'SELESAI' AND "resolvedAt" IS NOT NULL`,
          [b.id]
        );
        const withDeadline = await countReportsWhereArgs(
          `"assignedBidangId" = ? AND "slaDeadline" IS NOT NULL AND "status" IN ('SELESAI','DITOLAK') AND "resolvedAt" IS NOT NULL`,
          [b.id]
        );
        const slaMet = await countReportsWhereArgs(
          `"assignedBidangId" = ? AND "slaDeadline" IS NOT NULL AND "status" IN ('SELESAI','DITOLAK') AND "resolvedAt" IS NOT NULL AND "resolvedAt" <= "slaDeadline"`,
          [b.id]
        );

        const avg = await avgResponseHoursBidang(b.id);
        const closeRate = total > 0 ? Math.round((resolvedAll / total) * 100) : 0;
        const slaCompliance =
          withDeadline > 0 ? Math.round((slaMet / withDeadline) * 100) : 100;

        return {
          bidangId: b.id,
          bidangCode: b.code,
          bidangName: b.name,
          activeReports,
          resolvedThisMonth,
          avgResponseHours: Number(avg.toFixed(2)),
          closeRate,
          slaCompliance,
        };
      })
    );

    return NextResponse.json({ kpi });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Gagal memuat KPI bidang", detail: msg.slice(0, 200) },
      { status: 500 }
    );
  }
}
