// src/app/api/reports/upload/route.ts — multipart file upload
import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { MAX_PHOTO_SIZE_MB, MAX_VIDEO_SIZE_MB } from "@/lib/constants";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO = ["video/mp4", "video/webm", "video/quicktime"];
const IMAGE_MAX = MAX_PHOTO_SIZE_MB * 1024 * 1024;
const VIDEO_MAX = MAX_VIDEO_SIZE_MB * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export async function POST(req: Request) {
  try {
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { error: "Form multipart tidak valid" },
        { status: 400 }
      );
    }
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Field 'file' wajib diunggah" },
        { status: 400 }
      );
    }

    const mime = file.type.toLowerCase();
    const isImage = ALLOWED_IMAGE.includes(mime);
    const isVideo = ALLOWED_VIDEO.includes(mime);
    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: `Tipe file tidak didukung: ${mime}` },
        { status: 415 }
      );
    }

    const maxBytes = isImage ? IMAGE_MAX : VIDEO_MAX;
    if (file.size > maxBytes) {
      const limit = isImage ? `${MAX_PHOTO_SIZE_MB}MB` : `${MAX_VIDEO_SIZE_MB}MB`;
      return NextResponse.json(
        { error: `Ukuran file melebihi batas ${limit}` },
        { status: 413 }
      );
    }

    // Ensure upload dir
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const ext = EXT_BY_MIME[mime];
    const filename = `${uuidv4()}.${ext}`;
    const fullPath = path.join(UPLOAD_DIR, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(fullPath, buffer);

    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch {
    return NextResponse.json({ error: "Gagal mengunggah file" }, { status: 500 });
  }
}
