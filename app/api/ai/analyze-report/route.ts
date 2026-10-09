// /api/ai/analyze-report — analyze description → suggest risk/bidang/pasal (z-ai-web-dev-sdk).
// Fallback to heuristic on SDK error.
import { NextResponse } from "next/server";
import { BIDANG_LIST, CATEGORIES, RISK_LEVELS } from "@/lib/constants";

interface AnalyzeResult {
  suggestedRiskLevel: keyof typeof RISK_LEVELS;
  suggestedBidang: string;
  suggestedPasal: string[];
  reasoning: string;
  source: "ai" | "heuristic";
}

function heuristicAnalyze(description: string, category: string): AnalyzeResult {
  const d = (description || "").toLowerCase();
  const criticalKeywords = [
    "bencana", "kebakaran", "longsor", "banjir", "gempa", "korban",
    "anarki", "bentrokan", "tawuran", "kekerasan", "berdarah", "maling",
    "pengeroyokan", "ancaman", "kerusuhan", "darurat", "kritis",
  ];
  const highKeywords = [
    "protes", "mengganggu", "pelanggaran berat", "berbahaya",
    "bocor", "tangki", "limbah beracun", "pencemaran", "merusak",
    "menghalabi", "menduduki", "merusak fasilitas",
  ];
  const mediumKeywords = [
    "ganggu", "samping jalan", "trotoar", "menutup", "menempati",
    "berisik", "bau", "menyimpang", "lapak", "liar", "menutup akses",
  ];

  let risk: keyof typeof RISK_LEVELS = "LOW";
  if (criticalKeywords.some((k) => d.includes(k))) risk = "CRITICAL";
  else if (highKeywords.some((k) => d.includes(k))) risk = "HIGH";
  else if (mediumKeywords.some((k) => d.includes(k))) risk = "MEDIUM";

  // Find first bidang whose handles includes the category
  const bidang = BIDANG_LIST.find((b) => b.handles.includes(category)) ?? BIDANG_LIST[0];
  const cat = CATEGORIES.find((c) => c.code === category);
  const pasal = cat?.perdaRef ? [cat.perdaRef] : [];
  const reasoning = `Heuristik: kategori=${cat?.name ?? category}, frekuensi kata kunci mengindikasikan tingkat risiko ${RISK_LEVELS[risk].label}. Ditangani oleh ${bidang.name}.`;

  return {
    suggestedRiskLevel: risk,
    suggestedBidang: bidang.code,
    suggestedPasal: pasal,
    reasoning,
    source: "heuristic",
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { description, category, address, kabupaten } = body as Record<string, string | undefined>;
    if (!description || typeof description !== "string") {
      return NextResponse.json({ error: "Description wajib diisi" }, { status: 400 });
    }
    if (!category || !CATEGORIES.some((c) => c.code === String(category))) {
      return NextResponse.json({ error: "Kategori tidak valid" }, { status: 400 });
    }

    const fallback = heuristicAnalyze(String(description), String(category));

    // Try z-ai-web-dev-sdk
    try {
      const mod = (await import("z-ai-web-dev-sdk")) as any;
      const create = mod?.create ?? mod?.default?.create;
      if (typeof create !== "function") throw new Error("SDK create() not found");
      const zai = await create();
      const cat = CATEGORIES.find((c) => c.code === String(category));
      const bidangCodes = BIDANG_LIST.map((b) => b.code).join(", ");
      const systemPrompt = `Anda adalah analis pengaduan Satpol PP Jawa Barat. Analisis laporan warga dan balas HANYA dengan JSON valid (tanpa kode blok, tanpa teks tambahan) berisi:
{"suggestedRiskLevel":"CRITICAL|HIGH|MEDIUM|LOW","suggestedBidang":"${bidangCodes}","suggestedPasal":["pasal/perda ref..."],"reasoning":"alasan singkat bahasa Indonesia"}`;
      const userPrompt = `Laporan:
- Kategori: ${cat?.name ?? category} (${cat?.description ?? ""})
- Deskripsi: ${String(description).slice(0, 1500)}
- Alamat: ${address ?? "-"}
- Kabupaten/Kota: ${kabupaten ?? "-"}

Tentukan riskLevel, bidang penanganan, pasal/perda terkait, dan reasoning singkat.`;
      const completion = await zai.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        thinking: { type: "disabled" },
      });
      const text: string =
        completion?.choices?.[0]?.message?.content ??
        completion?.content ??
        (typeof completion === "string" ? completion : "");
      // Extract JSON object from response (robust against code fences)
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("AI tidak mengembalikan JSON valid");
      const parsed = JSON.parse(match[0]);
      const risk = (parsed.suggestedRiskLevel ?? fallback.suggestedRiskLevel) as keyof typeof RISK_LEVELS;
      if (!RISK_LEVELS[risk]) throw new Error("Risk level tidak valid dari AI");
      const bidang = String(parsed.suggestedBidang ?? fallback.suggestedBidang);
      if (!BIDANG_LIST.some((b) => b.code === bidang)) throw new Error("Bidang tidak valid dari AI");
      const pasalArr = Array.isArray(parsed.suggestedPasal)
        ? (parsed.suggestedPasal as string[]).filter((p) => typeof p === "string")
        : fallback.suggestedPasal;
      const reasoning = typeof parsed.reasoning === "string" && parsed.reasoning.trim()
        ? String(parsed.reasoning)
        : fallback.reasoning;
      return NextResponse.json({
        suggestedRiskLevel: risk,
        suggestedBidang: bidang,
        suggestedPasal: pasalArr,
        reasoning,
        source: "ai",
      });
    } catch (sdkErr) {
      // Fallback to heuristic
      void sdkErr;
      return NextResponse.json(fallback);
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Gagal menganalisis laporan", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
