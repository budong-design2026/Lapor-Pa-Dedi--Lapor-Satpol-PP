// /api/auth/change-password — current user changes own password
import { NextResponse } from "next/server";
import { getUserById, updateUserPassword, ensureTables } from "@/lib/db-raw";
import {
  getCurrentUser,
  verifyPassword,
  hashPassword,
} from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await ensureTables();
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: "Akses ditolak. Silakan login." }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const { currentPassword, newPassword } = body as Record<string, string | undefined>;
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Password lama dan baru wajib diisi" }, { status: 400 });
    }
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json({ error: "Password baru minimal 8 karakter" }, { status: 400 });
    }
    const user = await getUserById(session.sub);
    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }
    const ok = verifyPassword(String(currentPassword), String(user.password));
    if (!ok) {
      return NextResponse.json({ error: "Password lama salah" }, { status: 401 });
    }
    const newHash = hashPassword(String(newPassword));
    await updateUserPassword(session.sub, newHash);
    return NextResponse.json({ ok: true, message: "Password berhasil diubah" });
  } catch (err) {
    return NextResponse.json(
      { error: "Gagal mengubah password", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
