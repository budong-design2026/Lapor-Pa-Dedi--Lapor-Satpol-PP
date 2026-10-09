// /api/operator/dashboard — GET operator mini dashboard (raw libsql).
// Auth: OPERATOR only.
// Counts: queueToday, unverified, inProgress, criticalActive, overdue,
// avgResponseHours, closeRate, slaCompliance.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  raw,
  countReportsWhere,
  countReports,
} from "@/lib/db-raw";

export async function GET() {
  try {
    const u = await getCurrentUser();
    if (!u) {
      return NextResponse.json(
        { error: "Unauthorized — silakan login" },
        { status: 401 }
      );
    }
    if (u.role !== "OPERATOR") {
      return NextResponse.json(
        { error: "Akses khusus Operator" },
        { status: 403 }
      );
    }

    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    ).toISOString();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    ).toISOString();

    const [queueToday, unverified, inProgress, criticalActive, overdue, totalAll, totalResolved] =
      await Promise.all([
        // createdAt >= today (start of UTC day)
        countReportsWhere(`"createdAt" >= '${todayStart}'`),
        countReportsWhere(`"status" = 'DITERIMA'`),
        countReportsWhere(`"status" IN ('DIVERIFIKASI','DIPROSES')`),
        countReportsWhere(
          `"riskLevel" = 'CRITICAL' AND "status" IN ('DITERIMA','DIVERIFIKASI','DIPROSES')`
        ),
        // overdue: deadline in the past AND not SELESAI/DITOLAK
        countReportsWhere(
          `"slaDeadline" IS NOT NULL AND "slaDeadline" < datetime('now') AND "status" NOT IN ('SELESAI','DITOLAK')`
        ),
        countReports(),
        countReportsWhere(`"status" = 'SELESAI'`),
      ]);

    // SLA compliance: of all resolved/rejected reports with a deadline, % met
    const slaTotalRes = await raw().execute({
      sql: `SELECT COUNT(*) as c FROM "Report"
            WHERE "slaDeadline" IS NOT NULL
              AND "status" IN ('SELESAI','DITOLAK')
              AND "resolvedAt" IS NOT NULL`,
    });
    const slaTotal = Number((slaTotalRes.rows[0] as Record<string, unknown>)?.c ?? 0);
    const slaMetRes = await raw().execute({
      sql: `SELECT COUNT(*) as c FROM "Report"
            WHERE "slaDeadline" IS NOT NULL
              AND "status" IN ('SELESAI','DITOLAK')
              AND "resolvedAt" IS NOT NULL
              AND "resolvedAt" <= "slaDeadline"`,
    });
    const slaMet = Number((slaMetRes.rows[0] as Record<string, unknown>)?.c ?? 0);
    const slaCompliance = slaTotal > 0 ? Math.round((slaMet / slaTotal) * 100) : 100;

    // Avg response hours (this month's resolved reports)
    const resolvedThisMonthRes = await raw().execute({
      sql: `SELECT AVG((julianday("resolvedAt") - julianday("createdAt")) * 24) as a
            FROM "Report"
            WHERE "status" = 'SELESAI' AND "resolvedAt" >= ?`,
      args: [monthStart],
    });
    const avgHours = Number(
      (resolvedThisMonthRes.rows[0] as Record<string, unknown>)?.a ?? 0
    );

    // closeRate = % SELESAI of all reports
    const closeRate = totalAll > 0 ? Math.round((totalResolved / totalAll) * 100) : 0;

    return NextResponse.json({
      queueToday,
      unverified,
      inProgress,
      criticalActive,
      overdue,
      avgResponseHours: Number(avgHours.toFixed(2)),
      closeRate,
      slaCompliance,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Gagal memuat dashboard operator", detail: msg.slice(0, 200) },
      { status: 500 }
    );
  }
}
