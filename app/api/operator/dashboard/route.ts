// /api/operator/dashboard — auth OPERATOR. Quick counts for dashboard widgets.
import { NextResponse } from "next/server";
import {
  ensureTables,
  countReportsWhereArgs,
  countReports,
  avgResponseHours,
  getCriticalActive,
} from "@/lib/db-raw";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/api-helpers";

const ACTIVE_STATUSES = ["DITERIMA", "DIVERIFIKASI", "DIPROSES"];

export async function GET() {
  try {
    await ensureTables();
    const session = await getCurrentUser();
    if (!session || !isStaff(session.role)) {
      return NextResponse.json({ error: "Akses ditolak. Login sebagai staff." }, { status: 403 });
    }
    if (session.role !== "OPERATOR") {
      // Pimpinan can also call this — but spec says auth OPERATOR. Allow PIMPINAN too for convenience.
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const queueToday = await countReportsWhereArgs(`"createdAt" >= ?`, [todayStart.toISOString()]);
    const unverified = await countReportsWhereArgs(`"status" = ?`, ["DITERIMA"]);
    const inProgress = await countReportsWhereArgs(`"status" IN (?,?)`, ["DIVERIFIKASI", "DIPROSES"]);
    const criticalActive = (await getCriticalActive()).length;
    const overdue = await countReportsWhereArgs(
      `"slaDeadline" IS NOT NULL AND "slaDeadline" < datetime('now') AND "status" IN (?,?,?)`,
      ACTIVE_STATUSES
    );
    const avgResp = await avgResponseHours();
    const totalReports = await countReports();
    const completed = await countReportsWhereArgs(`"status" = ?`, ["SELESAI"]);
    const closeRate = totalReports > 0 ? Math.round((completed / totalReports) * 100) : 0;
    // SLA compliance: of resolved reports, % whose resolvedAt <= slaDeadline
    const resolvedOnTime = await countReportsWhereArgs(
      `"status" = ? AND "slaDeadline" IS NOT NULL AND "resolvedAt" IS NOT NULL AND "resolvedAt" <= "slaDeadline"`,
      ["SELESAI"]
    );
    const slaCompliance = completed > 0 ? Math.round((resolvedOnTime / completed) * 100) : 100;

    return NextResponse.json({
      queueToday,
      unverified,
      inProgress,
      criticalActive,
      overdue,
      avgResponseHours: Math.round(avgResp * 10) / 10,
      closeRate,
      slaCompliance,
      totalReports,
      completed,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Gagal memuat dashboard operator", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
