// lib/api-helpers.ts — shared helpers for API routes (PII masking, role guards)
import { parseArray } from "./report-helpers";
import { PIMPINAN_ROLES } from "./constants";

export function isStaff(role: string | undefined | null): boolean {
  if (!role) return false;
  return role === "OPERATOR" || PIMPINAN_ROLES.includes(role);
}

export function isOperator(role: string | undefined | null): boolean {
  return role === "OPERATOR";
}

export function isPimpinan(role: string | undefined | null): boolean {
  if (!role) return false;
  return PIMPINAN_ROLES.includes(role);
}

/** Map raw SQLite row → Report shape with parsed JSON arrays + booleans. */
export function shapeReport(row: Record<string, unknown> | null | undefined) {
  if (!row) return null;
  return {
    ...row,
    isAnonymous: Number(row.isAnonymous as number | string | undefined ?? 0) === 1,
    photos: parseArray<string>(row.photosJson as string | null),
    videos: parseArray<string>(row.videosJson as string | null),
    photosAfter: parseArray<string>(row.photosAfterJson as string | null),
    aiSuggestedPasal: parseArray<string>(row.aiSuggestedPasal as string | null),
    latitude: Number(row.latitude ?? 0),
    longitude: Number(row.longitude ?? 0),
  };
}

/**
 * Mask PII fields on a report when caller is not staff OR report is anonymous.
 * Hidden fields: reporterPhone, reporterNik, reporterBirthPlace, reporterBirthDate, reporterAddress.
 * Anonymous + non-staff also hides reporterName.
 */
export function maskReport(report: Record<string, unknown> | null, canSeePii: boolean): Record<string, unknown> | null {
  if (!report) return null;
  const isAnon = Number(report.isAnonymous as number | string | undefined ?? 0) === 1;
  const hide = !canSeePii || isAnon;
  if (!hide) return report;
  return {
    ...report,
    reporterPhone: null,
    reporterNik: null,
    reporterBirthPlace: null,
    reporterBirthDate: null,
    reporterAddress: null,
    reporterName: isAnon && !canSeePii ? "Anonim" : report.reporterName,
  };
}

/** Build user-shape for client (no password). */
export function shapeUser(u: Record<string, unknown> | null) {
  if (!u) return null;
  return {
    id: String(u.id),
    email: String(u.email),
    name: String(u.name),
    role: String(u.role),
    bidangId: u.bidangId ?? null,
    bidangName: null as string | null,
    phone: u.phone ?? null,
    nik: u.nik ?? null,
    points: Number(u.points ?? 0),
  };
}
