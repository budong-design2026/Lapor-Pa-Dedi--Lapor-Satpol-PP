// /api/reports/stats — public dashboard stats
import { NextResponse } from "next/server";
import {
  ensureTables,
  countReports,
  countReportsWhereArgs,
  countReportsByField,
  countReportsByKabupaten,
  countReportsLast7Days,
  avgResponseHours,
} from "@/lib/db-raw";
import { CATEGORIES, RISK_LEVELS, REPORT_STATUSES } from "@/lib/constants";

export async function GET() {
  try {
    await ensureTables();
    const totalReports = await countReports();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const thisMonth = await countReportsWhereArgs(`"createdAt" >= ?`, [monthStart.toISOString()]);
    const completed = await countReportsWhereArgs(`"status" = ?`, ["SELESAI"]);
    const completionRate = totalReports > 0 ? Math.round((completed / totalReports) * 100) : 0;

    const byCategoryRows = await countReportsByField("category");
    const byCategory = CATEGORIES.map((c) => {
      const r = byCategoryRows.find((x) => x.key === c.code);
      return { code: c.code, name: c.name, count: r ? r.count : 0 };
    });

    const byKabupaten = await countReportsByKabupaten();

    const byRiskRows = await countReportsByField("riskLevel");
    const byRisk = Object.keys(RISK_LEVELS).map((k) => {
      const r = byRiskRows.find((x) => x.key === k);
      return { level: k, count: r ? r.count : 0 };
    });

    const byStatusRows = await countReportsByField("status");
    const byStatus = Object.keys(REPORT_STATUSES).map((k) => {
      const r = byStatusRows.find((x) => x.key === k);
      return { status: k, label: REPORT_STATUSES[k as keyof typeof REPORT_STATUSES].label, count: r ? r.count : 0 };
    });

    const last7Days = await countReportsLast7Days();
    const avgResp = await avgResponseHours();

    return NextResponse.json({
      totalReports,
      thisMonth,
      completed,
      completionRate,
      byCategory,
      byKabupaten,
      byRisk,
      byStatus,
      avgResponseHours: Math.round(avgResp * 10) / 10,
      last7Days,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Gagal memuat statistik", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
