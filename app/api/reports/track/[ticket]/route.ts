// /api/reports/track/[ticket] — public tracking by ticket number
import { NextResponse } from "next/server";
import { ensureTables, getReportByTicket, listProgressNotes } from "@/lib/db-raw";
import { getCurrentUser } from "@/lib/auth";
import { isStaff, maskReport, shapeReport } from "@/lib/api-helpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticket: string }> }
) {
  try {
    await ensureTables();
    const { ticket } = await params;
    const row = await getReportByTicket(ticket);
    if (!row) {
      return NextResponse.json({ error: "Tiket tidak ditemukan" }, { status: 404 });
    }
    const session = await getCurrentUser();
    const canSeePii = !!session && isStaff(session.role);
    const notes = await listProgressNotes(String(row.id));
    const progressNotes = notes.map((n) => ({
      id: String(n.id),
      note: String(n.note),
      type: String(n.type),
      createdAt: String(n.createdAt),
      authorName: n.authorName ? String(n.authorName) : null,
    }));
    const shaped = shapeReport(row);
    const masked = maskReport(shaped, canSeePii);
    return NextResponse.json({ report: masked ? { ...masked, progressNotes } : null });
  } catch (err) {
    return NextResponse.json(
      { error: "Gagal melacak tiket", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
