import { NextResponse } from "next/server";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  const dbToken = process.env.DATABASE_AUTH_TOKEN;
  const secret = process.env.NEXTAUTH_SECRET;
  const url = process.env.NEXTAUTH_URL;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPass = process.env.ADMIN_PASSWORD;

  const diagnosis: string[] = [];

  if (!dbUrl) {
    diagnosis.push("❌ DATABASE_URL TIDAK terbaca. Set di Vercel Settings → Environment Variables. Pastikan Environment 'Production' tercentang.");
  } else if (!dbUrl.startsWith("libsql://") && !dbUrl.startsWith("wss://")) {
    diagnosis.push(`❌ DATABASE_URL ada tapi format salah. Mulai dengan: "${dbUrl.slice(0, 10)}...". Harus libsql://... — salin 'Connection URL' dari Turso (bukan yang https://).`);
  } else {
    diagnosis.push(`✅ DATABASE_URL OK — mulai: ${dbUrl.slice(0, 15)}..., panjang ${dbUrl.length} karakter.`);
  }

  if (!dbToken) {
    diagnosis.push("❌ DATABASE_AUTH_TOKEN TIDAK terbaca. Set di Vercel (value = Auth Token Turso).");
  } else {
    diagnosis.push(`✅ DATABASE_AUTH_TOKEN OK — panjang ${dbToken.length} karakter.`);
  }

  if (!secret) diagnosis.push("❌ NEXTAUTH_SECRET TIDAK terbaca.");
  else diagnosis.push(`✅ NEXTAUTH_SECRET OK — panjang ${secret.length} karakter.`);

  if (!url) diagnosis.push("⚠️ NEXTAUTH_URL tidak diset (opsional).");
  else diagnosis.push(`✅ NEXTAUTH_URL = ${url}`);

  if (!adminEmail) diagnosis.push("❌ ADMIN_EMAIL TIDAK terbaca.");
  else diagnosis.push(`✅ ADMIN_EMAIL = ${adminEmail}`);

  if (!adminPass) diagnosis.push("❌ ADMIN_PASSWORD TIDAK terbaca.");
  else if (adminPass.length < 10) diagnosis.push(`❌ ADMIN_PASSWORD terlalu pendek (${adminPass.length} char, min 10).`);
  else diagnosis.push(`✅ ADMIN_PASSWORD OK — panjang ${adminPass.length} karakter.`);

  const result = {
    timestamp: new Date().toISOString(),
    runtime: {
      nodeEnv: process.env.NODE_ENV,
      vercelRegion: process.env.VERCEL_REGION ?? "tidak-terbaca",
    },
    diagnosis,
    nextStep:
      dbUrl && dbUrl.startsWith("libsql://") && dbToken
        ? "✅ Semua env var OK! Sekarang buka /api/setup untuk inisialisasi database."
        : "🔧 Perbaiki env var yang ditandai ❌ di Vercel → Settings → Environment Variables (pastikan Environment=Production tercentang), lalu trigger deploy baru (commit kecil ke repo).",
  };

  return new NextResponse(JSON.stringify(result, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
