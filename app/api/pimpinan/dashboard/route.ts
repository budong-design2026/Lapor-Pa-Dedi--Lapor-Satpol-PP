// /api/pimpinan/dashboard — auth PIMPINAN. KPI overview (scoped to bidang if PIMPINAN_KABID).
import { NextResponse } from "next/server";
import {
  raw,
  ensureTables,
  countReportsWhereArgs,
  countReportsByField,
  countReportsByKabupaten,
  countReportsLast7Days,
  avgResponseHours,
  avgResponseHoursBidang,
  getCriticalActive,
  getBidangs,
  countReports,
} from "@/lib/db-raw";
import { getCurrentUser } from "@/lib/auth";
import { isPimpinan } from "@/lib/api-helpers";
import { CATEGORIES, RISK_LEVELS, REPORT_STATUSES } from "@/lib/constants";

const ACTIVE_STATUSES = ["DITERIMA", "DIVERIFIKASI", "DIPROSES"];

export async function GET() {
  try {
    await ensureTables();
    const session = await getCurrentUser();
    if (!session || !isPimpinan(session.role)) {
      return NextResponse.json({ error: "Akses ditolak. Login sebagai pimpinan." }, { status: 403 });
    }
    // Scope: PIMPINAN_KABID only sees own bidang
    const scopeBidangId = session.role === "PIMPINAN_KABID" && session.bidangId ? session.bidangId : null;
    const scopeWhere = scopeBidangId ? ` AND "assignedBidangId" = ?` : "";
    const scopeArgs: unknown[] = scopeBidangId ? [scopeBidangId] : [];

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const today = await countReportsWhereArgs(`"createdAt" >= ?${scopeWhere}`, [todayStart.toISOString(), ...scopeArgs]);
    const thisWeek = await countReportsWhereArgs(`"createdAt" >= ?${scopeWhere}`, [weekStart.toISOString(), ...scopeArgs]);
    const thisMonth = await countReportsWhereArgs(`"createdAt" >= ?${scopeWhere}`, [monthStart.toISOString(), ...scopeArgs]);

    const byRiskRows = scopeBidangId
      ? await raw().execute({
          sql: `SELECT "riskLevel" as k, COUNT(*) as c FROM "Report" WHERE "assignedBidangId"=? GROUP BY "riskLevel"`,
          args: [scopeBidangId],
        })
      : await countReportsByField("riskLevel");
    const byRisk = Object.keys(RISK_LEVELS).map((k) => {
      const r = byRiskRows.find((x: any) => x.key === k || x.k === k);
      const count = r ? Number(r.count ?? r.c ?? 0) : 0;
      return { level: k, count };
    });

    const byStatusRows = scopeBidangId
      ? await raw().execute({
          sql: `SELECT "status" as k, COUNT(*) as c FROM "Report" WHERE "assignedBidangId"=? GROUP BY "status"`,
          args: [scopeBidangId],
        })
      : await countReportsByField("status");
    const byStatus = Object.keys(REPORT_STATUSES).map((k) => {
      const r = byStatusRows.find((x: any) => x.key === k || x.k === k);
      const count = r ? Number(r.count ?? r.c ?? 0) : 0;
      return { status: k, label: REPORT_STATUSES[k as keyof typeof REPORT_STATUSES].label, count };
    });

    const byCategoryRows = scopeBidangId
      ? await raw().execute({
          sql: `SELECT "category" as k, COUNT(*) as c FROM "Report" WHERE "assignedBidangId"=? GROUP BY "category"`,
          args: [scopeBidangId],
        })
      : await countReportsByField("category");
    const byCategory = CATEGORIES.map((c) => {
      const r = byCategoryRows.find((x: any) => x.key === c.code || x.k === c.code);
      return { code: c.code, name: c.name, count: r ? Number(r.count ?? r.c ?? 0) : 0 };
    });

    const byKabupaten = await countReportsByKabupaten();

    // byBidang
    const bidangs = await getBidangs();
    const byBidang = await Promise.all(
      bidangs.map(async (b) => {
        const c = await countReportsWhereArgs(`"assignedBidangId"=?`, [String(b.id)]);
        return { bidangId: String(b.id), bidangCode: String(b.code), bidangName: String(b.name), count: c };
      })
    );

    let criticalActive = await getCriticalActive();
    if (scopeBidangId) criticalActive = criticalActive.filter((r: any) => String(r.assignedBidangId) === String(scopeBidangId));

    const trend = await countReportsLast7Days();
    const avgResp = scopeBidangId ? await avgResponseHoursBidang(scopeBidangId) : await avgResponseHours();
    const totalReports = scopeBidangId
      ? await countReportsWhereArgs(`"assignedBidangId"=?`, [scopeBidangId])
      : await countReports();
    const completed = scopeBidangId
      ? await countReportsWhereArgs(`"status"=? AND "assignedBidangId"=?`, ["SELESAI", scopeBidangId])
      : await countReportsWhereArgs(`"status"=?`, ["SELESAI"]);
    const closeRate = totalReports > 0 ? Math.round((completed / totalReports) * 100) : 0;

    const resolvedOnTime = await countReportsWhereArgs(
      `"status"=?${scopeWhere} AND "slaDeadline" IS NOT NULL AND "resolvedAt" IS NOT NULL AND "resolvedAt" <= "slaDeadline"`,
      ["SELESAI", ...scopeArgs]
    );
    const slaCompliance = completed > 0 ? Math.round((resolvedOnTime / completed) * 100) : 100;

    // criticalActive count
    const criticalCount = scopeBidangId
      ? await countReportsWhereArgs(`"riskLevel"=? AND "status" IN (?,?,?) AND "assignedBidangId"=?`, ["CRITICAL", ...ACTIVE_STATUSES, scopeBidangId])
      : await countReportsWhereArgs(`"riskLevel"=? AND "status" IN (?,?,?)`, ["CRITICAL", ...ACTIVE_STATUSES]);

    return NextResponse.json({
      scope: scopeBidangId ? { bidangId: scopeBidangId } : null,
      today,
      thisWeek,
      thisMonth,
      byRisk,
      byStatus,
      byCategory,
      byKabupaten,
      byBidang,
      criticalActive: criticalActive.map((r: any) => ({
        id: String(r.id),
        ticketNumber: String(r.ticketNumber),
        category: String(r.category),
        description: String(r.description),
        kabupaten: String(r.kabupaten),
        address: String(r.address),
        riskLevel: String(r.riskLevel ?? ""),
        status: String(r.status),
        createdAt: String(r.createdAt),
        slaDeadline: r.slaDeadline ?? null,
      })),
      criticalCount,
      trend,
      avgResponseHours: Math.round(avgResp * 10) / 10,
      closeRate,
      slaCompliance,
      totalReports,
      completed,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Gagal memuat dashboard pimpinan", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
