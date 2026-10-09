// src/lib/db-raw.ts — Raw libsql database client (bypass Prlesia).
// Terbukti jalan di Vercel via /api/diag rawLibsql test.
import { createClient, type Client } from "@libsql/client";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

let _client: Client | null = null;

/** Raw libsql client (singleton). */
export function raw(): Client {
  if (!_client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _client = createClient({
      url,
      authToken: process.env.DATABASE_AUTH_TOKEN ?? undefined,
    });
  }
  return _client;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const a = Buffer.from(hash, "hex");
    const b = scryptSync(password, salt, 64);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function genId(): string {
  return randomBytes(12).toString("hex");
}

/** Create all tables (idempotent). SQLite/libSQL compatible. */
export async function ensureTables(): Promise<void> {
  const db = raw();
  const stmts = [
    `CREATE TABLE IF NOT EXISTS "Bidang" (
      "id" TEXT PRIMARY KEY,
      "code" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "description" TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT PRIMARY KEY,
      "email" TEXT NOT NULL UNIQUE,
      "password" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "phone" TEXT,
      "role" TEXT NOT NULL DEFAULT 'MASYARAKAT',
      "bidangId" TEXT,
      "nik" TEXT,
      "birthPlace" TEXT,
      "birthDate" TEXT,
      "address" TEXT,
      "points" INTEGER NOT NULL DEFAULT 0,
      "badgesJson" TEXT NOT NULL DEFAULT '[]',
      "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
      "updatedAt" TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS "Report" (
      "id" TEXT PRIMARY KEY,
      "ticketNumber" TEXT NOT NULL UNIQUE,
      "reporterId" TEXT,
      "isAnonymous" INTEGER NOT NULL DEFAULT 0,
      "reporterName" TEXT NOT NULL,
      "reporterPhone" TEXT,
      "reporterNik" TEXT,
      "reporterBirthPlace" TEXT,
      "reporterBirthDate" TEXT,
      "reporterAddress" TEXT,
      "category" TEXT NOT NULL,
      "subCategory" TEXT,
      "description" TEXT NOT NULL,
      "address" TEXT NOT NULL,
      "latitude" REAL NOT NULL,
      "longitude" REAL NOT NULL,
      "kabupaten" TEXT NOT NULL,
      "photosJson" TEXT NOT NULL DEFAULT '[]',
      "videosJson" TEXT NOT NULL DEFAULT '[]',
      "voiceTranscript" TEXT,
      "status" TEXT NOT NULL DEFAULT 'DITERIMA',
      "riskLevel" TEXT,
      "assignedBidangId" TEXT,
      "assignedTo" TEXT,
      "slaDeadline" TEXT,
      "aiSuggestedRisk" TEXT,
      "aiSuggestedBidang" TEXT,
      "aiSuggestedPasal" TEXT,
      "aiReasoning" TEXT,
      "createdAt" TEXT NOT NULL DEFAULT (datetime('now')),
      "verifiedAt" TEXT,
      "assignedAt" TEXT,
      "inProgressAt" TEXT,
      "resolvedAt" TEXT,
      "photosAfterJson" TEXT NOT NULL DEFAULT '[]'
    )`,
    `CREATE INDEX IF NOT EXISTS "Report_status_riskLevel_idx" ON "Report"("status","riskLevel")`,
    `CREATE INDEX IF NOT EXISTS "Report_kabupaten_idx" ON "Report"("kabupaten")`,
    `CREATE INDEX IF NOT EXISTS "Report_createdAt_idx" ON "Report"("createdAt")`,
    `CREATE INDEX IF NOT EXISTS "Report_assignedBidangId_idx" ON "Report"("assignedBidangId")`,
    `CREATE TABLE IF NOT EXISTS "ProgressNote" (
      "id" TEXT PRIMARY KEY,
      "reportId" TEXT NOT NULL,
      "userId" TEXT,
      "note" TEXT NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'PROGRESS',
      "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS "ProgressNote_reportId_idx" ON "ProgressNote"("reportId")`,
    `CREATE TABLE IF NOT EXISTS "Notification" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT,
      "role" TEXT,
      "title" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'INFO',
      "reportId" TEXT,
      "read" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS "AuditLog" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT,
      "action" TEXT NOT NULL,
      "reportId" TEXT,
      "detail" TEXT,
      "createdAt" TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  ];
  for (const s of stmts) {
    await db.execute(s);
  }
}

// ── User helpers ──
export interface UserRow {
  id: string;
  email: string;
  password: string;
  name: string;
  phone: string | null;
  role: string;
  bidangId: string | null;
  nik: string | null;
  birthPlace: string | null;
  birthDate: string | null;
  address: string | null;
  points: number;
  badgesJson: string;
  createdAt: string;
  updatedAt: string;
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const res = await raw().execute({
    sql: `SELECT * FROM "User" WHERE "email" = ? LIMIT 1`,
    args: [email],
  });
  return res.rows[0] ? (res.rows[0] as unknown as UserRow) : null;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const res = await raw().execute({
    sql: `SELECT * FROM "User" WHERE "id" = ? LIMIT 1`,
    args: [id],
  });
  return res.rows[0] ? (res.rows[0] as unknown as UserRow) : null;
}

/** Update password hash for a user (change-password feature). */
export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  await raw().execute({
    sql: `UPDATE "User" SET "password" = ?, "updatedAt" = datetime('now') WHERE "id" = ?`,
    args: [passwordHash, userId],
  });
}

export async function countUsers(): Promise<number> {
  const res = await raw().execute(`SELECT COUNT(*) as c FROM "User"`);
  return Number((res.rows[0] as Record<string, unknown>)?.c ?? 0);
}

export async function upsertUser(
  email: string,
  name: string,
  role: string,
  passwordHash: string,
  bidangId?: string | null
): Promise<void> {
  const db = raw();
  const existing = await getUserByEmail(email);
  if (existing) {
    await db.execute({
      sql: `UPDATE "User" SET "name"=?, "role"=?, "password"=?, "bidangId"=?, "updatedAt"=datetime('now') WHERE "email"=?`,
      args: [name, role, passwordHash, bidangId ?? null, email],
    });
  } else {
    await db.execute({
      sql: `INSERT INTO "User" ("id","email","name","role","password","bidangId") VALUES (?,?,?,?,?,?)`,
      args: [genId(), email, name, role, passwordHash, bidangId ?? null],
    });
  }
}

// ── Bidang helpers ──
export interface BidangRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

export async function getBidangs(): Promise<BidangRow[]> {
  const res = await raw().execute(`SELECT * FROM "Bidang" ORDER BY "code" ASC`);
  return res.rows as unknown as BidangRow[];
}

export async function getBidangByCode(code: string): Promise<BidangRow | null> {
  const res = await raw().execute({
    sql: `SELECT * FROM "Bidang" WHERE "code"=? LIMIT 1`,
    args: [code],
  });
  return res.rows[0] ? (res.rows[0] as unknown as BidangRow) : null;
}

export async function upsertBidang(
  code: string,
  name: string,
  description: string
): Promise<void> {
  const db = raw();
  const existing = await getBidangByCode(code);
  if (existing) {
    await db.execute({
      sql: `UPDATE "Bidang" SET "name"=?, "description"=? WHERE "code"=?`,
      args: [name, description, code],
    });
  } else {
    await db.execute({
      sql: `INSERT INTO "Bidang" ("id","code","name","description") VALUES (?,?,?,?)`,
      args: [genId(), code, name, description],
    });
  }
}

export async function countBidangs(): Promise<number> {
  const res = await raw().execute(`SELECT COUNT(*) as c FROM "Bidang"`);
  return Number((res.rows[0] as Record<string, unknown>)?.c ?? 0);
}

// ── Report helpers ──
export async function countReports(): Promise<number> {
  const res = await raw().execute(`SELECT COUNT(*) as c FROM "Report"`);
  return Number((res.rows[0] as Record<string, unknown>)?.c ?? 0);
}

export async function countReportsWhere(where: string): Promise<number> {
  const res = await raw().execute(`SELECT COUNT(*) as c FROM "Report" WHERE ${where}`);
  return Number((res.rows[0] as Record<string, unknown>)?.c ?? 0);
}

export async function countReportsByField(field: string): Promise<{ key: string; count: number }[]> {
  const res = await raw().execute(
    `SELECT "${field}" as k, COUNT(*) as c FROM "Report" GROUP BY "${field}"`
  );
  return res.rows.map((r) => ({
    key: String((r as Record<string, unknown>).k ?? ""),
    count: Number((r as Record<string, unknown>).c ?? 0),
  }));
}

export async function countReportsByKabupaten(): Promise<{ kabupaten: string; count: number }[]> {
  const res = await raw().execute(
    `SELECT "kabupaten" as k, COUNT(*) as c FROM "Report" GROUP BY "kabupaten" ORDER BY c DESC LIMIT 10`
  );
  return res.rows.map((r) => ({
    kabupaten: String((r as Record<string, unknown>).k ?? ""),
    count: Number((r as Record<string, unknown>).c ?? 0),
  }));
}

export async function countReportsLast7Days(): Promise<{ date: string; count: number }[]> {
  const res = await raw().execute(
    `SELECT DATE("createdAt") as d, COUNT(*) as c FROM "Report" WHERE "createdAt" >= datetime('now','-7 days') GROUP BY d ORDER BY d ASC`
  );
  return res.rows.map((r) => ({
    date: String((r as Record<string, unknown>).d ?? ""),
    count: Number((r as Record<string, unknown>).c ?? 0),
  }));
}

export async function avgResponseHours(): Promise<number> {
  const res = await raw().execute(
    `SELECT AVG((julianday("resolvedAt") - julianday("createdAt")) * 24) as a FROM "Report" WHERE "resolvedAt" IS NOT NULL`
  );
  return Number((res.rows[0] as Record<string, unknown>)?.a ?? 0);
}

export async function getCriticalActive(): Promise<Record<string, unknown>[]> {
  const res = await raw().execute(
    `SELECT * FROM "Report" WHERE "riskLevel"='CRITICAL' AND "status" IN ('DITERIMA','DIVERIFIKASI','DIPROSES') ORDER BY "createdAt" ASC LIMIT 5`
  );
  return res.rows as unknown as Record<string, unknown>[];
}

// ── Report helpers (single fetch + relations) ──
export async function getReportById(id: string): Promise<Record<string, unknown> | null> {
  const res = await raw().execute({
    sql: `SELECT * FROM "Report" WHERE "id"=? LIMIT 1`,
    args: [id],
  });
  return res.rows[0] ? (res.rows[0] as Record<string, unknown>) : null;
}

export async function getReportByTicket(ticket: string): Promise<Record<string, unknown> | null> {
  const res = await raw().execute({
    sql: `SELECT * FROM "Report" WHERE "ticketNumber"=? LIMIT 1`,
    args: [ticket],
  });
  return res.rows[0] ? (res.rows[0] as Record<string, unknown>) : null;
}

export interface ProgressNoteRow {
  id: string;
  reportId: string;
  userId: string | null;
  note: string;
  type: string;
  createdAt: string;
  authorName: string | null;
}

/** List progress notes for a report, with author name via LEFT JOIN. */
export async function listProgressNotes(reportId: string): Promise<ProgressNoteRow[]> {
  const res = await raw().execute({
    sql: `SELECT pn.*, u."name" as "authorName"
          FROM "ProgressNote" pn
          LEFT JOIN "User" u ON pn."userId" = u."id"
          WHERE pn."reportId" = ?
          ORDER BY pn."createdAt" ASC`,
    args: [reportId],
  });
  return res.rows as unknown as ProgressNoteRow[];
}

/** Insert a progress note. Returns the new id. */
export async function createProgressNote(
  reportId: string,
  userId: string | null,
  note: string,
  type: string = "PROGRESS"
): Promise<string> {
  const id = genId();
  await raw().execute({
    sql: `INSERT INTO "ProgressNote" ("id","reportId","userId","note","type") VALUES (?,?,?,?,?)`,
    args: [id, reportId, userId, note, type],
  });
  return id;
}

export async function getBidangById(id: string): Promise<BidangRow | null> {
  const res = await raw().execute({
    sql: `SELECT * FROM "Bidang" WHERE "id"=? LIMIT 1`,
    args: [id],
  });
  return res.rows[0] ? (res.rows[0] as unknown as BidangRow) : null;
}

/** Count reports assigned to a bidang. */
export async function countReportsByBidang(bidangId: string): Promise<number> {
  const res = await raw().execute({
    sql: `SELECT COUNT(*) as c FROM "Report" WHERE "assignedBidangId"=?`,
    args: [bidangId],
  });
  return Number((res.rows[0] as Record<string, unknown>)?.c ?? 0);
}

/** Parameterized count helper (safer than countReportsWhere when args include user input). */
export async function countReportsWhereArgs(
  whereSql: string,
  args: unknown[] = []
): Promise<number> {
  const res = await raw().execute({
    sql: `SELECT COUNT(*) as c FROM "Report" WHERE ${whereSql}`,
    args,
  });
  return Number((res.rows[0] as Record<string, unknown>)?.c ?? 0);
}

/** Avg response (createdAt → resolvedAt) in hours, scoped by bidang. */
export async function avgResponseHoursBidang(bidangId: string): Promise<number> {
  const res = await raw().execute({
    sql: `SELECT AVG((julianday("resolvedAt") - julianday("createdAt")) * 24) as a
          FROM "Report"
          WHERE "assignedBidangId"=? AND "resolvedAt" IS NOT NULL`,
    args: [bidangId],
  });
  return Number((res.rows[0] as Record<string, unknown>)?.a ?? 0);
}

/** Insert an audit log row. Failures swallowed. */
export async function writeAuditLog(
  userId: string | null,
  action: string,
  reportId?: string | null,
  detail?: string | null
): Promise<void> {
  try {
    await raw().execute({
      sql: `INSERT INTO "AuditLog" ("id","userId","action","reportId","detail") VALUES (?,?,?,?,?)`,
      args: [genId(), userId ?? null, action, reportId ?? null, detail ?? null],
    });
  } catch {
    /* swallow */
  }
}

// ── Report serialization (matches Prlesia serializeReport shape) ──
function parseArr<T = string>(json: string | null | undefined): T[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json as string);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

/** Normalise SQLite TEXT datetime (YYYY-MM-DD HH:MM:SS) → ISO with T+Z. */
function isoDate(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  if (!s) return null;
  // Already ISO (has 'T')? leave as-is
  if (s.includes("T")) return s;
  // YYYY-MM-DD HH:MM:SS → ISO UTC
  return s.length >= 19 ? `${s.slice(0, 19).replace(" ", "T")}.000Z` : s;
}

export interface SerializedProgressNote {
  id: string;
  note: string;
  type: string;
  createdAt: string;
  authorName: string | null;
}

/** Roles that may see full reporter PII. */
function canSeePii(role: string | undefined | null): boolean {
  if (!role) return false;
  return role === "OPERATOR" || role.startsWith("PIMPINAN");
}

/**
 * Serialize a Report row (from raw libsql) to the JSON shape expected by the
 * frontend (matches the original Prlesia `serializeReport`).
 *
 * Pass `opts.callerRole` to control PII visibility — staff see full PII;
 * anonymous reports / public callers get masked fields.
 */
export function serializeReport(
  r: Record<string, unknown>,
  opts?: {
    callerRole?: string | null;
    assignedBidangName?: string | null;
    assigneeName?: string | null;
    progressNotes?: SerializedProgressNote[];
  }
): Record<string, unknown> {
  const isAnon = Number(r.isAnonymous) === 1;
  const hidePii = isAnon || !canSeePii(opts?.callerRole);
  return {
    id: r.id,
    ticketNumber: r.ticketNumber,
    reporterId: r.reporterId,
    isAnonymous: isAnon,
    reporterName: isAnon ? "Anonim" : r.reporterName,
    reporterPhone: hidePii ? null : r.reporterPhone,
    reporterNik: hidePii ? null : r.reporterNik,
    reporterBirthPlace: hidePii ? null : r.reporterBirthPlace,
    reporterBirthDate: hidePii ? null : r.reporterBirthDate,
    reporterAddress: hidePii ? null : r.reporterAddress,
    category: r.category,
    subCategory: r.subCategory,
    description: r.description,
    address: r.address,
    latitude: r.latitude,
    longitude: r.longitude,
    kabupaten: r.kabupaten,
    photos: parseArr(r.photosJson as string),
    videos: parseArr(r.videosJson as string),
    voiceTranscript: r.voiceTranscript,
    status: r.status,
    riskLevel: r.riskLevel,
    assignedBidangId: r.assignedBidangId,
    assignedBidangName: opts?.assignedBidangName ?? null,
    assignedTo: r.assignedTo,
    assigneeName: opts?.assigneeName ?? null,
    slaDeadline: isoDate(r.slaDeadline),
    aiSuggestedRisk: r.aiSuggestedRisk,
    aiSuggestedBidang: r.aiSuggestedBidang,
    aiSuggestedPasal: parseArr(r.aiSuggestedPasal as string),
    aiReasoning: r.aiReasoning,
    createdAt: isoDate(r.createdAt),
    verifiedAt: isoDate(r.verifiedAt),
    assignedAt: isoDate(r.assignedAt),
    inProgressAt: isoDate(r.inProgressAt),
    resolvedAt: isoDate(r.resolvedAt),
    photosAfter: parseArr(r.photosAfterJson as string),
    progressNotes: opts?.progressNotes,
  };
}

/** Fetch full report with relations (assignedBidang name, assignee name, progressNotes). */
export async function fetchReportFullRaw(
  id: string
): Promise<{
  row: Record<string, unknown>;
  assignedBidangName: string | null;
  assigneeName: string | null;
  progressNotes: SerializedProgressNote[];
} | null> {
  const row = await getReportById(id);
  if (!row) return null;
  let assignedBidangName: string | null = null;
  if (row.assignedBidangId) {
    const b = await getBidangById(String(row.assignedBidangId));
    if (b) assignedBidangName = b.name;
  }
  let assigneeName: string | null = null;
  if (row.assignedTo) {
    const u = await getUserById(String(row.assignedTo));
    if (u) assigneeName = u.name;
  }
  const pn = await listProgressNotes(id);
  const progressNotes: SerializedProgressNote[] = pn.map((p) => ({
    id: p.id,
    note: p.note,
    type: p.type,
    createdAt: isoDate(p.createdAt) ?? p.createdAt,
    authorName: p.authorName,
  }));
  return { row, assignedBidangName, assigneeName, progressNotes };
}
