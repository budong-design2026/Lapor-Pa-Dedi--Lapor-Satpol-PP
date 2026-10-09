// /api/pimpinan/critical — GET all CRITICAL active reports (raw libsql).
// Auth: pimpinan only (any PIMPINAN_* role).
// Optional ?bidang=<bidangId> filter; PIMPINAN_KABID is auto-scoped to own bidang.
import { NextResponse } from "next/server";
import { raw } from "@/lib/db-raw";
import { getCurrentUser } from "@/lib/auth";
import { slaTimeRemaining } from "@/lib/report-helpers";

export async function GET(req: Request) {
  try {
    const u = await getCurrentUser();
    if (!u || !u.role.startsWith("PIMPINAN")) {
      return NextResponse.json(
        { error: "Unauthorized — silakan login" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const bidangFilter = searchParams.get("bidang") || undefined;

    // Build WHERE: critical + active status
    const where: string[] = [
      `"riskLevel" = 'CRITICAL'`,
      `"status" IN ('DITERIMA','DIVERIFIKASI','DIPROSES')`,
    ];
    const args: unknown[] = [];

    // Bidang scoping
    if (u.role === "PIMPINAN_KABID" && u.bidangId) {
      where.push(`"assignedBidangId" = ?`);
      args.push(u.bidangId);
    } else if (bidangFilter) {
      where.push(`"assignedBidangId" = ?`);
      args.push(bidangFilter);
    }

    const whereSql = where.join(" AND ");

    const res = await raw().execute({
      sql: `SELECT * FROM "Report" WHERE ${whereSql} ORDER BY "createdAt" ASC LIMIT 100`,
      args,
    });
    const rows = res.rows as Record<string, unknown>[];

    // Fetch assignee + bidang names in one pass per row (small N ≤ 100)
    const reports = rows.map((r) => {
      const slaRemaining = slaTimeRemaining(r.slaDeadline as string | null);
      return {
        id: r.id,
        ticketNumber: r.ticketNumber,
        category: r.category,
        description: r.description,
        address: r.address,
        kabupaten: r.kabupaten,
        status: r.status,
        slaRemaining,
        assignedBidangId: r.assignedBidangId,
        assignedBidangName: null as string | null, // populated below if assigned
        assignedTo: r.assignedTo,
        assigneeName: null as string | null, // populated below if assigned
        createdAt: r.createdAt,
        slaDeadline: r.slaDeadline,
      };
    });

    // Bulk-fetch assignee + bidang names (one query each, IN clause)
    const assigneeIds = Array.from(
      new Set(reports.map((r) => r.assignedTo).filter(Boolean) as string[])
    );
    const bidangIds = Array.from(
      new Set(reports.map((r) => r.assignedBidangId).filter(Boolean) as string[])
    );

    const assigneeNameMap = new Map<string, string>();
    if (assigneeIds.length > 0) {
      const placeholders = assigneeIds.map(() => "?").join(",");
      const uRes = await raw().execute({
        sql: `SELECT "id", "name" FROM "User" WHERE "id" IN (${placeholders})`,
        args: assigneeIds,
      });
      for (const row of uRes.rows as Record<string, unknown>[]) {
        assigneeNameMap.set(String(row.id), String(row.name));
      }
    }
    const bidangNameMap = new Map<string, string>();
    if (bidangIds.length > 0) {
      const placeholders = bidangIds.map(() => "?").join(",");
      const bRes = await raw().execute({
        sql: `SELECT "id", "name" FROM "Bidang" WHERE "id" IN (${placeholders})`,
        args: bidangIds,
      });
      for (const row of bRes.rows as Record<string, unknown>[]) {
        bidangNameMap.set(String(row.id), String(row.name));
      }
    }

    for (const r of reports) {
      if (r.assignedTo) r.assigneeName = assigneeNameMap.get(String(r.assignedTo)) ?? null;
      if (r.assignedBidangId)
        r.assignedBidangName = bidangNameMap.get(String(r.assignedBidangId)) ?? null;
    }

    return NextResponse.json({ reports, total: reports.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Gagal memuat laporan critical", detail: msg.slice(0, 200) },
      { status: 500 }
    );
  }
}
