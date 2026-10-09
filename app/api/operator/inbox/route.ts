// /api/operator/inbox — auth OPERATOR or PIMPINAN. Bucketed report inbox.
import { NextResponse } from "next/server";
import {
  raw,
  ensureTables,
  countReportsWhereArgs,
} from "@/lib/db-raw";
import { getCurrentUser } from "@/lib/auth";
import { slaTimeRemaining } from "@/lib/report-helpers";
import { isStaff, shapeReport } from "@/lib/api-helpers";

const ACTIVE_STATUSES = ["DITERIMA", "DIVERIFIKASI", "DIPROSES"];

export async function GET(req: Request) {
  try {
    await ensureTables();
    const session = await getCurrentUser();
    if (!session || !isStaff(session.role)) {
      return NextResponse.json({ error: "Akses ditolak. Login sebagai staff." }, { status: 403 });
    }
    const url = new URL(req.url);
    const filter = url.searchParams.get("filter") ?? "all";
    const search = url.searchParams.get("search") ?? "";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "20")));
    const sort = url.searchParams.get("sort") ?? "newest";

    // Build WHERE from filter — always constrain to active statuses unless explicitly "all" with no other filter
    const where: string[] = [];
    const args: unknown[] = [];
    if (filter === "unverified") {
      where.push(`"status" = ?`);
      args.push("DITERIMA");
    } else if (filter === "in_progress") {
      where.push(`"status" IN (?,?)`);
      args.push("DIVERIFIKASI", "DIPROSES");
    } else if (filter === "critical") {
      where.push(`"riskLevel" = ?`);
      args.push("CRITICAL");
      where.push(`"status" IN (?,?,?)`);
      args.push("DITERIMA", "DIVERIFIKASI", "DIPROSES");
    } else if (filter === "overdue") {
      where.push(`"slaDeadline" IS NOT NULL AND "slaDeadline" < datetime('now')`);
      where.push(`"status" IN (?,?,?)`);
      args.push("DITERIMA", "DIVERIFIKASI", "DIPROSES");
    } else {
      // filter === "all" or unset → only active reports
      where.push(`"status" IN (?,?,?)`);
      args.push("DITERIMA", "DIVERIFIKASI", "DIPROSES");
    }
    if (search) {
      where.push(`("ticketNumber" LIKE ? OR "description" LIKE ? OR "address" LIKE ? OR "reporterName" LIKE ?)`);
      const kw = `%${search}%`;
      args.push(kw, kw, kw, kw);
    }
    const conditions = where.join(" AND ");
    const whereSql = `WHERE ${conditions}`;

    // Bucket counts
    const countAll = await countReportsWhereArgs(`"status" IN (?,?,?)`, ACTIVE_STATUSES);
    const countUnverified = await countReportsWhereArgs(`"status" = ?`, ["DITERIMA"]);
    const countInProgress = await countReportsWhereArgs(`"status" IN (?,?)`, ["DIVERIFIKASI", "DIPROSES"]);
    const countCritical = await countReportsWhereArgs(
      `"riskLevel" = ? AND "status" IN (?,?,?)`,
      ["CRITICAL", "DITERIMA", "DIVERIFIKASI", "DIPROSES"]
    );
    const countOverdue = await countReportsWhereArgs(
      `"slaDeadline" IS NOT NULL AND "slaDeadline" < datetime('now') AND "status" IN (?,?,?)`,
      ACTIVE_STATUSES
    );

    let orderBy = `"createdAt" DESC`;
    if (sort === "oldest") orderBy = `"createdAt" ASC`;
    else if (sort === "risk") {
      orderBy = `CASE "riskLevel" WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 ELSE 4 END ASC, "createdAt" DESC`;
    }

    const offset = (page - 1) * limit;
    const res = await raw().execute({
      sql: `SELECT * FROM "Report" ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      args: [...args, limit, offset],
    });

    const reports = res.rows.map((r) => {
      const shaped = shapeReport(r as Record<string, unknown>);
      if (!shaped) return null;
      const sla = slaTimeRemaining(shaped.slaDeadline as string | null);
      return { ...shaped, slaRemaining: sla };
    }).filter(Boolean);

    const total = await countReportsWhereArgs(conditions, args);

    return NextResponse.json({
      reports,
      total,
      page,
      limit,
      counts: {
        all: countAll,
        unverified: countUnverified,
        inProgress: countInProgress,
        critical: countCritical,
        overdue: countOverdue,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Gagal memuat inbox", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
