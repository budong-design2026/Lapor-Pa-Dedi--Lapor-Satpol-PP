// /api/operator/inbox — GET operator queue with risk-first sort + filter buckets (raw libsql).
// Auth: OPERATOR or PIMPINAN. Operator sees full PII; pimpinan also sees full PII.
// Query params: filter (all|unverified|in_progress|critical|overdue), search, page, limit, sort (newest|oldest|risk),
//                kabupaten, category, assignedBidangId.
// Returns: { reports, total, page, limit, counts: {all, unverified, inProgress, critical, overdue}, canSeePii }.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  raw,
  serializeReport,
} from "@/lib/db-raw";
import { slaTimeRemaining } from "@/lib/report-helpers";

const RISK_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export async function GET(req: Request) {
  try {
    const u = await getCurrentUser();
    if (!u) {
      return NextResponse.json(
        { error: "Unauthorized — silakan login" },
        { status: 401 }
      );
    }
    const isStaff = u.role === "OPERATOR" || u.role.startsWith("PIMPINAN");
    if (!isStaff) {
      return NextResponse.json(
        { error: "Akses khusus Operator/Pimpinan" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20") || 20));
    const filter = (searchParams.get("filter") || "all").toLowerCase();
    const kabupaten = searchParams.get("kabupaten") || undefined;
    const category = searchParams.get("category") || undefined;
    const assignedBidangIdParam = searchParams.get("assignedBidangId") || undefined;
    const search = searchParams.get("search") || undefined;
    const sort = (searchParams.get("sort") || "newest").toLowerCase();

    // Build WHERE
    const where: string[] = [];
    const args: unknown[] = [];
    const baseWhere: string[] = []; // for bucket counts (without filter-specific clauses)
    const baseArgs: unknown[] = [];

    if (kabupaten) {
      where.push(`"kabupaten" = ?`);
      args.push(kabupaten);
      baseWhere.push(`"kabupaten" = ?`);
      baseArgs.push(kabupaten);
    }
    if (category) {
      const cat = category.toUpperCase();
      where.push(`"category" = ?`);
      args.push(cat);
      baseWhere.push(`"category" = ?`);
      baseArgs.push(cat);
    }
    if (assignedBidangIdParam) {
      where.push(`"assignedBidangId" = ?`);
      args.push(assignedBidangIdParam);
      baseWhere.push(`"assignedBidangId" = ?`);
      baseArgs.push(assignedBidangIdParam);
    }
    if (search) {
      const s = `%${search}%`;
      where.push(
        `("ticketNumber" LIKE ? OR "description" LIKE ? OR "address" LIKE ? OR "kabupaten" LIKE ?)`
      );
      args.push(s, s, s, s);
    }

    switch (filter) {
      case "unverified":
        where.push(`"status" = 'DITERIMA'`);
        break;
      case "in_progress":
        where.push(`"status" IN ('DIVERIFIKASI','DIPROSES')`);
        break;
      case "critical":
        where.push(
          `"riskLevel" = 'CRITICAL' AND "status" IN ('DITERIMA','DIVERIFIKASI','DIPROSES')`
        );
        break;
      case "overdue":
        where.push(
          `"slaDeadline" IS NOT NULL AND "slaDeadline" < datetime('now') AND "status" NOT IN ('SELESAI','DITOLAK')`
        );
        break;
      case "all":
      default:
        break;
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    // Fetch up to 500 most recent matches, then sort client-side by risk+newest
    const orderSql =
      sort === "oldest"
        ? `"createdAt" ASC`
        : sort === "risk"
        ? `CASE "riskLevel" WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 ELSE 4 END ASC, "createdAt" DESC`
        : `"createdAt" DESC`;

    const rowsRes = await raw().execute({
      sql: `SELECT * FROM "Report" ${whereSql} ORDER BY ${orderSql} LIMIT 500`,
      args,
    });
    let rows = rowsRes.rows as Record<string, unknown>[];

    // Risk-first sort when sort != oldest (apply even when DB ORDER BY already did it, since
    // the original route sorts by risk THEN newest, regardless of `sort` param).
    if (sort !== "oldest") {
      rows = rows.slice().sort((a, b) => {
        const ra = RISK_ORDER[String(a.riskLevel ?? "LOW")] ?? 4;
        const rb = RISK_ORDER[String(b.riskLevel ?? "LOW")] ?? 4;
        if (ra !== rb) return ra - rb;
        return (
          new Date(String(b.createdAt)).getTime() -
          new Date(String(a.createdAt)).getTime()
        );
      });
    }

    const total = rows.length;
    const paged = rows.slice((page - 1) * limit, (page - 1) * limit + limit);

    // Bulk-fetch assignee + bidang names for paged rows
    const assigneeIds = Array.from(
      new Set(
        paged.map((r) => r.assignedTo).filter(Boolean) as string[]
      )
    );
    const bidangIds = Array.from(
      new Set(
        paged.map((r) => r.assignedBidangId).filter(Boolean) as string[]
      )
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

    const reports = paged.map((r) => {
      const assignedBidangName = r.assignedBidangId
        ? bidangNameMap.get(String(r.assignedBidangId)) ?? null
        : null;
      const assigneeName = r.assignedTo
        ? assigneeNameMap.get(String(r.assignedTo)) ?? null
        : null;
      const base = serializeReport(r, {
        callerRole: u.role,
        assignedBidangName,
        assigneeName,
      });
      return {
        ...base,
        slaRemaining: slaTimeRemaining(r.slaDeadline as string | null),
      };
    });

    // Compute quick counts for each filter bucket (badges)
    const baseWhereSql =
      baseWhere.length > 0 ? `WHERE ${baseWhere.join(" AND ")}` : "";

    const [all, unverified, inProgress, critical, overdue] = await Promise.all([
      raw().execute({
        sql: `SELECT COUNT(*) as c FROM "Report" ${baseWhereSql}`,
        args: baseArgs,
      }),
      raw().execute({
        sql: `SELECT COUNT(*) as c FROM "Report" ${baseWhereSql ? baseWhereSql + " AND " : "WHERE "} "status" = 'DITERIMA'`,
        args: baseArgs,
      }),
      raw().execute({
        sql: `SELECT COUNT(*) as c FROM "Report" ${baseWhereSql ? baseWhereSql + " AND " : "WHERE "} "status" IN ('DIVERIFIKASI','DIPROSES')`,
        args: baseArgs,
      }),
      raw().execute({
        sql: `SELECT COUNT(*) as c FROM "Report" ${baseWhereSql ? baseWhereSql + " AND " : "WHERE "} "riskLevel" = 'CRITICAL' AND "status" IN ('DITERIMA','DIVERIFIKASI','DIPROSES')`,
        args: baseArgs,
      }),
      raw().execute({
        sql: `SELECT COUNT(*) as c FROM "Report" ${baseWhereSql ? baseWhereSql + " AND " : "WHERE "} "slaDeadline" IS NOT NULL AND "slaDeadline" < datetime('now') AND "status" NOT IN ('SELESAI','DITOLAK')`,
        args: baseArgs,
      }),
    ]);

    const counts = {
      all: Number((all.rows[0] as Record<string, unknown>)?.c ?? 0),
      unverified: Number((unverified.rows[0] as Record<string, unknown>)?.c ?? 0),
      inProgress: Number((inProgress.rows[0] as Record<string, unknown>)?.c ?? 0),
      critical: Number((critical.rows[0] as Record<string, unknown>)?.c ?? 0),
      overdue: Number((overdue.rows[0] as Record<string, unknown>)?.c ?? 0),
    };

    return NextResponse.json({
      reports,
      total,
      page,
      limit,
      counts,
      canSeePii: isStaff,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Gagal memuat inbox operator", detail: msg.slice(0, 200) },
      { status: 500 }
    );
  }
}
