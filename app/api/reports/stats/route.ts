// /api/reports/stats — Public aggregate stats via raw libsql.
import { NextResponse } from "next/server";
import {
  countReports,
  countReportsByField,
  countReportsByKabupaten,
  countReportsLast7Days,
  avgResponseHours,
  countReportsWhere,
} from "@/lib/db-raw";
import { CATEGORIES, REPORT_STATUSES, RISK_LEVELS } from "@/lib/constants";

export async function GET() {
  try {
    const total = await countReports();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const thisMonth = await countReportsWhere(`"createdAt" >= '${monthStart}'`);
    const completed = await countReportsWhere(`"status" = 'SELESAI'`);
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const byCategoryRaw = await countReportsByField("category");
    const byCategory = CATEGORIES.map((c) => ({
      category: c.code,
      name: c.name,
      count: byCategoryRaw.find((r) => r.key === c.code)?.count ?? 0,
    }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);

    const byKabupaten = await countReportsByKabupaten();

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

    const last7Days = await countReportsLast7Days();
    const avgHours = await avgResponseHours();

    return NextResponse.json({
      totalReports: total,
      thisMonth,
      completed,
      completionRate,
      byCategory,
      byKabupaten,
      byRisk,
      byStatus,
      avgResponseHours: Math.round(avgHours * 10) / 10,
      last7Days,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
