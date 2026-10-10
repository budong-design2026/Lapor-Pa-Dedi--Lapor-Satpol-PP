// /api/reports/upload — Convert uploaded file to base64 data URL (no filesystem write)
// Vercel serverless filesystem is READ-ONLY — can't save files to disk.
// Instead, return a base64 data URL that gets stored in the DB (photosJson).
import { NextResponse } from "next/server";
import { MAX_PHOTO_SIZE_MB, MAX_VIDEO_SIZE_MB } from "@/lib/constants";

const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO = ["video/mp4", "video/webm", "video/quicktime"];
const IMAGE_MAX = MAX_PHOTO_SIZE_MB * 1024 * 1024;
const VIDEO_MAX = MAX_VIDEO_SIZE_MB * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json({ error: "Form multipart tidak valid" }, { status: 400 });
    }
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Field 'file' wajib diunggah" }, { status: 400 });
    }

    const mime = file.type.toLowerCase();
    const isImage = ALLOWED_IMAGE.includes(mime);
    const isVideo = ALLOWED_VIDEO.includes(mime);
    if (!isImage && !isVideo) {
      return NextResponse.json({ error: `Tipe file tidak didukung: ${mime}` }, { status: 415 });
    }

    const maxBytes = isImage ? IMAGE_MAX : VIDEO_MAX;
    if (file.size > maxBytes) {
      const limit = isImage ? `${MAX_PHOTO_SIZE_MB}MB` : `${MAX_VIDEO_SIZE_MB}MB`;
      return NextResponse.json({ error: `Ukuran file melebihi batas ${limit}` }, { status: 413 });
    }

    // Convert to base64 data URL — NO filesystem write (works on Vercel serverless)
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${mime};base64,${base64}`;

    return NextResponse.json({ url: dataUrl });
  } catch (e) {
    return NextResponse.json(
      { error: "Gagal mengunggah file", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
