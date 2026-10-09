// /api/pimpinan/approve/[id] — auth PIMPINAN. Escalate report to DIPROSES.
import { NextResponse } from "next/server";
import {
  raw,
  ensureTables,
  getReportById,
  createProgressNote,
  writeAuditLog,
} from "@/lib/db-raw";
import { getCurrentUser } from "@/lib/auth";
import { isPimpinan, shapeReport } from "@/lib/api-helpers";
import { ROLE_LABELS } from "@/lib/constants";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureTables();
    const session = await getCurrentUser();
    if (!session || !isPimpinan(session.role)) {
      return NextResponse.json({ error: "Akses ditolak. Login sebagai pimpinan." }, { status: 403 });
    }
    const { id } = await params;
    const existing = await getReportById(id);
    if (!existing) {
      return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });
    }
    const nowIso = new Date().toISOString();
    await raw().execute({
      sql: `UPDATE "Report" SET "status"=?, "inProgressAt"=COALESCE("inProgressAt", ?) WHERE "id"=?`,
      args: ["DIPROSES", nowIso, id],
    });
    const roleLabel = ROLE_LABELS[session.role] ?? session.role;
    const note = `Eskalasi disetujui oleh ${roleLabel} ${session.name}. Penanganan segera.`;
    await createProgressNote(id, session.sub, note, "ESCALATE");
    await writeAuditLog(session.sub, "PIMPINAN_APPROVE_ESCALATE", id, note);
    const fresh = await getReportById(id);
    const report = shapeReport(fresh);
    return NextResponse.json({ ok: true, message: "Eskalasi disetujui", report });
  } catch (err) {
    return NextResponse.json(
      { error: "Gagal menyetujui eskalasi", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
