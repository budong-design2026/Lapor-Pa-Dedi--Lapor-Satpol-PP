// src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/api-helpers";

export async function POST() {
  try {
    const u = await getCurrentUser();
    await clearSessionCookie();
    if (u) {
      await writeAudit(u.sub, "LOGIN", null, `Logout ${u.email}`);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
