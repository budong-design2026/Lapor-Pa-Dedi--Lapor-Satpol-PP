"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ClipboardList,
  MapPin,
  LocateFixed,
  X,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  ShieldCheck,
  Info,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { GoldShimmerText } from "@/components/shared/gold-shimmer-text";
import { MapPreview } from "@/components/shared/map-preview";
import { EmptyState } from "@/components/shared/empty-state";
import { CategoryIcon } from "@/components/shared/category-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/store/app-store";
import {
  CATEGORIES,
  KABUPATEN_KOTA,
  MAX_PHOTOS,
  MAX_PHOTO_SIZE_MB,
  TAGLINE,
  getCategory,
} from "@/lib/constants";
import { apiFetch, apiUpload, ApiError } from "@/lib/api-client";

// Batas upload foto dipusatkan di @/lib/constants (Task 12 → MAX_PHOTOS=3,
// MAX_PHOTO_SIZE_MB=2). Jangan hardcode angka di sini — semua tampilan &
// validasi (toast "Maksimal X foto", label "0/X foto dipilih", cek ukuran
// per file, cek sisa slot) membaca dari konstanta supaya konsisten.
const MAX_BYTES = MAX_PHOTO_SIZE_MB * 1024 * 1024;

// Auto-compress: resize to max 1280px + JPEG quality 0.75 → ~200-400KB regardless of original
async function compressImage(file: File, maxDim = 1280, quality = 0.75): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        resolve(new File([blob], file.name.replace(/\.(png|webp)$/i, ".jpg"), { type: "image/jpeg" }));
      }, "image/jpeg", quality);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}
const DESC_MIN = 20;
const NIK_PATTERN = /^[0-9]{16}$/;

interface PhotoItem {
  id: string;
  file: File;
  previewUrl: string;
  status: "queued" | "uploading" | "done" | "error";
  remoteUrl?: string;
  errorMsg?: string;
}

interface FormState {
  reporterName: string;
  reporterNik: string;
  reporterBirthPlace: string;
  reporterBirthDate: string;
  reporterAddress: string;
  reporterPhone: string;
  isAnonymous: boolean;
  category: string;
  subCategory: string;
  description: string;
  address: string;
  kabupaten: string;
  latitude: number | null;
  longitude: number | null;
}

const INITIAL: FormState = {
  reporterName: "",
  reporterNik: "",
  reporterBirthPlace: "",
  reporterBirthDate: "",
  reporterAddress: "",
  reporterPhone: "",
  isAnonymous: false,
  category: "",
  subCategory: "",
  description: "",
  address: "",
  kabupaten: "",
  latitude: null,
  longitude: null,
};

type GpsStatus = "idle" | "detecting" | "success" | "error";

export function LaporView() {
  const setView = useAppStore((s) => s.setView);

  const [form, setForm] = React.useState<FormState>(INITIAL);
  const [photos, setPhotos] = React.useState<PhotoItem[]>([]);
  const [gpsStatus, setGpsStatus] = React.useState<GpsStatus>("idle");
  const [gpsError, setGpsError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [successTicket, setSuccessTicket] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  // Cleanup object URLs on unmount
  React.useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // We intentionally close over `photos` once at mount to revoke whatever was set
    // when this component instance unmounts.
  }, []);

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function touch(key: string) {
    setTouched((t) => ({ ...t, [key]: true }));
  }

  // ─── Photos ───
  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      toast.error(`Maksimal ${MAX_PHOTOS} foto`);
      e.target.value = "";
      return;
    }

    const accepted: PhotoItem[] = [];
    let rejectedCount = 0;

    for (const file of files) {
      if (accepted.length >= remaining) {
        rejectedCount++;
        continue;
      }
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name}: hanya file gambar`);
        continue;
      }
      const compressed = await compressImage(file);
      if (compressed.size > MAX_BYTES) {
        toast.error(
          `${file.name}: melebihi ${MAX_PHOTO_SIZE_MB}MB setelah kompresi (ukuran ${(compressed.size / 1024 / 1024).toFixed(2)}MB)`
        );
        continue;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: compressed,
        previewUrl: URL.createObjectURL(file),
        status: "queued",
      });
    }

    if (rejectedCount > 0) {
      toast.error(`${rejectedCount} foto melebihi batas maksimal ${MAX_PHOTOS}`);
    }

    if (accepted.length > 0) {
      setPhotos((prev) => [...prev, ...accepted]);
      toast.success(`${accepted.length} foto ditambahkan`);
    }

    e.target.value = "";
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  // ─── GPS ───
  function detectGps() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsStatus("error");
      setGpsError("Geolocation tidak didukung perangkat ini.");
      return;
    }
    setGpsStatus("detecting");
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }));
        setGpsStatus("success");
        toast.success("Lokasi GPS terdeteksi");
      },
      (err) => {
        setGpsStatus("error");
        const map: Record<number, string> = {
          1: "Akses lokasi ditolak. Aktifkan izin lokasi atau isi manual.",
          2: "Lokasi tidak tersedia. Coba lagi atau isi manual.",
          3: "Waktu habis. Coba lagi atau isi manual.",
        };
        setGpsError(map[err.code] ?? "Gagal mendeteksi lokasi.");
        toast.error("Gagal mendeteksi GPS");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  // ─── Validation ───
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!form.reporterName.trim() && !form.isAnonymous)
    errors.reporterName = "Nama wajib diisi";
  if (!form.isAnonymous && !NIK_PATTERN.test(form.reporterNik))
    errors.reporterNik = "NIK harus 16 digit angka";
  if (!form.category) errors.category = "Kategori wajib dipilih";
  if (form.description.trim().length < DESC_MIN)
    errors.description = `Deskripsi minimal ${DESC_MIN} karakter`;
  if (!form.address.trim()) errors.address = "Alamat kejadian wajib diisi";
  if (!form.kabupaten) errors.kabupaten = "Kabupaten/Kota wajib dipilih";
  if (
    form.latitude == null ||
    form.longitude == null ||
    !Number.isFinite(form.latitude) ||
    !Number.isFinite(form.longitude)
  ) {
    errors.latitude = "Lokasi belum ditentukan";
  }

  const isValid = Object.keys(errors).length === 0;

  // ─── Submit ───
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    // Touch all fields so errors are visible
    const allKeys: (keyof FormState)[] = [
      "reporterName",
      "reporterNik",
      "category",
      "description",
      "address",
      "kabupaten",
      "latitude",
    ];
    const t: Record<string, boolean> = {};
    allKeys.forEach((k) => (t[k] = true));
    setTouched(t);

    if (!isValid) {
      toast.error("Lengkapi data wajib sebelum mengirim");
      return;
    }

    setSubmitting(true);

    // Upload photos
    const photoUrls: string[] = [];
    try {
      for (const p of photos) {
        if (p.status === "done" && p.remoteUrl) {
          photoUrls.push(p.remoteUrl);
          continue;
        }
        setPhotos((prev) =>
          prev.map((x) => (x.id === p.id ? { ...x, status: "uploading" } : x))
        );
        try {
          const fd = new FormData();
          fd.append("file", p.file);
          const res = await apiUpload<{ url: string }>(
            "/api/reports/upload",
            fd
          );
          photoUrls.push(res.url);
          setPhotos((prev) =>
            prev.map((x) =>
              x.id === p.id ? { ...x, status: "done", remoteUrl: res.url } : x
            )
          );
        } catch (err: unknown) {
          const msg =
            err instanceof ApiError ? err.message : "Upload gagal";
          setPhotos((prev) =>
            prev.map((x) =>
              x.id === p.id ? { ...x, status: "error", errorMsg: msg } : x
            )
          );
          throw new Error(`Upload foto "${p.file.name}" gagal: ${msg}`);
        }
      }

      const body = {
        category: form.category,
        subCategory: form.subCategory.trim() || undefined,
        description: form.description.trim(),
        address: form.address.trim(),
        latitude: form.latitude,
        longitude: form.longitude,
        kabupaten: form.kabupaten,
        isAnonymous: form.isAnonymous,
        photos: photoUrls,
        videos: [],
        reporterName: form.isAnonymous ? "Anonim" : form.reporterName.trim(),
        reporterPhone: form.reporterPhone.trim() || undefined,
        reporterNik: form.isAnonymous ? undefined : form.reporterNik.trim(),
        reporterBirthPlace: form.isAnonymous
          ? undefined
          : form.reporterBirthPlace.trim() || undefined,
        reporterBirthDate: form.isAnonymous
          ? undefined
          : form.reporterBirthDate || undefined,
        reporterAddress: form.isAnonymous
          ? undefined
          : form.reporterAddress.trim() || undefined,
      };

      const res = await apiFetch<{ report: { ticketNumber: string } }>(
        "/api/reports",
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );

      setSuccessTicket(res.report.ticketNumber);
      toast.success(`Laporan terkirim! Tiket: ${res.report.ticketNumber}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengirim laporan";
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Success state ───
  if (successTicket) {
    return (
      <SuccessState
        ticket={successTicket}
        onTrack={() => {
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.set("ticket", successTicket);
            window.history.replaceState(null, "", url.toString());
          }
          setView("track");
        }}
        onReset={() => {
          // Revoke any remaining previews
          photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
          setPhotos([]);
          setForm(INITIAL);
          setGpsStatus("idle");
          setGpsError(null);
          setSubmitError(null);
          setSuccessTicket(null);
          setTouched({});
        }}
        copied={copied}
        setCopied={setCopied}
      />
    );
  }

  const selectedCategory = form.category ? getCategory(form.category) : null;
  const descLen = form.description.trim().length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="pb-6"
    >
      <div className="mb-5 space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
          <GoldShimmerText as="span">Lapor Pelanggaran</GoldShimmerText>
        </h1>
        <p className="text-sm text-muted-foreground">{TAGLINE}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ─── Section 1: Identitas Pelapor ─── */}
        <Card section="1" title="Identitas Pelapor" icon={ClipboardList}>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                id="reporterName"
                label="Nama Lengkap"
                required={!form.isAnonymous}
                error={touched.reporterName ? errors.reporterName : undefined}
              >
                <Input
                  id="reporterName"
                  value={form.reporterName}
                  onChange={(e) => setField("reporterName", e.target.value)}
                  onBlur={() => touch("reporterName")}
                  placeholder="Nama sesuai KTP"
                  disabled={form.isAnonymous}
                  autoComplete="name"
                  aria-invalid={
                    touched.reporterName && !!errors.reporterName
                  }
                />
              </Field>

              <Field
                id="reporterNik"
                label="NIK"
                required={!form.isAnonymous}
                hint="16 digit sesuai KTP"
                error={touched.reporterNik ? errors.reporterNik : undefined}
              >
                <Input
                  id="reporterNik"
                  value={form.reporterNik}
                  onChange={(e) =>
                    setField(
                      "reporterNik",
                      e.target.value.replace(/[^0-9]/g, "").slice(0, 16)
                    )
                  }
                  onBlur={() => touch("reporterNik")}
                  placeholder="3201xxxxxxxxxxxx"
                  inputMode="numeric"
                  disabled={form.isAnonymous}
                  autoComplete="off"
                  aria-invalid={
                    touched.reporterNik && !!errors.reporterNik
                  }
                />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field id="reporterBirthPlace" label="Tempat Lahir">
                <Input
                  id="reporterBirthPlace"
                  value={form.reporterBirthPlace}
                  onChange={(e) =>
                    setField("reporterBirthPlace", e.target.value)
                  }
                  placeholder="Bandung"
                  disabled={form.isAnonymous}
                />
              </Field>

              <Field id="reporterBirthDate" label="Tanggal Lahir">
                <Input
                  id="reporterBirthDate"
                  type="date"
                  value={form.reporterBirthDate}
                  onChange={(e) =>
                    setField("reporterBirthDate", e.target.value)
                  }
                  disabled={form.isAnonymous}
                />
              </Field>
            </div>

            <Field id="reporterAddress" label="Alamat Domisili">
              <Textarea
                id="reporterAddress"
                value={form.reporterAddress}
                onChange={(e) =>
                  setField("reporterAddress", e.target.value)
                }
                placeholder="Jl. ... No. ... RT/RW Kel. ... Kec. ..."
                rows={2}
                disabled={form.isAnonymous}
              />
            </Field>

            <Field id="reporterPhone" label="No. HP (opsional)">
              <Input
                id="reporterPhone"
                type="tel"
                value={form.reporterPhone}
                onChange={(e) => setField("reporterPhone", e.target.value)}
                placeholder="08xxxxxxxxxx"
                inputMode="tel"
                autoComplete="tel"
              />
            </Field>

            <div className="rounded-lg border border-jabar-gold/30 bg-jabar-gold/5 p-3 sm:p-4 space-y-2">
              <div className="flex items-start gap-3">
                <Switch
                  id="anon-switch"
                  checked={form.isAnonymous}
                  onCheckedChange={(v) => setField("isAnonymous", v)}
                  aria-label="Lapor sebagai anonim"
                />
                <div className="flex-1 space-y-0.5">
                  <Label
                    htmlFor="anon-switch"
                    className="cursor-pointer text-sm font-semibold"
                  >
                    Lapor sebagai anonim (sembunyikan identitas dari publik)
                  </Label>
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
                    <span>
                      Identitas tetap tercatat di sistem dan tetap terlihat
                      oleh petugas/operator untuk verifikasi, namun tidak
                      ditampilkan di dashboard publik.
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* ─── Section 2: Detail Pelanggaran ─── */}
        <Card
          section="2"
          title="Detail Pelanggaran"
          icon={ShieldCheck}
        >
          <div className="space-y-4">
            <Field
              id="category"
              label="Kategori"
              required
              error={touched.category ? errors.category : undefined}
            >
              <Select
                value={form.category}
                onValueChange={(v) => {
                  setField("category", v);
                  touch("category");
                }}
              >
                <SelectTrigger
                  id="category"
                  className="w-full"
                  aria-label="Pilih kategori"
                >
                  <SelectValue placeholder="Pilih kategori…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>17 Ketertiban</SelectLabel>
                    {CATEGORIES.filter((c) => c.code !== "LAINNYA").map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        <span className="flex items-center gap-2">
                          <CategoryIcon code={c.code} className="h-4 w-4" />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Lainnya</SelectLabel>
                    {CATEGORIES.filter((c) => c.code === "LAINNYA").map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            {selectedCategory ? (
              <div className="rounded-lg bg-accent/30 border border-border/60 p-3 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {selectedCategory.perdaRef ?? "Kategori khusus"}
                </p>
                <p className="text-sm text-foreground">
                  {selectedCategory.description}
                </p>
              </div>
            ) : null}

            <Field id="subCategory" label="Sub-kategori (opsional)">
              <Input
                id="subCategory"
                value={form.subCategory}
                onChange={(e) => setField("subCategory", e.target.value)}
                placeholder="cth. PKL di trotoar, sampah sungai, ..."
              />
            </Field>

            <Field
              id="description"
              label="Deskripsi Kejadian"
              required
              hint={`${descLen}/${DESC_MIN} karakter minimum`}
              error={touched.description ? errors.description : undefined}
            >
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => {
                  setField("description", e.target.value);
                  if (e.target.value.length >= DESC_MIN) touch("description");
                }}
                onBlur={() => touch("description")}
                placeholder="Jelaskan kejadian, waktu, pelaku, dampak..."
                rows={4}
                maxLength={1000}
                aria-invalid={
                  touched.description && !!errors.description
                }
              />
            </Field>

            <Field
              id="address"
              label="Alamat Kejadian"
              required
              error={touched.address ? errors.address : undefined}
            >
              <Textarea
                id="address"
                value={form.address}
                onChange={(e) => setField("address", e.target.value)}
                onBlur={() => touch("address")}
                placeholder="Lokasi pelanggaran: jalan, nomor, patokan..."
                rows={2}
                aria-invalid={touched.address && !!errors.address}
              />
            </Field>

            <Field
              id="kabupaten"
              label="Kabupaten/Kota"
              required
              error={touched.kabupaten ? errors.kabupaten : undefined}
            >
              <Select
                value={form.kabupaten}
                onValueChange={(v) => {
                  setField("kabupaten", v);
                  touch("kabupaten");
                }}
              >
                <SelectTrigger
                  id="kabupaten"
                  className="w-full"
                  aria-label="Pilih kabupaten/kota"
                >
                  <SelectValue placeholder="Pilih kabupaten/kota…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Jawa Barat</SelectLabel>
                    {KABUPATEN_KOTA.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </Card>

        {/* ─── Section 3: GPS ─── */}
        <Card section="3" title="Lokasi (GPS)" icon={MapPin}>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">
                  Deteksi otomatis lokasi Anda
                </p>
                <p className="text-xs text-muted-foreground">
                  Browser akan meminta izin akses lokasi.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={detectGps}
                disabled={gpsStatus === "detecting"}
                className="border-jabar-gold/60 text-jabar-gold hover:bg-jabar-gold/10"
              >
                {gpsStatus === "detecting" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <LocateFixed className="h-4 w-4" aria-hidden />
                )}
                Deteksi GPS Otomatis
              </Button>
            </div>

            {gpsStatus === "success" &&
            form.latitude != null &&
            form.longitude != null ? (
              <MapPreview
                latitude={form.latitude}
                longitude={form.longitude}
              />
            ) : gpsStatus === "error" ? (
              <div className="space-y-3">
                <EmptyState
                  icon={AlertTriangle}
                  title="Gagal mendeteksi GPS"
                  description={gpsError ?? "Aktifkan izin lokasi atau isi manual."}
                />
                <ManualLatLon
                  latitude={form.latitude}
                  longitude={form.longitude}
                  onChange={(lat, lng) => {
                    setForm((f) => ({ ...f, latitude: lat, longitude: lng }));
                  }}
                />
              </div>
            ) : (
              <ManualLatLon
                latitude={form.latitude}
                longitude={form.longitude}
                onChange={(lat, lng) => {
                  setForm((f) => ({ ...f, latitude: lat, longitude: lng }));
                }}
              />
            )}

            {touched.latitude && errors.latitude ? (
              <p className="text-xs text-destructive" role="alert">
                {errors.latitude}
              </p>
            ) : null}
          </div>
        </Card>

        {/* ─── Section 4: Upload Foto ─── */}
        <Card section="4" title="Upload Bukti Foto" icon={Upload}>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Maksimal {MAX_PHOTOS} foto, masing-masing ≤ {MAX_PHOTO_SIZE_MB}MB
              (JPEG/PNG/WebP). Video menyusul.
            </p>

            <label
              htmlFor="photo-input"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/60 bg-accent/20 px-4 py-6 text-center hover:border-jabar-gold/50 hover:bg-jabar-gold/5 transition"
            >
              <ImageIcon className="h-8 w-8 text-muted-foreground" aria-hidden />
              <span className="text-sm font-medium">
                Klik untuk pilih foto
              </span>
              <span className="text-xs text-muted-foreground">
                {photos.length}/{MAX_PHOTOS} foto dipilih
              </span>
              <input
                id="photo-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={handlePhotoSelect}
              />
            </label>

            {photos.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {photos.map((p) => (
                  <div
                    key={p.id}
                    className="relative group aspect-square overflow-hidden rounded-lg border border-border/60 bg-background"
                  >
                    <img
                      src={p.previewUrl}
                      alt={p.file.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(p.id)}
                      aria-label={`Hapus foto ${p.file.name}`}
                      className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-foreground hover:bg-destructive hover:text-white transition"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-background/85 backdrop-blur-sm px-2 py-1">
                      {p.status === "queued" ? (
                        <span className="text-[10px] text-muted-foreground truncate block">
                          {p.file.name}
                        </span>
                      ) : p.status === "uploading" ? (
                        <span className="text-[10px] text-jabar-gold flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                          Mengunggah…
                        </span>
                      ) : p.status === "done" ? (
                        <span className="text-[10px] text-green-500 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" aria-hidden />
                          Tersimpan
                        </span>
                      ) : (
                        <span className="text-[10px] text-destructive truncate block">
                          Gagal
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Card>

        {/* ─── Submit ─── */}
        {submitError ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <span>{submitError}</span>
          </div>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setView("home")}
            className="sm:order-1"
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-jabar-gold text-background hover:bg-jabar-gold/90 font-bold sm:order-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Mengirim…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" aria-hidden />
                Kirim Laporan
              </>
            )}
          </Button>
        </div>
      </form>
    </motion.div>
  );
}

// ─── Helper sub-components (local) ───

function Card({
  section,
  title,
  icon: Icon,
  children,
}: {
  section: string;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-jabar-gold/15 text-jabar-gold shrink-0">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Bagian {section}
          </p>
          <h2 className="text-base font-bold tracking-tight -mt-0.5">
            {title}
          </h2>
        </div>
      </div>
      {children}
    </GlassCard>
  );
}

function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-sm">
          {label}
          {required ? (
            <span className="text-destructive ml-0.5" aria-hidden>
              *
            </span>
          ) : null}
        </Label>
        {hint ? (
          <span className="text-[11px] text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ManualLatLon({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field id="latitude" label="Latitude">
        <Input
          id="latitude"
          type="number"
          step="any"
          inputMode="decimal"
          value={latitude ?? ""}
          onChange={(e) => {
            const v = e.target.value === "" ? null : Number(e.target.value);
            onChange(Number.isFinite(v) ? v : null, longitude);
          }}
          placeholder="-6.9175"
        />
      </Field>
      <Field id="longitude" label="Longitude">
        <Input
          id="longitude"
          type="number"
          step="any"
          inputMode="decimal"
          value={longitude ?? ""}
          onChange={(e) => {
            const v = e.target.value === "" ? null : Number(e.target.value);
            onChange(latitude, Number.isFinite(v) ? v : null);
          }}
          placeholder="107.6191"
        />
      </Field>
    </div>
  );
}

function SuccessState({
  ticket,
  onTrack,
  onReset,
  copied,
  setCopied,
}: {
  ticket: string;
  onTrack: () => void;
  onReset: () => void;
  copied: boolean;
  setCopied: (v: boolean) => void;
}) {
  function copyTicket() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard
        .writeText(ticket)
        .then(() => {
          setCopied(true);
          toast.success("Tiket disalin");
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => toast.error("Gagal menyalin"));
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="pb-6"
    >
      <GlassCard className="p-6 sm:p-10 text-center space-y-6 max-w-xl mx-auto">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15 text-green-500">
            <CheckCircle2 className="h-9 w-9" aria-hidden />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            Laporan Berhasil Dikirim
          </h2>
          <p className="text-sm text-muted-foreground">
            Simpan nomor tiket di bawah untuk melacak status laporan Anda.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Nomor Tiket
          </p>
          <div className="flex items-center justify-center gap-2">
            <GoldShimmerText
              as="span"
              className="text-2xl sm:text-3xl font-mono"
            >
              {ticket}
            </GoldShimmerText>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={copyTicket}
              aria-label="Salin nomor tiket"
              className="h-8 w-8 text-muted-foreground hover:text-jabar-gold"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button
            type="button"
            onClick={onTrack}
            className="bg-jabar-gold text-background hover:bg-jabar-gold/90 font-bold"
          >
            <MapPin className="h-4 w-4" aria-hidden />
            Lacak Laporan Ini
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onReset}
            className="border-jabar-gold/60 text-jabar-gold hover:bg-jabar-gold/10"
          >
            <ClipboardList className="h-4 w-4" aria-hidden />
            Lapor Lagi
          </Button>
        </div>
      </GlassCard>
    </motion.div>
  );
}
