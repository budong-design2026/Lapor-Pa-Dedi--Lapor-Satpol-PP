// /api/pimpinan/dashboard — Command Center aggregate via raw libsql.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  countReports,
  countReportsWhere,
  countReportsByField,
  countReportsByKabupaten,
  countReportsLast7Days,
  avgResponseHours,
  getCriticalActive,
  getBidangs,
  raw,
} from "@/lib/db-raw";
import { CATEGORIES, REPORT_STATUSES, RISK_LEVELS, BIDANG_LIST, KABUPATEN_KOTA } from "@/lib/constants";

export async function GET() {
  try {
    const u = await getCurrentUser();
    if (!u || !u.role.startsWith("PIMPINAN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(dayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const scope = u.role === "PIMPINAN_KABID" && u.bidangId ? `"assignedBidangId" = '${u.bidangId}'` : "1=1";

    const today = await countReportsWhere(`${scope} AND "createdAt" >= '${dayStart}'`);
    const thisWeek = await countReportsWhere(`${scope} AND "createdAt" >= '${weekStart.toISOString()}'`);
    const thisMonth = await countReportsWhere(`${scope} AND "createdAt" >= '${monthStart}'`);

    const byRiskRaw = await countReportsByField("riskLevel");
    const byRisk = Object.keys(RISK_LEVELS).map((k) => ({
      riskLevel: k,
      count: byRiskRaw.find((r) => r.key === k)?.count ?? 0,
    }));

    const byStatusRaw = await countReportsByField("status");
    const byStatus = Object.keys(REPORT_STATUSES).map((k) => ({
      status: k,
      count: byStatusRaw.find((r) => r.key === k)?.count ?? 0,
    }));

    const byCategoryRaw = await countReportsByField("category");
    const byCategory = CATEGORIES.map((c) => ({
      category: c.code,
      name: c.name,
      count: byCategoryRaw.find((r) => r.key === c.code)?.count ?? 0,
    })).filter((r) => r.count > 0);

    const byKabupaten = await countReportsByKabupaten();

    // By Bidang
    const bidangs = await getBidangs();
    const byBidang = await Promise.all(
      bidangs.map(async (b) => ({
        bidangId: b.id,
        bidangName: b.name,
        count: await countReportsWhere(`"assignedBidangId" = '${b.id}'`),
      }))
    );

    const criticalActive = await getCriticalActive();
    const trend = await countReportsLast7Days();
    const avgHours = await avgResponseHours();

    const resolved = await countReportsWhere(`${scope} AND "status" = 'SELESAI'`);
    const closeRate = thisMonth > 0 ? Math.round((resolved / thisMonth) * 100) : 0;

    // SLA compliance (reports resolved before slaDeadline)
    const slaRes = await raw().execute(
      `SELECT COUNT(*) as c FROM "Report" WHERE ${scope} AND "slaDeadline" IS NOT NULL AND "resolvedAt" IS NOT NULL AND "resolvedAt" <= "slaDeadline"`
    );
    const slaMet = Number((slaRes.rows[0] as Record<string, unknown>)?.c ?? 0);
    const slaTotal = await countReportsWhere(`${scope} AND "slaDeadline" IS NOT NULL`);
    const slaCompliance = slaTotal > 0 ? Math.round((slaMet / slaTotal) * 100) : 100;

    return NextResponse.json({
      today,
      thisWeek,
      thisMonth,
      byRisk,
      byCategory,
      byKabupaten,
      byBidang,
      byStatus,
      criticalActive,
      avgResponseHours: Math.round(avgHours * 10) / 10,
      closeRate,
      slaCompliance,
      trend,
      scope: u.role === "PIMPINAN_KABID" && u.bidangId ? "bidang" : "all",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// satisfy unused import linter
void BIDANG_LIST;
void KABUPATEN_KOTA;
