// /api/reports — POST (create) + GET (list) via raw libsql
import { NextResponse } from "next/server";
import { raw, genId, countReports } from "@/lib/db-raw";
import { generateTicketNumber } from "@/lib/report-helpers";
import { CATEGORIES, KABUPATEN_KOTA } from "@/lib/constants";
import { getCurrentUser } from "@/lib/auth";

const VALID_CATS = new Set(CATEGORIES.map((c) => c.code));
const VALID_KAB = new Set(KABUPATEN_KOTA);

function parseArr(json: string | null | undefined): string[] {
  if (!json) return [];
  try { const v = JSON.parse(json); return Array.isArray(v) ? v : []; } catch { return []; }
}
function parseBool(v: unknown): number { return v ? 1 : 0; }

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const category = String(body.category ?? "").trim();
    if (!VALID_CATS.has(category)) return NextResponse.json({ error: "Kategori tidak valid" }, { status: 400 });
    const description = String(body.description ?? "").trim();
    if (description.length < 10) return NextResponse.json({ error: "Deskripsi minimal 10 karakter" }, { status: 400 });
    const address = String(body.address ?? "").trim();
    if (!address) return NextResponse.json({ error: "Alamat wajib" }, { status: 400 });
    const kabupaten = String(body.kabupaten ?? "").trim();
    if (!VALID_KAB.has(kabupaten)) return NextResponse.json({ error: "Kabupaten/kota tidak valid" }, { status: 400 });
    const lat = Number(body.latitude);
    const lng = Number(body.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return NextResponse.json({ error: "Koordinat GPS tidak valid" }, { status: 400 });

    const reporterName = String(body.reporterName ?? "Warga").trim() || "Warga";
    const isAnon = parseBool(body.isAnonymous);
    const photos = Array.isArray(body.photos) ? body.photos.slice(0, 10) : [];
    const videos = Array.isArray(body.videos) ? body.videos.slice(0, 5) : [];

    let ticket = "";
    for (let i = 0; i < 5; i++) {
      ticket = generateTicketNumber();
      const chk = await raw().execute({ sql: `SELECT 1 FROM "Report" WHERE "ticketNumber"=?`, args: [ticket] });
      if (!chk.rows[0]) break;
    }

    const id = genId();
    const now = new Date().toISOString();

    const cols = ["id","ticketNumber","reporterId","isAnonymous","reporterName","reporterPhone","reporterNik","reporterBirthPlace","reporterBirthDate","reporterAddress","category","subCategory","description","address","latitude","longitude","kabupaten","photosJson","videosJson","voiceTranscript","status","riskLevel","assignedBidangId","assignedTo","slaDeadline","createdAt","photosAfterJson"];
    const vals = [id, ticket, body.reporterId ?? null, isAnon, reporterName, body.reporterPhone ?? null, body.reporterNik ?? null, body.reporterBirthPlace ?? null, body.reporterBirthDate ?? null, body.reporterAddress ?? null, category, body.subCategory ?? null, description, address, lat, lng, kabupaten, JSON.stringify(photos), JSON.stringify(videos), body.voiceTranscript ?? null, "DITERIMA", null, null, null, null, now, "[]"];
    const ph = cols.map(() => "?").join(",");
    const sql = `INSERT INTO "Report" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${ph})`;
    await raw().execute({ sql, args: vals });

    const res = await raw().execute({ sql: `SELECT * FROM "Report" WHERE "id"=?`, args: [id] });
    const row = res.rows[0] as Record<string, unknown> | undefined;
    const report = row ? { ...row, isAnonymous: Number(row.isAnonymous) === 1, photos: parseArr(row.photosJson as string), videos: parseArr(row.videosJson as string), photosAfter: parseArr(row.photosAfterJson as string), progressNotes: [] } : null;
    return NextResponse.json({ report }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Gagal membuat laporan", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
    const status = url.searchParams.get("status");
    const riskLevel = url.searchParams.get("riskLevel");
    const kabupaten = url.searchParams.get("kabupaten");
    const category = url.searchParams.get("category");
    const search = url.searchParams.get("search");
    const sort = url.searchParams.get("sort") ?? "newest";

    const u = await getCurrentUser();
    const canSeePii = !!u && (u.role === "OPERATOR" || u.role.startsWith("PIMPINAN"));

    const where: string[] = ["1=1"];
    const args: unknown[] = [];
    if (status) { where.push(`"status"=?`); args.push(status); }
    if (riskLevel) { where.push(`"riskLevel"=?`); args.push(riskLevel); }
    if (kabupaten) { where.push(`"kabupaten"=?`); args.push(kabupaten); }
    if (category) { where.push(`"category"=?`); args.push(category); }
    if (search) { const s = `%${search}%`; where.push(`("ticketNumber" LIKE ? OR "description" LIKE ? OR "address" LIKE ? OR "kabupaten" LIKE ?)`); args.push(s, s, s, s); }
    const whereSql = where.join(" AND ");
    const orderSql = sort === "oldest" ? `"createdAt" ASC` : sort === "risk" ? `CASE "riskLevel" WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 ELSE 4 END ASC, "createdAt" DESC` : `"createdAt" DESC`;

    const total = await countReports();
    let filteredCount = total;
    if (where.length > 1) {
      const cRes = await raw().execute({ sql: `SELECT COUNT(*) as c FROM "Report" WHERE ${whereSql}`, args });
      filteredCount = Number((cRes.rows[0] as Record<string, unknown>)?.c ?? 0);
    }

    const rowsRes = await raw().execute({ sql: `SELECT * FROM "Report" WHERE ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`, args: [...args, limit, (page - 1) * limit] });
    const reports = (rowsRes.rows as Record<string, unknown>[]).map((r) => {
      const anon = Number(r.isAnonymous) === 1;
      const hidePii = anon || !canSeePii;
      const masked = hidePii ? { ...r, reporterPhone: null, reporterNik: null, reporterBirthPlace: null, reporterBirthDate: null, reporterAddress: null, reporterName: anon ? "Anonim" : r.reporterName } : r;
      return { ...masked, isAnonymous: Number(masked.isAnonymous) === 1, photos: parseArr(masked.photosJson as string), videos: parseArr(masked.videosJson as string), photosAfter: parseArr(masked.photosAfterJson as string) };
    });

    return NextResponse.json({ reports, total: filteredCount, page, limit });
  } catch (e) {
    return NextResponse.json({ error: "Gagal mengambil laporan", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
