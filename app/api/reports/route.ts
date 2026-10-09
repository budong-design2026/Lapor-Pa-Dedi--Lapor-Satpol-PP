// /api/reports — POST (create report, public) + GET (list, optional auth for staff PII)
import { NextResponse } from "next/server";
import {
  raw,
  genId,
  ensureTables,
  countReports,
  countReportsWhereArgs,
} from "@/lib/db-raw";
import { getCurrentUser } from "@/lib/auth";
import { generateTicketNumber, parseArray, stringifyArray } from "@/lib/report-helpers";
import { CATEGORIES, KABUPATEN_KOTA, RISK_LEVELS, REPORT_STATUSES } from "@/lib/constants";
import { isStaff, maskReport, shapeReport } from "@/lib/api-helpers";

// ── GET /api/reports — list with filters ──
export async function GET(req: Request) {
  try {
    await ensureTables();
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "20")));
    const status = url.searchParams.get("status") ?? undefined;
    const riskLevel = url.searchParams.get("riskLevel") ?? undefined;
    const kabupaten = url.searchParams.get("kabupaten") ?? undefined;
    const category = url.searchParams.get("category") ?? undefined;
    const search = url.searchParams.get("search") ?? undefined;
    const sort = url.searchParams.get("sort") ?? "newest";

    const session = await getCurrentUser();
    const canSeePii = !!session && isStaff(session.role);

    const where: string[] = [];
    const args: unknown[] = [];
    if (status && REPORT_STATUSES[status as keyof typeof REPORT_STATUSES]) {
      where.push(`"status" = ?`);
      args.push(status);
    }
    if (riskLevel && RISK_LEVELS[riskLevel as keyof typeof RISK_LEVELS]) {
      where.push(`"riskLevel" = ?`);
      args.push(riskLevel);
    }
    if (kabupaten) {
      where.push(`"kabupaten" = ?`);
      args.push(kabupaten);
    }
    if (category) {
      where.push(`"category" = ?`);
      args.push(category);
    }
    if (search) {
      where.push(`("ticketNumber" LIKE ? OR "description" LIKE ? OR "address" LIKE ? OR "reporterName" LIKE ?)`);
      const kw = `%${search}%`;
      args.push(kw, kw, kw, kw);
    }
    // countReportsWhereArgs adds its own WHERE keyword — pass conditions only (no "WHERE" prefix)
    const conditions = where.length ? where.join(" AND ") : "1=1";
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    let orderBy = `"createdAt" DESC`;
    if (sort === "oldest") orderBy = `"createdAt" ASC`;
    else if (sort === "risk") {
      orderBy = `CASE "riskLevel" WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 ELSE 4 END ASC, "createdAt" DESC`;
    }

    const total = await countReportsWhereArgs(conditions, args);
    const offset = (page - 1) * limit;
    const res = await raw().execute({
      sql: `SELECT * FROM "Report" ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      args: [...args, limit, offset],
    });

    const reports = res.rows
      .map((r) => shapeReport(r as Record<string, unknown>))
      .map((r) => maskReport(r, canSeePii));

    return NextResponse.json({ reports, total, page, limit });
  } catch (err) {
    return NextResponse.json(
      { error: "Gagal memuat laporan", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}

// ── POST /api/reports — create report (public) ──
export async function POST(req: Request) {
  try {
    await ensureTables();
    const body = await req.json().catch(() => ({}));
    const {
      category,
      description,
      address,
      kabupaten,
      latitude,
      longitude,
      subCategory,
      isAnonymous,
      reporterName,
      reporterPhone,
      reporterNik,
      reporterBirthPlace,
      reporterBirthDate,
      reporterAddress,
      photos,
      videos,
      voiceTranscript,
      riskLevel,
      assignedBidangId,
      assignedTo,
      aiSuggestedRisk,
      aiSuggestedBidang,
      aiSuggestedPasal,
      aiReasoning,
      slaDeadline,
    } = body as Record<string, unknown>;

    // Validation
    if (!category || !CATEGORIES.some((c) => c.code === String(category))) {
      return NextResponse.json({ error: "Kategori tidak valid" }, { status: 400 });
    }
    if (!description || typeof description !== "string" || String(description).trim().length < 10) {
      return NextResponse.json({ error: "Deskripsi minimal 10 karakter" }, { status: 400 });
    }
    if (!address || typeof address !== "string") {
      return NextResponse.json({ error: "Alamat wajib diisi" }, { status: 400 });
    }
    if (!kabupaten || !KABUPATEN_KOTA.includes(String(kabupaten))) {
      return NextResponse.json({ error: "Kabupaten/Kota tidak valid" }, { status: 400 });
    }
    if (latitude == null || longitude == null || isNaN(Number(latitude)) || isNaN(Number(longitude))) {
      return NextResponse.json({ error: "Koordinat (latitude/longitude) wajib diisi" }, { status: 400 });
    }
    if (riskLevel && !RISK_LEVELS[riskLevel as keyof typeof RISK_LEVELS]) {
      return NextResponse.json({ error: "Risk level tidak valid" }, { status: 400 });
    }

    const session = await getCurrentUser();
    const anon = isAnonymous ? Number(isAnonymous) === 1 || isAnonymous === true : false;
    const finalReporterName = anon
      ? "Anonim"
      : String(reporterName ?? session?.name ?? "Warga");
    const reporterId = session?.sub ?? null;

    // Generate ticket (retry on conflict — up to 5 attempts)
    let ticketNumber = generateTicketNumber();
    for (let i = 0; i < 5; i++) {
      const existing = await raw().execute({
        sql: `SELECT "id" FROM "Report" WHERE "ticketNumber"=? LIMIT 1`,
        args: [ticketNumber],
      });
      if (existing.rows.length === 0) break;
      ticketNumber = generateTicketNumber();
    }

    const id = genId();
    const photosArr = Array.isArray(photos) ? (photos as string[]) : [];
    const videosArr = Array.isArray(videos) ? (videos as string[]) : [];
    const pasalArr = Array.isArray(aiSuggestedPasal) ? (aiSuggestedPasal as string[]) : [];
    const anonFlag = anon ? 1 : 0;

    await raw().execute({
      sql: `INSERT INTO "Report" (
        "id","ticketNumber","reporterId","isAnonymous","reporterName","reporterPhone","reporterNik",
        "reporterBirthPlace","reporterBirthDate","reporterAddress",
        "category","subCategory","description","address","latitude","longitude","kabupaten",
        "photosJson","videosJson","voiceTranscript",
        "status","riskLevel","assignedBidangId","assignedTo","slaDeadline",
        "aiSuggestedRisk","aiSuggestedBidang","aiSuggestedPasal","aiReasoning"
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        id, ticketNumber, reporterId, anonFlag, finalReporterName,
        reporterPhone ?? null, reporterNik ?? null,
        reporterBirthPlace ?? null, reporterBirthDate ?? null, reporterAddress ?? null,
        String(category), subCategory ?? null, String(description), String(address),
        Number(latitude), Number(longitude), String(kabupaten),
        stringifyArray(photosArr.slice(0, 3)),
        stringifyArray(videosArr),
        voiceTranscript ?? null,
        "DITERIMA",
        riskLevel ?? null,
        assignedBidangId ?? null,
        assignedTo ?? null,
        slaDeadline ?? null,
        aiSuggestedRisk ?? null,
        aiSuggestedBidang ?? null,
        stringifyArray(pasalArr),
        aiReasoning ?? null,
      ],
    });

    const fresh = await raw().execute({
      sql: `SELECT * FROM "Report" WHERE "id"=? LIMIT 1`,
      args: [id],
    });
    const row = fresh.rows[0] as Record<string, unknown> | undefined;
    const shaped = shapeReport(row ?? null);
    return NextResponse.json({ report: shaped ? { ...shaped, progressNotes: [] } : null }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Gagal membuat laporan", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
