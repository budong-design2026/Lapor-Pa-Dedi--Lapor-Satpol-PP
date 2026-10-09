// /api/reports/[id] — GET detail (staff) + PATCH update (staff)
import { NextResponse } from "next/server";
import {
  raw,
  ensureTables,
  getReportById,
  listProgressNotes,
  createProgressNote,
  writeAuditLog,
} from "@/lib/db-raw";
import { getCurrentUser } from "@/lib/auth";
import { calculateSlaDeadline, parseArray, stringifyArray } from "@/lib/report-helpers";
import { REPORT_STATUSES, RISK_LEVELS, ROLE_LABELS } from "@/lib/constants";
import { isStaff, maskReport, shapeReport } from "@/lib/api-helpers";

// ── GET /api/reports/[id] — detail (staff only) ──
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTables();
    const session = await getCurrentUser();
    if (!session || !isStaff(session.role)) {
      return NextResponse.json({ error: "Akses ditolak. Login sebagai staff." }, { status: 403 });
    }
    const { id } = await params;
    const row = await getReportById(id);
    if (!row) {
      return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });
    }
    const notes = await listProgressNotes(id);
    const shaped = shapeReport(row);
    const masked = maskReport(shaped, true); // staff can see PII but anon still masked? — staff sees full
    // For staff detail: show full PII (even if anonymous — staff need it for investigation)
    const report = shaped
      ? { ...shaped, reporterPhone: row.reporterPhone, reporterNik: row.reporterNik, reporterBirthPlace: row.reporterBirthPlace, reporterBirthDate: row.reporterBirthDate, reporterAddress: row.reporterAddress, reporterName: row.reporterName, progressNotes: notes }
      : null;
    void masked;
    return NextResponse.json({ report });
  } catch (err) {
    return NextResponse.json(
      { error: "Gagal memuat detail laporan", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}

// ── PATCH /api/reports/[id] — update report (staff) ──
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTables();
    const session = await getCurrentUser();
    if (!session || !isStaff(session.role)) {
      return NextResponse.json({ error: "Akses ditolak. Login sebagai staff." }, { status: 403 });
    }
    const { id } = await params;
    const existing = await getReportById(id);
    if (!existing) {
      return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });
    }
    const body = await req.json().catch(() => ({}));
    const {
      status,
      riskLevel,
      assignedBidangId,
      assignedTo,
      subCategory,
      progressNote,
      progressNoteType,
      photosAfter,
      voiceTranscript,
    } = body as Record<string, unknown>;

    const sets: string[] = [];
    const args: unknown[] = [];
    const nowIso = new Date().toISOString();

    if (status && REPORT_STATUSES[status as keyof typeof REPORT_STATUSES]) {
      sets.push(`"status" = ?`);
      args.push(status);
      if (status === "DIVERIFIKASI" && !existing.verifiedAt) {
        sets.push(`"verifiedAt" = ?`);
        args.push(nowIso);
      }
      if (status === "DIPROSES" && !existing.inProgressAt) {
        sets.push(`"inProgressAt" = ?`);
        args.push(nowIso);
      }
      if (status === "SELESAI" && !existing.resolvedAt) {
        sets.push(`"resolvedAt" = ?`);
        args.push(nowIso);
      }
    }
    if (riskLevel && RISK_LEVELS[riskLevel as keyof typeof RISK_LEVELS]) {
      sets.push(`"riskLevel" = ?`);
      args.push(riskLevel);
      // Recalc SLA when risk changes
      const dl = calculateSlaDeadline(String(riskLevel));
      sets.push(`"slaDeadline" = ?`);
      args.push(dl.toISOString());
    }
    if (assignedBidangId !== undefined) {
      sets.push(`"assignedBidangId" = ?`);
      args.push(assignedBidangId ?? null);
      if (assignedBidangId && !existing.assignedAt) {
        sets.push(`"assignedAt" = ?`);
        args.push(nowIso);
      }
    }
    if (assignedTo !== undefined) {
      sets.push(`"assignedTo" = ?`);
      args.push(assignedTo ?? null);
    }
    if (subCategory !== undefined) {
      sets.push(`"subCategory" = ?`);
      args.push(subCategory ?? null);
    }
    if (voiceTranscript !== undefined) {
      sets.push(`"voiceTranscript" = ?`);
      args.push(voiceTranscript ?? null);
    }
    if (Array.isArray(photosAfter)) {
      const merged = Array.from(
        new Set([
          ...parseArray<string>(existing.photosAfterJson as string | null),
          ...(photosAfter as string[]),
        ])
      );
      sets.push(`"photosAfterJson" = ?`);
      args.push(stringifyArray(merged));
    }

    if (sets.length) {
      sets.push(`"id" = "id"`); // no-op to ensure trailing comma safe
      const sql = `UPDATE "Report" SET ${sets.join(", ")} WHERE "id" = ?`;
      await raw().execute({ sql, args: [...args, id] });
    }

    if (progressNote && typeof progressNote === "string" && progressNote.trim()) {
      const type = (typeof progressNoteType === "string" && progressNoteType) ? progressNoteType : "PROGRESS";
      await createProgressNote(id, session.sub, String(progressNote), type);
    }

    await writeAuditLog(session.sub, "REPORT_UPDATE", id, JSON.stringify({ status, riskLevel, assignedBidangId }));

    const fresh = await getReportById(id);
    const notes = await listProgressNotes(id);
    const report = shapeReport(fresh);
    return NextResponse.json({
      report: report ? { ...report, progressNotes: notes } : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Gagal memperbarui laporan", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}

// avoid unused warning
void ROLE_LABELS;
