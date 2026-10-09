// /api/reports/track/[ticket] — GET public tracking by ticket (raw libsql).
// Public (no auth). Hides reporter PII when isAnonymous.
// Returns: { report: { ...fields, timeline: [{id, note, type, createdAt, authorName}] } }.
import { NextResponse } from "next/server";
import {
  getReportByTicket,
  getBidangById,
  listProgressNotes,
} from "@/lib/db-raw";
import { slaTimeRemaining } from "@/lib/report-helpers";

function isoDate(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v);
  if (!s) return null;
  if (s.includes("T")) return s;
  return s.length >= 19 ? `${s.slice(0, 19).replace(" ", "T")}.000Z` : s;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ ticket: string }> }
) {
  try {
    const { ticket: rawTicket } = await ctx.params;
    const ticket = decodeURIComponent(rawTicket).toUpperCase();

    const r = await getReportByTicket(ticket);
    if (!r) {
      return NextResponse.json(
        { error: `Tiket ${ticket} tidak ditemukan` },
        { status: 404 }
      );
    }

    // Resolve assigned bidang name (optional relation)
    let assignedBidangName: string | null = null;
    if (r.assignedBidangId) {
      const b = await getBidangById(String(r.assignedBidangId));
      if (b) assignedBidangName = b.name;
    }

    // Timeline (progress notes with author name)
    const pn = await listProgressNotes(String(r.id));
    const timeline = pn.map((p) => ({
      id: p.id,
      note: p.note,
      type: p.type,
      createdAt: isoDate(p.createdAt) ?? p.createdAt,
      authorName: p.authorName,
    }));

    // Public payload — NO user ids / PII (always mask, even if not anonymous)
    const payload = {
      id: r.id,
      ticketNumber: r.ticketNumber,
      category: r.category,
      subCategory: r.subCategory,
      description: r.description,
      address: r.address,
      kabupaten: r.kabupaten,
      status: r.status,
      riskLevel: r.riskLevel,
      slaDeadline: isoDate(r.slaDeadline),
      slaRemaining: slaTimeRemaining(r.slaDeadline as string | null),
      createdAt: isoDate(r.createdAt),
      verifiedAt: isoDate(r.verifiedAt),
      assignedAt: isoDate(r.assignedAt),
      inProgressAt: isoDate(r.inProgressAt),
      resolvedAt: isoDate(r.resolvedAt),
      assignedBidangName,
      timeline,
    };

    return NextResponse.json({ report: payload });
  } catch {
    return NextResponse.json(
      { error: "Gagal melacak tiket" },
      { status: 500 }
    );
  }
}
