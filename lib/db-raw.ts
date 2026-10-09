// lib/db-raw.ts — Raw libsql client (bypass Prlesia). Works on Vercel serverless.
import { createClient, type Client } from "@libsql/client";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

let _client: Client | null = null;

export function raw(): Client {
  if (!_client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN ?? undefined });
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
  } catch { return false; }
}
export function genId(): string { return randomBytes(12).toString("hex"); }

/** Create all tables (idempotent). */
export async function ensureTables(): Promise<void> {
  const db = raw();
  const stmts = [
    `CREATE TABLE IF NOT EXISTS "Bidang" ("id" TEXT PRIMARY KEY, "code" TEXT NOT NULL UNIQUE, "name" TEXT NOT NULL, "description" TEXT)`,
    `CREATE TABLE IF NOT EXISTS "User" ("id" TEXT PRIMARY KEY, "email" TEXT NOT NULL UNIQUE, "password" TEXT NOT NULL, "name" TEXT NOT NULL, "phone" TEXT, "role" TEXT NOT NULL DEFAULT 'MASYARAKAT', "bidangId" TEXT, "nik" TEXT, "birthPlace" TEXT, "birthDate" TEXT, "address" TEXT, "points" INTEGER NOT NULL DEFAULT 0, "badgesJson" TEXT NOT NULL DEFAULT '[]', "createdAt" TEXT NOT NULL DEFAULT (datetime('now')), "updatedAt" TEXT NOT NULL DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS "Report" ("id" TEXT PRIMARY KEY, "ticketNumber" TEXT NOT NULL UNIQUE, "reporterId" TEXT, "isAnonymous" INTEGER NOT NULL DEFAULT 0, "reporterName" TEXT NOT NULL, "reporterPhone" TEXT, "reporterNik" TEXT, "reporterBirthPlace" TEXT, "reporterBirthDate" TEXT, "reporterAddress" TEXT, "category" TEXT NOT NULL, "subCategory" TEXT, "description" TEXT NOT NULL, "address" TEXT NOT NULL, "latitude" REAL NOT NULL, "longitude" REAL NOT NULL, "kabupaten" TEXT NOT NULL, "photosJson" TEXT NOT NULL DEFAULT '[]', "videosJson" TEXT NOT NULL DEFAULT '[]', "voiceTranscript" TEXT, "status" TEXT NOT NULL DEFAULT 'DITERIMA', "riskLevel" TEXT, "assignedBidangId" TEXT, "assignedTo" TEXT, "slaDeadline" TEXT, "aiSuggestedRisk" TEXT, "aiSuggestedBidang" TEXT, "aiSuggestedPasal" TEXT, "aiReasoning" TEXT, "createdAt" TEXT NOT NULL DEFAULT (datetime('now')), "verifiedAt" TEXT, "assignedAt" TEXT, "inProgressAt" TEXT, "resolvedAt" TEXT, "photosAfterJson" TEXT NOT NULL DEFAULT '[]')`,
    `CREATE INDEX IF NOT EXISTS "Report_status_riskLevel_idx" ON "Report"("status","riskLevel")`,
    `CREATE INDEX IF NOT EXISTS "Report_kabupaten_idx" ON "Report"("kabupaten")`,
    `CREATE INDEX IF NOT EXISTS "Report_createdAt_idx" ON "Report"("createdAt")`,
    `CREATE INDEX IF NOT EXISTS "Report_assignedBidangId_idx" ON "Report"("assignedBidangId")`,
    `CREATE TABLE IF NOT EXISTS "ProgressNote" ("id" TEXT PRIMARY KEY, "reportId" TEXT NOT NULL, "userId" TEXT, "note" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'PROGRESS', "createdAt" TEXT NOT NULL DEFAULT (datetime('now')))`,
    `CREATE INDEX IF NOT EXISTS "ProgressNote_reportId_idx" ON "ProgressNote"("reportId")`,
    `CREATE TABLE IF NOT EXISTS "Notification" ("id" TEXT PRIMARY KEY, "userId" TEXT, "role" TEXT, "title" TEXT NOT NULL, "message" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'INFO', "reportId" TEXT, "read" INTEGER NOT NULL DEFAULT 0, "createdAt" TEXT NOT NULL DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS "AuditLog" ("id" TEXT PRIMARY KEY, "userId" TEXT, "action" TEXT NOT NULL, "reportId" TEXT, "detail" TEXT, "createdAt" TEXT NOT NULL DEFAULT (datetime('now')))`,
  ];
  for (const s of stmts) await db.execute(s);
}

// ── User helpers ──
export async function getUserByEmail(email: string) {
  const res = await raw().execute({ sql: `SELECT * FROM "User" WHERE "email" = ? LIMIT 1`, args: [email] });
  return (res.rows[0] as any) ?? null;
}
export async function getUserById(id: string) {
  const res = await raw().execute({ sql: `SELECT * FROM "User" WHERE "id" = ? LIMIT 1`, args: [id] });
  return (res.rows[0] as any) ?? null;
}
export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  await raw().execute({ sql: `UPDATE "User" SET "password" = ?, "updatedAt" = datetime('now') WHERE "id" = ?`, args: [passwordHash, userId] });
}
export async function countUsers(): Promise<number> {
  const res = await raw().execute(`SELECT COUNT(*) as c FROM "User"`);
  return Number((res.rows[0] as any)?.c ?? 0);
}
export async function upsertUser(email: string, name: string, role: string, passwordHash: string, bidangId?: string | null) {
  const db = raw();
  const ex = await getUserByEmail(email);
  if (ex) { await db.execute({ sql: `UPDATE "User" SET "name"=?, "role"=?, "password"=?, "bidangId"=?, "updatedAt"=datetime('now') WHERE "email"=?`, args: [name, role, passwordHash, bidangId ?? null, email] }); }
  else { await db.execute({ sql: `INSERT INTO "User" ("id","email","name","role","password","bidangId","updatedAt","createdAt") VALUES (?,?,?,?,?,?,datetime('now'),datetime('now'))`, args: [genId(), email, name, role, passwordHash, bidangId ?? null] }); }
}

// ── Bidang helpers ──
export async function getBidangs() {
  const res = await raw().execute(`SELECT * FROM "Bidang" ORDER BY "code" ASC`);
  return res.rows as any[];
}
export async function getBidangByCode(code: string) {
  const res = await raw().execute({ sql: `SELECT * FROM "Bidang" WHERE "code"=? LIMIT 1`, args: [code] });
  return (res.rows[0] as any) ?? null;
}
export async function getBidangById(id: string) {
  const res = await raw().execute({ sql: `SELECT * FROM "Bidang" WHERE "id"=? LIMIT 1`, args: [id] });
  return (res.rows[0] as any) ?? null;
}
export async function upsertBidang(code: string, name: string, description: string) {
  const db = raw();
  const ex = await getBidangByCode(code);
  if (ex) { await db.execute({ sql: `UPDATE "Bidang" SET "name"=?, "description"=? WHERE "code"=?`, args: [name, description, code] }); }
  else { await db.execute({ sql: `INSERT INTO "Bidang" ("id","code","name","description") VALUES (?,?,?,?)`, args: [genId(), code, name, description] }); }
}
export async function countBidangs(): Promise<number> {
  const res = await raw().execute(`SELECT COUNT(*) as c FROM "Bidang"`);
  return Number((res.rows[0] as any)?.c ?? 0);
}

// ── Report helpers ──
export async function countReports(): Promise<number> {
  const res = await raw().execute(`SELECT COUNT(*) as c FROM "Report"`);
  return Number((res.rows[0] as any)?.c ?? 0);
}
export async function countReportsWhere(where: string): Promise<number> {
  const res = await raw().execute(`SELECT COUNT(*) as c FROM "Report" WHERE ${where}`);
  return Number((res.rows[0] as any)?.c ?? 0);
}
export async function countReportsWhereArgs(whereSql: string, args: unknown[]): Promise<number> {
  const res = await raw().execute({ sql: `SELECT COUNT(*) as c FROM "Report" WHERE ${whereSql}`, args });
  return Number((res.rows[0] as any)?.c ?? 0);
}
export async function countReportsByField(field: string) {
  const res = await raw().execute(`SELECT "${field}" as k, COUNT(*) as c FROM "Report" GROUP BY "${field}"`);
  return res.rows.map((r: any) => ({ key: String(r.k ?? ""), count: Number(r.c ?? 0) }));
}
export async function countReportsByKabupaten() {
  const res = await raw().execute(`SELECT "kabupaten" as k, COUNT(*) as c FROM "Report" GROUP BY "kabupaten" ORDER BY c DESC LIMIT 10`);
  return res.rows.map((r: any) => ({ kabupaten: String(r.k ?? ""), count: Number(r.c ?? 0) }));
}
export async function countReportsLast7Days() {
  const res = await raw().execute(`SELECT DATE("createdAt") as d, COUNT(*) as c FROM "Report" WHERE "createdAt" >= datetime('now','-7 days') GROUP BY d ORDER BY d ASC`);
  return res.rows.map((r: any) => ({ date: String(r.d ?? ""), count: Number(r.c ?? 0) }));
}
export async function avgResponseHours(): Promise<number> {
  const res = await raw().execute(`SELECT AVG((julianday("resolvedAt") - julianday("createdAt")) * 24) as a FROM "Report" WHERE "resolvedAt" IS NOT NULL`);
  return Number((res.rows[0] as any)?.a ?? 0);
}
export async function avgResponseHoursBidang(bidangId: string): Promise<number> {
  const res = await raw().execute({ sql: `SELECT AVG((julianday("resolvedAt") - julianday("createdAt")) * 24) as a FROM "Report" WHERE "resolvedAt" IS NOT NULL AND "assignedBidangId"=?`, args: [bidangId] });
  return Number((res.rows[0] as any)?.a ?? 0);
}
export async function getCriticalActive() {
  const res = await raw().execute(`SELECT * FROM "Report" WHERE "riskLevel"='CRITICAL' AND "status" IN ('DITERIMA','DIVERIFIKASI','DIPROSES') ORDER BY "createdAt" ASC LIMIT 5`);
  return res.rows as any[];
}
export async function getReportById(id: string) {
  const res = await raw().execute({ sql: `SELECT * FROM "Report" WHERE "id" = ? LIMIT 1`, args: [id] });
  return (res.rows[0] as any) ?? null;
}
export async function getReportByTicket(ticket: string) {
  const res = await raw().execute({ sql: `SELECT * FROM "Report" WHERE "ticketNumber" = ? LIMIT 1`, args: [ticket] });
  return (res.rows[0] as any) ?? null;
}
export async function listProgressNotes(reportId: string) {
  const res = await raw().execute({
    sql: `SELECT pn.*, u."name" as "authorName" FROM "ProgressNote" pn LEFT JOIN "User" u ON pn."userId"=u."id" WHERE pn."reportId"=? ORDER BY pn."createdAt" ASC`,
    args: [reportId],
  });
  return res.rows as any[];
}
export async function createProgressNote(reportId: string, userId: string, note: string, type = "PROGRESS") {
  await raw().execute({
    sql: `INSERT INTO "ProgressNote" ("id","reportId","userId","note","type") VALUES (?,?,?,?,?)`,
    args: [genId(), reportId, userId, note, type],
  });
}
export async function countReportsByBidang(bidangId: string): Promise<number> {
  return countReportsWhere(`"assignedBidangId"='${bidangId}'`);
}
export async function writeAuditLog(userId: string | null, action: string, reportId?: string | null, detail?: string) {
  try {
    await raw().execute({
      sql: `INSERT INTO "AuditLog" ("id","userId","action","reportId","detail") VALUES (?,?,?,?,?)`,
      args: [genId(), userId, action, reportId ?? null, detail ?? null],
    });
  } catch { /* swallow */ }
}
