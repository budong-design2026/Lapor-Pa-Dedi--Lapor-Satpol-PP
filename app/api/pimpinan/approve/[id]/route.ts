// /api/pimpinan/approve/[id] — POST approve eskalasi (raw libsql).
// Auth: pimpinan only. Body: { progressNote?: string } or empty.
// Moves Report → DIPROSES (if not already SELESAI/DITOLAK) and inserts
// an ESCALATE ProgressNote + AuditLog.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  raw,
  getReportById,
  createProgressNote,
  writeAuditLog,
  serializeReport,
  fetchReportFullRaw,
} from "@/lib/db-raw";
import { ROLE_LABELS } from "@/lib/constants";

interface ApproveBody {
  progressNote?: string;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const u = await getCurrentUser();
    if (!u || !u.role.startsWith("PIMPINAN")) {
      return NextResponse.json(
        { error: "Unauthorized — silakan login" },
        { status: 401 }
      );
    }

    const { id } = await ctx.params;

    let body: ApproveBody = {};
    try {
      const parsed = await req.json();
      if (parsed && typeof parsed === "object") body = parsed as ApproveBody;
    } catch {
      // body is optional
    }

    const existing = await getReportById(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Laporan tidak ditemukan" },
        { status: 404 }
      );
    }

    // Move to DIPROSES if not already in-progress / resolved / rejected.
    const targetStatus = "DIPROSES";
    if (
      String(existing.status) !== targetStatus &&
      String(existing.status) !== "SELESAI" &&
      String(existing.status) !== "DITOLAK"
    ) {
      await raw().execute({
        sql: `UPDATE "Report" SET "status" = ?, "inProgressAt" = datetime('now') WHERE "id" = ?`,
        args: [targetStatus, id],
      });
    }

    // Compose the pimpinan approval progress note.
    const roleLabel = ROLE_LABELS[u.role] ?? u.role;
    const pimpinanName = u.name ?? "Pimpinan";
    // Avoid duplicate phrasing when the user's display name already contains
    // the role label (e.g. name="Kasatpol PP Jabar" + role="Kasatpol PP").
    const signer = pimpinanName.toLowerCase().includes(roleLabel.toLowerCase())
      ? pimpinanName
      : `${roleLabel} ${pimpinanName}`;
    const noteText =
      body.progressNote && body.progressNote.trim().length > 0
        ? body.progressNote.trim()
        : `Eskalasi disetujui oleh ${signer}. Penanganan segera.`;

    await createProgressNote(id, u.sub, noteText, "ESCALATE");

    await writeAuditLog(
      u.sub,
      "ESCALATE_APPROVE",
      id,
      `Pimpinan ${roleLabel} ${pimpinanName} approved escalation. Status=${targetStatus} Risk=${existing.riskLevel ?? "-"}`
    );

    // Re-fetch full report with relations + serialize (pimpinan sees full PII)
    const full = await fetchReportFullRaw(id);
    if (!full) {
      return NextResponse.json(
        { error: "Laporan tidak ditemukan setelah update" },
        { status: 404 }
      );
    }
    const serialized = serializeReport(full.row, {
      callerRole: u.role,
      assignedBidangName: full.assignedBidangName,
      assigneeName: full.assigneeName,
      progressNotes: full.progressNotes,
    });

    return NextResponse.json({ report: serialized, note: noteText });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Gagal menyetujui eskalasi", detail: msg.slice(0, 200) },
      { status: 500 }
    );
  }
}
