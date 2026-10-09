// /api/auth/change-password — Authenticated user changes own password.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserById, verifyPassword, updateUserPassword, hashPassword } from "@/lib/db-raw";

export async function POST(req: Request) {
  try {
    const u = await getCurrentUser();
    if (!u) {
      return NextResponse.json({ error: "Sesi berakhir, silakan masuk lagi" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Password lama & baru wajib diisi" }, { status: 400 });
    }
    if (String(newPassword).length < 8) {
      return NextResponse.json(
        { error: "Password baru minimal 8 karakter" },
        { status: 400 }
      );
    }

    const user = await getUserById(u.sub);
    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }
    if (!verifyPassword(String(currentPassword), user.password)) {
      return NextResponse.json({ error: "Password lama salah" }, { status: 401 });
    }

    await updateUserPassword(user.id, hashPassword(String(newPassword)));

    return NextResponse.json({ ok: true, message: "Password berhasil diubah" });
  } catch (e) {
    return NextResponse.json(
      { error: "Gagal mengubah password", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
