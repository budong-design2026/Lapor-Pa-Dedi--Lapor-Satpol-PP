// /api/reports/[id] — GET single + PATCH update (raw libsql).
// GET: auth OPERATOR or PIMPINAN. Staff sees full PII.
// PATCH: auth OPERATOR or PIMPINAN. Body may include: status, riskLevel,
//        assignedBidangId, assignedTo, subCategory, progressNote,
//        progressNoteType, photosAfter.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  raw,
  getReportById,
  getBidangById,
  createProgressNote,
  writeAuditLog,
  serializeReport,
  fetchReportFullRaw,
} from "@/lib/db-raw";
import {
  calculateSlaDeadline,
  parseArray,
  stringifyArray,
} from "@/lib/report-helpers";
import { RISK_LEVELS } from "@/lib/constants";

// ─── GET /api/reports/[id] ───
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const caller = await getCurrentUser();
    const callerRole = caller?.role ?? null;

    const full = await fetchReportFullRaw(id);
    if (!full) {
      return NextResponse.json(
        { error: "Laporan tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      report: serializeReport(full.row, {
        callerRole,
        assignedBidangName: full.assignedBidangName,
        assigneeName: full.assigneeName,
        progressNotes: full.progressNotes,
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "Gagal memuat laporan" },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/reports/[id] ───
interface PatchBody {
  status?: string;
  riskLevel?: string;
  assignedBidangId?: string | null;
  assignedTo?: string | null;
  subCategory?: string;
  progressNote?: string;
  progressNoteType?: string;
  photosAfter?: string[];
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
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

    const { id } = await ctx.params;

    let body: PatchBody = {};
    try {
      const parsed = await req.json();
      if (parsed && typeof parsed === "object") body = parsed as PatchBody;
    } catch {
      return NextResponse.json(
        { error: "Body JSON tidak valid" },
        { status: 400 }
      );
    }

    const existing = await getReportById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Laporan tidak ditemukan" },
        { status: 404 }
      );
    }

    // Build dynamic SET clause
    const setClauses: string[] = [];
    const args: unknown[] = [];
    let action = "STATUS_UPDATE";
    let newStatus: string | null = null;
    let newRisk: string | null = null;

    // Status change
    const incomingStatus = body.status?.toUpperCase();
    if (incomingStatus && incomingStatus !== String(existing.status)) {
      const valid = ["DITERIMA", "DIVERIFIKASI", "DIPROSES", "SELESAI", "DITOLAK"];
      if (!valid.includes(incomingStatus)) {
        return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
      }
      newStatus = incomingStatus;
      setClauses.push(`"status" = ?`);
      args.push(newStatus);
      if (newStatus === "DIVERIFIKASI") {
        setClauses.push(`"verifiedAt" = datetime('now')`);
      }
      if (newStatus === "DIPROSES") {
        setClauses.push(`"inProgressAt" = datetime('now')`);
      }
      if (newStatus === "SELESAI") {
        setClauses.push(`"resolvedAt" = datetime('now')`);
      }
    }

    // Risk level change → recalc SLA
    const incomingRisk = body.riskLevel?.toUpperCase();
    if (incomingRisk && incomingRisk !== String(existing.riskLevel ?? "")) {
      if (!RISK_LEVELS[incomingRisk as keyof typeof RISK_LEVELS]) {
        return NextResponse.json(
          { error: "Risk level tidak valid" },
          { status: 400 }
        );
      }
      newRisk = incomingRisk;
      setClauses.push(`"riskLevel" = ?`);
      args.push(newRisk);
      // Compute new SLA from createdAt
      const createdStr = String(existing.createdAt);
      const createdDate = new Date(createdStr.includes("T") ? createdStr : createdStr.replace(" ", "T") + "Z");
      const deadline = calculateSlaDeadline(newRisk, createdDate);
      setClauses.push(`"slaDeadline" = ?`);
      args.push(deadline.toISOString());
      action = "ESCALATE";
    }

    // Assigned bidang
    if (body.assignedBidangId !== undefined) {
      const currentBidangId = existing.assignedBidangId
        ? String(existing.assignedBidangId)
        : null;
      const incomingBidang =
        body.assignedBidangId === null || body.assignedBidangId === ""
          ? null
          : body.assignedBidangId;
      if (incomingBidang !== currentBidangId) {
        if (incomingBidang === null) {
          setClauses.push(`"assignedBidangId" = NULL`);
        } else {
          // Validate bidang exists
          const b = await getBidangById(String(incomingBidang));
          if (!b) {
            return NextResponse.json(
              { error: "Bidang tidak ditemukan" },
              { status: 400 }
            );
          }
          setClauses.push(`"assignedBidangId" = ?`);
          args.push(b.id);
          setClauses.push(`"assignedAt" = datetime('now')`);
          action = "ASSIGN";
        }
      }
    }

    // Assigned to (operator id)
    if (body.assignedTo !== undefined) {
      if (body.assignedTo === null || body.assignedTo === "") {
        setClauses.push(`"assignedTo" = NULL`);
      } else {
        setClauses.push(`"assignedTo" = ?`);
        args.push(body.assignedTo);
      }
    }

    // subCategory
    if (body.subCategory !== undefined) {
      const sub = body.subCategory?.trim() || null;
      if (sub === null) {
        setClauses.push(`"subCategory" = NULL`);
      } else {
        setClauses.push(`"subCategory" = ?`);
        args.push(sub);
      }
    }

    // photosAfter — merge with existing (limit 10)
    if (Array.isArray(body.photosAfter)) {
      const existingAfter = parseArray<string>(existing.photosAfterJson as string);
      const merged = Array.from(
        new Set([...existingAfter, ...body.photosAfter])
      ).slice(0, 10);
      setClauses.push(`"photosAfterJson" = ?`);
      args.push(stringifyArray(merged));
    }

    // Apply UPDATE
    if (setClauses.length > 0) {
      args.push(id);
      await raw().execute({
        sql: `UPDATE "Report" SET ${setClauses.join(", ")} WHERE "id" = ?`,
        args,
      });
    }

    // Progress note (optional, with type)
    if (body.progressNote && body.progressNote.trim()) {
      const noteTypeRaw = (body.progressNoteType?.toUpperCase() || "PROGRESS").trim();
      const noteType = ["PROGRESS", "VERIFY", "ASSIGN", "STATUS", "ESCALATE"].includes(noteTypeRaw)
        ? noteTypeRaw
        : "PROGRESS";
      await createProgressNote(id, u.sub, body.progressNote.trim(), noteType);
    }

    // Audit log
    if (newStatus === "DIVERIFIKASI" && action === "STATUS_UPDATE") action = "VERIFY";
    await writeAudit(
      u.sub,
      action,
      id,
      `Status=${newStatus ?? existing.status} Risk=${newRisk ?? existing.riskLevel ?? "-"} Bidang=${existing.assignedBidangId ?? "-"}`
    );

    // Re-fetch and serialize
    const full = await fetchReportFullRaw(id);
    if (!full) {
      return NextResponse.json(
        { error: "Laporan tidak ditemukan setelah update" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      report: serializeReport(full.row, {
        callerRole: u.role,
        assignedBidangName: full.assignedBidangName,
        assigneeName: full.assigneeName,
        progressNotes: full.progressNotes,
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Gagal memperbarui laporan", detail: msg.slice(0, 200) },
      { status: 500 }
    );
  }
}

/** Local writeAudit shim — calls into db-raw.writeAuditLog. */
async function writeAudit(
  userId: string,
  action: string,
  reportId: string,
  detail: string
): Promise<void> {
  await writeAuditLog(userId, action, reportId, detail);
}
