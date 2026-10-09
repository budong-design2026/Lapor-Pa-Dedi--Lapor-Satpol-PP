// src/lib/api-helpers.ts — shared utilities for API routes
import { db } from "@/lib/db";
import { parseArray } from "@/lib/report-helpers";
import { getCurrentUser } from "@/lib/auth";
import { PIMPINAN_ROLES } from "@/lib/constants";
import type { Report, Bidang, User, ProgressNote } from "@prisma/client";

/** Roles that may see full reporter PII. */
export function canSeePii(role: string | undefined | null): boolean {
  return role === "OPERATOR" || (role ? PIMPINAN_ROLES.includes(role) : false);
}

export interface SerializedReport {
  id: string;
  ticketNumber: string;
  reporterId: string | null;
  isAnonymous: boolean;
  reporterName: string;
  reporterPhone: string | null;
  reporterNik: string | null;
  reporterBirthPlace: string | null;
  reporterBirthDate: string | null;
  reporterAddress: string | null;
  category: string;
  subCategory: string | null;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  kabupaten: string;
  photos: string[];
  videos: string[];
  voiceTranscript: string | null;
  status: string;
  riskLevel: string | null;
  assignedBidangId: string | null;
  assignedBidangName: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  slaDeadline: string | null;
  aiSuggestedRisk: string | null;
  aiSuggestedBidang: string | null;
  aiSuggestedPasal: string[];
  aiReasoning: string | null;
  createdAt: string;
  verifiedAt: string | null;
  assignedAt: string | null;
  inProgressAt: string | null;
  resolvedAt: string | null;
  photosAfter: string[];
  progressNotes?: SerializedProgressNote[];
}

export interface SerializedProgressNote {
  id: string;
  note: string;
  type: string;
  createdAt: string;
  authorName: string | null;
}

type ReportWithRelations = Report & {
  assignedBidang?: Bidang | null;
  assignee?: User | null;
  progressNotes?: (ProgressNote & { user: User | null })[];
};

/**
 * Serialize a single report (with optional relations) to JSON-safe shape.
 * Caller PII is hidden when `isAnonymous` or caller lacks staff permissions.
 */
export function serializeReport(
  r: ReportWithRelations,
  callerRole?: string | null
): SerializedReport {
  const hidePii = r.isAnonymous || !canSeePii(callerRole);
  return {
    id: r.id,
    ticketNumber: r.ticketNumber,
    reporterId: r.reporterId,
    isAnonymous: r.isAnonymous,
    reporterName: r.isAnonymous ? "Anonim" : r.reporterName,
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
    photos: parseArray<string>(r.photosJson),
    videos: parseArray<string>(r.videosJson),
    voiceTranscript: r.voiceTranscript,
    status: r.status,
    riskLevel: r.riskLevel,
    assignedBidangId: r.assignedBidangId,
    assignedBidangName: r.assignedBidang?.name ?? null,
    assignedTo: r.assignedTo,
    assigneeName: r.assignee?.name ?? null,
    slaDeadline: r.slaDeadline ? r.slaDeadline.toISOString() : null,
    aiSuggestedRisk: r.aiSuggestedRisk,
    aiSuggestedBidang: r.aiSuggestedBidang,
    aiSuggestedPasal: parseArray<string>(r.aiSuggestedPasal),
    aiReasoning: r.aiReasoning,
    createdAt: r.createdAt.toISOString(),
    verifiedAt: r.verifiedAt ? r.verifiedAt.toISOString() : null,
    assignedAt: r.assignedAt ? r.assignedAt.toISOString() : null,
    inProgressAt: r.inProgressAt ? r.inProgressAt.toISOString() : null,
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    photosAfter: parseArray<string>(r.photosAfterJson),
    progressNotes: r.progressNotes
      ? r.progressNotes.map((p) => ({
          id: p.id,
          note: p.note,
          type: p.type,
          createdAt: p.createdAt.toISOString(),
          authorName: p.user?.name ?? null,
        }))
      : undefined,
  };
}

/** Fetch full report (with relations) by id. */
export async function fetchReportFull(id: string) {
  return db.report.findUnique({
    where: { id },
    include: {
      assignedBidang: true,
      assignee: true,
      progressNotes: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

/** Auth guard: returns the current user payload or null. */
export async function requireAuth() {
  return await getCurrentUser();
}

/** Auth guard: operator only. Returns 401/403 JSON-ready shape via `unauthorized`. */
export async function requireOperator() {
  const u = await getCurrentUser();
  if (!u) return { ok: false as const, status: 401, error: "Unauthorized — silakan login" };
  if (u.role !== "OPERATOR")
    return { ok: false as const, status: 403, error: "Akses khusus Operator" };
  return { ok: true as const, user: u };
}

/** Auth guard: pimpinan only (any PIMPINAN_* role). */
export async function requirePimpinan() {
  const u = await getCurrentUser();
  if (!u) return { ok: false as const, status: 401, error: "Unauthorized — silakan login" };
  if (!PIMPINAN_ROLES.includes(u.role))
    return { ok: false as const, status: 403, error: "Akses khusus Pimpinan" };
  return { ok: true as const, user: u };
}

/** Helper: write an audit log entry. Failures are swallowed (do not break request). */
export async function writeAudit(
  userId: string | null,
  action: string,
  reportId?: string | null,
  detail?: string
) {
  try {
    await db.auditLog.create({
      data: { userId: userId ?? null, action, reportId: reportId ?? null, detail },
    });
  } catch {
    // ignore audit failures
  }
}

/** Safe ISO date (YYYY-MM-DD) for grouping. */
export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
