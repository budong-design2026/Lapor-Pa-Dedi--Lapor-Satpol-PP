// src/app/api/ai/analyze-report/route.ts — AI analysis (z-ai-web-dev-sdk) + rule-based fallback
import { NextResponse } from "next/server";
import { BIDANG_LIST, CATEGORIES, getCategory, RISK_LEVELS } from "@/lib/constants";

interface AnalyzeBody {
  description?: string;
  category?: string;
  address?: string;
  kabupaten?: string;
}

interface AnalysisResult {
  suggestedRiskLevel: keyof typeof RISK_LEVELS;
  suggestedBidang: string;
  suggestedPasal: string[];
  reasoning: string;
  source: "ai" | "heuristic";
}

// ─── Rule-based heuristic (fallback) ───
const CRITICAL_KW = [
  "roboh",
  "bencana",
  "gempa",
  "banjir bandang",
  "mafia",
  "bahaya",
  "korban jiwa",
  "keracunan massal",
  "ledakan",
  "kebakaran",
  "longsor",
  "tangkap",
  "main hakim sendiri",
  "anarkis",
  "bentrokan",
  "kematian",
  "kerusuhan",
];
const HIGH_KW = [
  "tilang",
  "penertiban",
  "razia",
  "bentrok",
  "dianiaya",
  "pemukulan",
  "pelanggaran berat",
  "peringatan keras",
  "langgar",
  "bongkar",
  "pengeroyokan",
];
const LOW_KW = [
  "kotor",
  "berantakan",
  "tidak rapi",
  "kecil",
  "ringan",
  "trotoar rusak",
  "jalan berlubang",
  "tanda",
];

function heuristicAnalyze(body: Required<AnalyzeBody>): AnalysisResult {
  const description = body.description?.toLowerCase() ?? "";
  const category = (body.category ?? "LAINNYA").toUpperCase();
  const text = `${description}`;

  let risk: keyof typeof RISK_LEVELS = "MEDIUM";
  if (CRITICAL_KW.some((kw) => text.includes(kw))) risk = "CRITICAL";
  else if (HIGH_KW.some((kw) => text.includes(kw))) risk = "HIGH";
  else if (LOW_KW.some((kw) => text.includes(kw))) risk = "LOW";

  // Bidang routing — prefer the bidang that handles this category
  let bidang = BIDANG_LIST[0]!.code;
  const candidates = BIDANG_LIST.filter((b) => b.handles.includes(category));
  if (candidates.length > 0) bidang = candidates[0]!.code;

  // Pasal suggestion
  const cat = getCategory(category);
  const perdaRef = cat?.perdaRef ?? "Perda No. 13 Tahun 2018";
  const pasalByCat: Record<string, string[]> = {
    BANGUNAN: ["Pasal 17 — Izin Mendirikan Bangunan", "Pasal 23 — Pelanggaran Tata Bangunan"],
    JALAN: ["Pasal 28 — Ketertiban Penggunaan Badan Jalan", "Pasal 30 — Trotoar & Pedestrian"],
    TEMPAT_USAHA: ["Pasal 35 — Tempat Usaha & PKL", "Pasal 36 — Penertiban Lapak"],
    SUNGAI: ["Pasal 40 — Bantaran Sungai & Situ"],
    LINGKUNGAN: ["Pasal 45 — Ketertiban Lingkungan Hidup"],
    SOSIAL: ["Pasal 50 — PMKS, Gelandang & Pengemis"],
    KESEHATAN: ["Pasal 55 — Ketertiban Tempat Umum"],
    BENCANA: ["Pasal 60 — Penanganan Keadaan Darurat"],
    TATA_RUANG: ["Pasal 14 — Penataan Ruang & Zonasi"],
    PERIZINAN: ["Pasal 70 — Ketertiban Perizinan"],
    ASN: ["Pasal 75 — Disiplin ASN"],
    ASET: ["Pasal 80 — Barang Milik Daerah"],
    KAWASAN_STRATEGIS: ["Pasal 85 — Kawasan Strategis Provinsi"],
    KEHUTANAN: ["Pasal 88 — Kawasan Hutan"],
    PERIKANAN: ["Pasal 92 — Pengelolaan Perikanan"],
    ESDM: ["Pasal 95 — ESDM"],
    PERHUBUNGAN: ["Pasal 100 — Ketertiban Perhubungan"],
    LAINNYA: ["Pasal 110 — Pengaduan Khusus"],
  };
  const pasal = [perdaRef, ...(pasalByCat[category] ?? ["Pasal sesuai kategori"])];

  const reasoning = `Heuristik: terdeteksi kata kunci risiko ${risk} pada deskripsi. Kategori ${category} dirutekan ke Bidang ${bidang}. Acuan: ${perdaRef}.`;

  return {
    suggestedRiskLevel: risk,
    suggestedBidang: bidang,
    suggestedPasal: pasal,
    reasoning,
    source: "heuristic",
  };
}

// ─── AI analyze via z-ai-web-dev-sdk ───
async function aiAnalyze(body: Required<AnalyzeBody>): Promise<AnalysisResult> {
  // Dynamic import — SDK is server-only ESM
  const ZAIModule = (await import("z-ai-web-dev-sdk")) as unknown as {
    default: { create(): Promise<{ chat: { completions: { create: (b: unknown) => Promise<any> } } }> };
  };
  const ZAI = ZAIModule.default;
  const zai = await ZAI.create();

  const category = body.category.toUpperCase();
  const catInfo = getCategory(category);
  const bidangList = BIDANG_LIST.map((b) => `${b.code} (${b.name} — handles: ${b.handles.join(",")})`).join("\n");

  const systemPrompt = `Anda adalah asisten AI Satpol PP Provinsi Jawa Barat.
Tugas: menganalisis draf laporan pengaduan Trantibumlinmas dan memberi rekomendasi.
Kembalikan HANYA JSON valid tanpa teks tambahan dengan format:
{
  "suggestedRiskLevel": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "suggestedBidang": "<kode bidang>",
  "suggestedPasal": ["<pasal 1>", "<pasal 2>"],
  "reasoning": "<alasan singkat dalam Bahasa Indonesia>"
}`;

  const userPrompt = `Analisis laporan berikut:
- Deskripsi: ${body.description}
- Kategori: ${category} (${catInfo?.name ?? "-"})
- Alamat: ${body.address}
- Kabupaten/Kota: ${body.kabupaten}

Daftar Bidang yang tersedia:
${bidangList}

Aturan penilaian risiko:
- CRITICAL (SLA 1 jam): ada ancaman jiwa, bencana, kerusuhan, mafia, bangunan roboh, ledakan, korban massal.
- HIGH (SLA 4 jam): pelanggaran berat, penertikan, ancaman fisik, penganiayaan, anarkis.
- MEDIUM (SLA 24 jam): pelanggaran perda standar yang membutuhkan tindakan cepat.
- LOW (SLA 72 jam): pelanggaran ringan, ketertiban estetika.

Sarankan Bidang yang paling sesuai berdasarkan kategori dan deskripsi.
Sarankan 1-3 pasal Perda No. 13/2018 yang relevan.
Berikan reasoning singkat (1-2 kalimat) dalam Bahasa Indonesia.`;

  const completion = await zai.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    thinking: { type: "disabled" },
  });

  const content: string = completion?.choices?.[0]?.message?.content ?? "";
  // Try to extract JSON from content
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("LLM tidak mengembalikan JSON valid");
  const parsed = JSON.parse(match[0]) as Partial<AnalysisResult>;

  // Validate & sanitize
  const validRisk = (["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).includes(
    parsed.suggestedRiskLevel as never
  )
    ? (parsed.suggestedRiskLevel as keyof typeof RISK_LEVELS)
    : "MEDIUM";

  const validBidang = BIDANG_LIST.some((b) => b.code === parsed.suggestedBidang)
    ? (parsed.suggestedBidang as string)
    : heuristicAnalyze(body).suggestedBidang;

  const pasalArr = Array.isArray(parsed.suggestedPasal)
    ? parsed.suggestedPasal.filter((p) => typeof p === "string").slice(0, 3)
    : [];

  const reasoning =
    typeof parsed.reasoning === "string" && parsed.reasoning.trim().length > 0
      ? parsed.reasoning.trim()
      : "Analisis AI selesai.";

  return {
    suggestedRiskLevel: validRisk,
    suggestedBidang: validBidang,
    suggestedPasal: pasalArr.length > 0 ? pasalArr : heuristicAnalyze(body).suggestedPasal,
    reasoning,
    source: "ai",
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as AnalyzeBody | null;
    if (!body) {
      return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
    }
    const description = (body.description ?? "").trim();
    const category = (body.category ?? "LAINNYA").toUpperCase();
    const address = (body.address ?? "").trim();
    const kabupaten = (body.kabupaten ?? "").trim();

    if (!description) {
      return NextResponse.json({ error: "Deskripsi wajib diisi" }, { status: 400 });
    }
    if (!CATEGORIES.some((c) => c.code === category)) {
      return NextResponse.json({ error: "Kategori tidak valid" }, { status: 400 });
    }

    const input: Required<AnalyzeBody> = { description, category, address, kabupaten };

    let result: AnalysisResult;
    try {
      result = await aiAnalyze(input);
    } catch (aiErr) {
      // AI failure → heuristic fallback (never 500)
      console.warn("[ai/analyze-report] AI gagal, fallback heuristic:", aiErr instanceof Error ? aiErr.message : aiErr);
      result = heuristicAnalyze(input);
    }

    return NextResponse.json(result);
  } catch (err) {
    // Final safety net — return heuristic fallback if body parseable, else 500
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Gagal menganalisis laporan", detail: msg.slice(0, 200) },
      { status: 500 }
    );
  }
}
