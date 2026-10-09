"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
  MapPin,
  UserRound,
  Phone,
  IdCard,
  Cake,
  Home,
  ImageOff,
  Sparkles,
  Loader2,
  Send,
  RefreshCw,
  Camera,
  ExternalLink,
  MessageCircle,
  ShieldAlert,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/app-store";
import { GlassCard } from "@/components/shared/glass-card";
import { GoldShimmerText } from "@/components/shared/gold-shimmer-text";
import { RiskBadge } from "@/components/shared/risk-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { CategoryIcon } from "@/components/shared/category-icon";
import { MapPreview } from "@/components/shared/map-preview";
import { EmptyState } from "@/components/shared/empty-state";
import { Loading, LoadingSpinner } from "@/components/shared/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REPORT_STATUSES,
  RISK_LEVELS,
  getCategory,
  type RiskLevelKey,
  type ReportStatusKey,
} from "@/lib/constants";
import { timeAgo, slaTimeRemaining } from "@/lib/report-helpers";
import { apiFetch, apiUpload, ApiError } from "@/lib/api-client";

// ─── Types ─────────────────────────────────────────────────────────────────

interface ProgressNote {
  id: string;
  note: string;
  type: string;
  createdAt: string;
  authorName: string | null;
}

interface ReportDetail {
  id: string;
  ticketNumber: string;
  isAnonymous: boolean;
  reporterName: string;
  reporterPhone: string | null;
  reporterNik: string | null;
  reporterBirthPlace: string | null;
  reporterBirthDate: string | null;
  reporterAddress: string | null;
  category: string;
  subCategory: string | null;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  kabupaten: string;
  photos: string[];
  photosAfter: string[];
  status: string;
  riskLevel: string | null;
  assignedBidangId: string | null;
  assignedBidangName: string | null;
  slaDeadline: string | null;
  createdAt: string;
  progressNotes?: ProgressNote[];
}

interface BidangRow {
  id: string;
  code: string;
  name: string;
  description: string;
  handles: string[];
}

interface AiSuggestion {
  suggestedRiskLevel: RiskLevelKey;
  suggestedBidang: string; // bidang code
  suggestedPasal: string[];
  reasoning: string;
  source: "ai" | "heuristic";
}

// ─── Note type → icon/color map ────────────────────────────────────────────

const NOTE_TYPE_META: Record<
  string,
  { icon: React.ElementType; color: string; label: string }
> = {
  PROGRESS: { icon: MessageCircle, color: "#3b82f6", label: "Progress" },
  VERIFY: { icon: Search, color: "#a855f7", label: "Verifikasi" },
  ASSIGN: { icon: Send, color: "#0d47a1", label: "Penugasan" },
  STATUS: { icon: RefreshCw, color: "#f9a825", label: "Status" },
  ESCALATE: { icon: AlertTriangle, color: "#ef4444", label: "Eskalasi" },
};

function noteTypeMeta(type: string) {
  return (
    NOTE_TYPE_META[type.toUpperCase()] ?? {
      icon: MessageCircle,
      color: "#3b82f6",
      label: type,
    }
  );
}

// ─── View ──────────────────────────────────────────────────────────────────

export function OperatorDetailView() {
  const selectedReportId = useAppStore((s) => s.selectedReportId);
  const setView = useAppStore((s) => s.setView);
  const openReport = useAppStore((s) => s.openReport);

  const [report, setReport] = React.useState<ReportDetail | null>(null);
  const [bidangs, setBidangs] = React.useState<BidangRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [sessionExpired, setSessionExpired] = React.useState(false);

  // Form state
  const [riskLevel, setRiskLevel] = React.useState<string>("");
  const [bidangId, setBidangId] = React.useState<string>("");
  const [subCategory, setSubCategory] = React.useState<string>("");
  const [verifyBusy, setVerifyBusy] = React.useState(false);

  // Status update state
  const [newStatus, setNewStatus] = React.useState<string>("DITERIMA");
  const [progressNote, setProgressNote] = React.useState("");
  const [statusBusy, setStatusBusy] = React.useState(false);

  // Photo after upload state
  const [photoBusy, setPhotoBusy] = React.useState(false);

  // AI suggestion state
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiResult, setAiResult] = React.useState<AiSuggestion | null>(null);

  // Photo dialog (enlarge)
  const [photoDialogUrl, setPhotoDialogUrl] = React.useState<string | null>(null);

  // ─── Fetch report + bidangs ───
  const fetchReport = React.useCallback(async () => {
    if (!selectedReportId) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const res = await apiFetch<{ report: ReportDetail }>(
        `/api/reports/${encodeURIComponent(selectedReportId)}`
      );
      setReport(res.report);
      setRiskLevel(res.report.riskLevel ?? "");
      setBidangId(res.report.assignedBidangId ?? "");
      setSubCategory(res.report.subCategory ?? "");
      setNewStatus(res.report.status);
      setSessionExpired(false);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setSessionExpired(true);
        } else if (err.status === 404) {
          setNotFound(true);
        } else {
          setError(err.message);
        }
      } else {
        setError("Gagal memuat laporan");
      }
    } finally {
      setLoading(false);
    }
  }, [selectedReportId]);

  // Initial fetch of bidangs list (one-time)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<{ bidangs: BidangRow[] }>("/api/bidangs");
        if (!cancelled) setBidangs(res.bidangs);
      } catch {
        // ignore — select will be empty but verify still works once user picks
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  // ─── Mutations ───

  // PATCH helper — sends JSON body, updates local `report` state with response
  async function patchReport(body: Record<string, unknown>) {
    if (!report) return null;
    try {
      const res = await apiFetch<{ report: ReportDetail }>(
        `/api/reports/${encodeURIComponent(report.id)}`,
        { method: "PATCH", body: JSON.stringify(body) }
      );
      setReport(res.report);
      setRiskLevel(res.report.riskLevel ?? "");
      setBidangId(res.report.assignedBidangId ?? "");
      setSubCategory(res.report.subCategory ?? "");
      setNewStatus(res.report.status);
      return res.report;
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setSessionExpired(true);
          toast.error("Sesi berakhir, silakan masuk lagi");
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error("Gagal memperbarui laporan");
      }
      return null;
    }
  }

  // ─── Verify & forward ───
  async function handleVerifyAndForward() {
    if (!report) return;
    if (!riskLevel) {
      toast.error("Pilih tingkat risiko terlebih dahulu");
      return;
    }
    if (!bidangId) {
      toast.error("Pilih Bidang tujuan terlebih dahulu");
      return;
    }
    setVerifyBusy(true);
    const bidangName =
      bidangs.find((b) => b.id === bidangId)?.name ?? "Bidang terkait";
    const updated = await patchReport({
      status: "DIPROSES",
      riskLevel,
      assignedBidangId: bidangId,
      subCategory: subCategory.trim(),
      progressNote: `Laporan diverifikasi & diteruskan ke ${bidangName}.`,
      progressNoteType: "ASSIGN",
    });
    setVerifyBusy(false);
    if (updated) {
      toast.success(`Laporan ${updated.ticketNumber} diverifikasi & diteruskan`);
    }
  }

  // ─── Status update ───
  async function handleStatusUpdate() {
    if (!report) return;
    if (!newStatus) {
      toast.error("Pilih status terlebih dahulu");
      return;
    }
    setStatusBusy(true);
    const updated = await patchReport({
      status: newStatus,
      progressNote: progressNote.trim() || undefined,
      progressNoteType: "STATUS",
    });
    setStatusBusy(false);
    if (updated) {
      toast.success(`Status diperbarui: ${REPORT_STATUSES[newStatus as ReportStatusKey]?.label ?? newStatus}`);
      setProgressNote("");
    }
  }

  // ─── Photo upload (penanganan) ───
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!report) return;
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input value so picking the same file again re-fires onChange
    e.target.value = "";

    // Client-side size guard (max 1MB for images)
    const MAX = 1 * 1024 * 1024;
    if (file.size > MAX) {
      toast.error(`Ukuran file melebihi batas 1MB (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error(`Tipe file tidak didukung: ${file.type}`);
      return;
    }

    setPhotoBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await apiUpload<{ url: string }>("/api/reports/upload", fd);
      const updated = await patchReport({
        photosAfter: [up.url],
        progressNote: `Foto penanganan ditambahkan: ${up.url.split("/").pop()}`,
        progressNoteType: "PROGRESS",
      });
      if (updated) {
        toast.success("Foto penanganan diunggah");
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Gagal mengunggah foto");
    } finally {
      setPhotoBusy(false);
    }
  }

  // ─── AI suggestion ───
  async function handleAnalyze() {
    if (!report) return;
    setAiBusy(true);
    setAiResult(null);
    try {
      const res = await apiFetch<AiSuggestion>("/api/ai/analyze-report", {
        method: "POST",
        body: JSON.stringify({
          description: report.description,
          category: report.category,
          address: report.address,
          kabupaten: report.kabupaten,
        }),
      });
      setAiResult(res);
      toast.success(res.source === "ai" ? "Saran AI siap" : "Saran heuristik siap");
    } catch (err: unknown) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Gagal menganalisis laporan");
    } finally {
      setAiBusy(false);
    }
  }

  function applyAiRisk() {
    if (!aiResult) return;
    setRiskLevel(aiResult.suggestedRiskLevel);
    toast.success(`Risiko diatur ke ${RISK_LEVELS[aiResult.suggestedRiskLevel]?.label}`);
  }

  function applyAiBidang() {
    if (!aiResult) return;
    const match = bidangs.find((b) => b.code === aiResult.suggestedBidang);
    if (!match) {
      toast.error(`Bidang ${aiResult.suggestedBidang} tidak ditemukan`);
      return;
    }
    setBidangId(match.id);
    toast.success(`Bidang diatur ke ${match.name}`);
  }

  // ─── Critical escalation (1-click) ───
  async function handleEscalateCritical() {
    if (!report) return;
    const confirmed = window.confirm(
      "Eskalasi laporan CRITICAL ke Kasatpol PP?\nStatus akan diatur ke DIPROSES + catatan eskalasi otomatis."
    );
    if (!confirmed) return;
    setVerifyBusy(true);
    const updated = await patchReport({
      status: "DIPROSES",
      riskLevel: "CRITICAL",
      progressNote:
        "ESKALASI: Laporan Critical diteruskan ke Kasatpol PP untuk penanganan segera.",
      progressNoteType: "ESCALATE",
    });
    setVerifyBusy(false);
    if (updated) {
      toast.success("Laporan dieskalasi ke Kasatpol PP");
    }
  }

  // ─── Render guards ───

  if (!selectedReportId) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="pb-6"
      >
        <EmptyState
          icon={Search}
          title="Pilih laporan dari inbox"
          description="Belum ada laporan yang dipilih. Buka inbox untuk memilih laporan yang akan diverifikasi."
          action={{ label: "Buka Inbox", onClick: () => setView("operator-inbox") }}
        />
      </motion.div>
    );
  }

  if (sessionExpired) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="pb-6"
      >
        <EmptyState
          icon={Clock}
          title="Sesi berakhir"
          description="Sesi login Anda sudah berakhir. Silakan masuk kembali untuk melanjutkan."
          action={{ label: "Masuk lagi", onClick: () => setView("login") }}
        />
      </motion.div>
    );
  }

  if (notFound) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="pb-6"
      >
        <EmptyState
          icon={AlertTriangle}
          title="Laporan tidak ditemukan"
          description="Laporan mungkin sudah dihapus atau Anda tidak punya akses."
          action={{ label: "Kembali ke Inbox", onClick: () => setView("operator-inbox") }}
        />
      </motion.div>
    );
  }

  if (loading && !report) {
    return (
      <div className="pb-6">
        <Loading label="Memuat laporan…" />
      </div>
    );
  }

  if (error && !report) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="pb-6"
      >
        <EmptyState
          icon={AlertTriangle}
          title="Gagal memuat laporan"
          description={error}
          action={{ label: "Coba lagi", onClick: () => void fetchReport() }}
        />
      </motion.div>
    );
  }

  if (!report) {
    return null;
  }

  const category = getCategory(report.category);
  const sla = slaTimeRemaining(report.slaDeadline);

  // SLA preview when operator is changing the risk
  let slaPreviewMs: number | null = null;
  let slaPreviewLabel = "";
  if (riskLevel && RISK_LEVELS[riskLevel as RiskLevelKey]) {
    const slaHours = RISK_LEVELS[riskLevel as RiskLevelKey].slaHours;
    const created = new Date(report.createdAt).getTime();
    const deadline = created + slaHours * 60 * 60 * 1000;
    slaPreviewMs = deadline - Date.now();
    if (slaPreviewMs <= 0) {
      slaPreviewLabel = `Overdue ${Math.abs(Math.round(slaPreviewMs / 60000))}m`;
    } else {
      const hr = Math.floor(slaPreviewMs / (60 * 60 * 1000));
      const min = Math.floor((slaPreviewMs % (60 * 60 * 1000)) / 60000);
      slaPreviewLabel = hr > 0 ? `${hr}j ${min}m dari sekarang` : `${min}m dari sekarang`;
    }
  }

  const isCritical = report.riskLevel === "CRITICAL";
  const hasCoords =
    Number.isFinite(report.latitude) &&
    Number.isFinite(report.longitude) &&
    !(report.latitude === 0 && report.longitude === 0);

  // WhatsApp message preview
  const waMessage = `🚨 LAPORAN CRITICAL
Tiket: ${report.ticketNumber}
Kategori: ${category?.name ?? report.category}
Lokasi: ${report.address}
Maps: https://www.google.com/maps?q=${report.latitude},${report.longitude}
SLA: 1 jam`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="pb-6 space-y-5"
    >
      {/* ─── Back button + title ─── */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setView("operator-inbox")}
          aria-label="Kembali ke inbox"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Inbox
        </Button>
      </div>

      <div className="grid lg:grid-cols-[1fr_minmax(360px,420px)] gap-5 items-start">
        {/* ─── LEFT — main detail ─── */}
        <div className="space-y-5">
          {/* Header card */}
          <GlassCard className={`p-5 sm:p-6 space-y-4 ${isCritical ? "border-l-4 border-l-red-500 critical-pulse" : ""}`}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Nomor Tiket
                </p>
                <GoldShimmerText as="span" className="text-2xl sm:text-3xl font-mono">
                  {report.ticketNumber}
                </GoldShimmerText>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <StatusBadge status={report.status} />
                  <RiskBadge riskLevel={report.riskLevel} />
                </div>
              </div>
              <div className="flex flex-col gap-1 sm:items-end text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  Diterima {timeAgo(report.createdAt)}
                </span>
                {report.slaDeadline ? (
                  <span
                    className={`inline-flex items-center gap-1.5 ${
                      sla.overdue ? "text-destructive font-semibold" : ""
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    SLA: {sla.overdue ? "Terlewat " : ""}
                    {sla.label}
                  </span>
                ) : null}
                {report.assignedBidangName ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5" aria-hidden />
                    {report.assignedBidangName}
                  </span>
                ) : null}
              </div>
            </div>
          </GlassCard>

          {/* Pelapor info */}
          <GlassCard className="p-5 sm:p-6 space-y-3">
            <h2 className="text-base font-bold tracking-tight inline-flex items-center gap-2">
              <UserRound className="h-4 w-4 text-jabar-gold" aria-hidden />
              Informasi Pelapor
            </h2>
            {report.isAnonymous ? (
              <p className="text-sm text-muted-foreground italic">
                Pelapor memilih anonim — identitas tersembunyi dari publik. Detail
                berikut tetap terlihat oleh petugas/operator untuk verifikasi.
              </p>
            ) : null}
            <dl className="grid sm:grid-cols-2 gap-3 text-sm">
              <PelaporRow
                icon={<UserRound className="h-3.5 w-3.5" aria-hidden />}
                label="Nama"
                value={report.reporterName || "-"}
              />
              <PelaporRow
                icon={<Phone className="h-3.5 w-3.5" aria-hidden />}
                label="No. HP"
                value={report.reporterPhone ?? "-"}
              />
              <PelaporRow
                icon={<IdCard className="h-3.5 w-3.5" aria-hidden />}
                label="NIK"
                value={report.reporterNik ?? "-"}
              />
              <PelaporRow
                icon={<Cake className="h-3.5 w-3.5" aria-hidden />}
                label="Tempat/Tgl Lahir"
                value={
                  [report.reporterBirthPlace, report.reporterBirthDate]
                    .filter(Boolean)
                    .join(", ") || "-"
                }
              />
              <div className="sm:col-span-2">
                <PelaporRow
                  icon={<Home className="h-3.5 w-3.5" aria-hidden />}
                  label="Alamat"
                  value={report.reporterAddress ?? "-"}
                />
              </div>
            </dl>
          </GlassCard>

          {/* Detail */}
          <GlassCard className="p-5 sm:p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Kategori
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-jabar-gold/15 text-jabar-gold">
                    <CategoryIcon code={report.category} />
                  </div>
                  <div>
                    <p className="text-sm font-bold leading-tight">
                      {category?.name ?? report.category}
                    </p>
                    {report.subCategory ? (
                      <p className="text-xs text-muted-foreground">
                        {report.subCategory}
                      </p>
                    ) : null}
                  </div>
                </div>
                {category?.perdaRef ? (
                  <p className="text-xs text-muted-foreground pl-10">
                    Acuan: {category.perdaRef}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Alamat Kejadian
                </p>
                <p className="text-sm leading-snug">{report.address}</p>
                <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" aria-hidden />
                  {report.kabupaten}
                </p>
              </div>
            </div>
            <div className="space-y-1 pt-2 border-t border-border/60">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Deskripsi
              </p>
              <p className="text-sm leading-relaxed text-foreground/90">
                {report.description}
              </p>
            </div>
            {hasCoords ? (
              <div className="pt-2 border-t border-border/60">
                <MapPreview
                  latitude={report.latitude}
                  longitude={report.longitude}
                />
              </div>
            ) : null}
          </GlassCard>

          {/* Bukti foto */}
          <GlassCard className="p-5 sm:p-6 space-y-3">
            <h2 className="text-base font-bold tracking-tight inline-flex items-center gap-2">
              <Camera className="h-4 w-4 text-jabar-gold" aria-hidden />
              Bukti Foto
            </h2>
            {report.photos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tidak ada foto bukti dilampirkan pelapor.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {report.photos.map((src, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPhotoDialogUrl(src)}
                    aria-label={`Perbesar bukti foto ${i + 1}`}
                    className="aspect-square overflow-hidden rounded-lg border border-border/60 bg-background block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jabar-gold"
                  >
                    <img
                      src={src}
                      alt={`Bukti ${i + 1}`}
                      className="h-full w-full object-cover hover:opacity-80 transition"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Timeline */}
          <GlassCard className="p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-base font-bold tracking-tight inline-flex items-center gap-2">
                <Clock className="h-4 w-4 text-jabar-gold" aria-hidden />
                Riwayat Penanganan
              </h2>
              <span className="text-xs text-muted-foreground">
                {report.progressNotes?.length ?? 0} catatan
              </span>
            </div>
            {(!report.progressNotes || report.progressNotes.length === 0) ? (
              <EmptyState
                icon={MessageCircle}
                title="Belum ada catatan"
                description="Laporan baru diterima. Tindakan Anda akan tercatat di sini."
              />
            ) : (
              <ol className="relative space-y-4 before:absolute before:top-1 before:bottom-1 before:left-[15px] before:w-px before:bg-border/70">
                {report.progressNotes.map((entry, i) => {
                  const meta = noteTypeMeta(entry.type);
                  const Icon = meta.icon;
                  return (
                    <li
                      key={entry.id}
                      className="relative pl-10"
                      aria-label={`Catatan ${i + 1}: ${meta.label}`}
                    >
                      <div
                        className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: `${meta.color}1f`,
                          color: meta.color,
                          boxShadow: `0 0 0 2px ${meta.color}40 inset`,
                        }}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="text-[10px] font-bold uppercase tracking-wide"
                            style={{ color: meta.color }}
                          >
                            {meta.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {timeAgo(entry.createdAt)}
                          </span>
                          {entry.authorName ? (
                            <span className="text-xs text-muted-foreground">
                              · {entry.authorName}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-foreground leading-snug whitespace-pre-wrap">
                          {entry.note}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </GlassCard>
        </div>

        {/* ─── RIGHT — actions panel (sticky on desktop) ─── */}
        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          {/* AI Suggestion */}
          <GlassCard className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold tracking-tight inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-jabar-gold" aria-hidden />
                Saran AI
              </h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAnalyze}
                disabled={aiBusy}
              >
                {aiBusy ? (
                  <LoadingSpinner className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden />
                )}
                Analisis
              </Button>
            </div>
            {aiResult ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="space-y-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Risiko:</span>
                  <RiskBadge riskLevel={aiResult.suggestedRiskLevel} />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={applyAiRisk}
                  >
                    Terap
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Bidang:</span>
                  <Badge variant="outline" className="text-foreground">
                    {bidangs.find((b) => b.code === aiResult.suggestedBidang)?.name ??
                      aiResult.suggestedBidang}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={applyAiBidang}
                  >
                    Terap
                  </Button>
                </div>
                {aiResult.suggestedPasal.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Pasal/usulan:</p>
                    <ul className="list-disc pl-5 space-y-0.5 text-xs">
                      {aiResult.suggestedPasal.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Alasan:</p>
                  <p className="text-xs leading-relaxed text-foreground/80">
                    {aiResult.reasoning}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    aiResult.source === "ai"
                      ? "text-jabar-gold border-jabar-gold"
                      : "text-muted-foreground"
                  }
                >
                  {aiResult.source === "ai" ? "AI" : "Heuristic"}
                </Badge>
              </motion.div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Klik <strong>Analisis</strong> untuk meminta saran risiko, Bidang,
                dan pasal dari AI (atau heuristik bila AI gagal).
              </p>
            )}
          </GlassCard>

          {/* Verify + assign form */}
          <GlassCard className="p-4 sm:p-5 space-y-4">
            <h2 className="text-sm font-bold tracking-tight inline-flex items-center gap-2">
              <Search className="h-4 w-4 text-jabar-gold" aria-hidden />
              Verifikasi &amp; Penugasan
            </h2>
            <div className="space-y-2">
              <Label htmlFor="risk-select" className="text-xs">
                Tingkat Risiko
              </Label>
              <Select value={riskLevel} onValueChange={setRiskLevel}>
                <SelectTrigger id="risk-select" className="w-full">
                  <SelectValue placeholder="Pilih risiko" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(RISK_LEVELS) as RiskLevelKey[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {RISK_LEVELS[k].emoji} {RISK_LEVELS[k].label} · SLA{" "}
                      {RISK_LEVELS[k].slaHours}j
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {slaPreviewLabel ? (
                <p
                  className={`text-xs ${
                    slaPreviewMs && slaPreviewMs <= 0
                      ? "text-destructive font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  SLA: {slaPreviewLabel}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bidang-select" className="text-xs">
                Assign ke Bidang
              </Label>
              <Select value={bidangId} onValueChange={setBidangId}>
                <SelectTrigger id="bidang-select" className="w-full">
                  <SelectValue
                    placeholder={
                      bidangs.length === 0
                        ? "Memuat Bidang…"
                        : "Pilih Bidang tujuan"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {bidangs.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subcat-input" className="text-xs">
                Sub-kategori (opsional)
              </Label>
              <Input
                id="subcat-input"
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                placeholder="Contoh: PKL liar di trotoar"
              />
            </div>
            <Button
              type="button"
              className="w-full bg-jabar-gold text-background hover:bg-jabar-gold/90 font-bold"
              onClick={handleVerifyAndForward}
              disabled={verifyBusy}
            >
              {verifyBusy ? (
                <LoadingSpinner className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
              Verifikasi &amp; Teruskan
            </Button>
          </GlassCard>

          {/* Critical escalation */}
          {isCritical ? (
            <Alert variant="destructive" className="space-y-2">
              <ShieldAlert className="h-4 w-4" aria-hidden />
              <AlertTitle>Laporan Critical — eskalasi ke Kasatpol PP?</AlertTitle>
              <AlertDescription className="space-y-2">
                <p className="text-xs">
                  SLA Critical = 1 jam. Eskalasi 1-klik akan menandai laporan
                  sebagai DIPROSES + mencatat eskalasi otomatis, dan menyiapkan
                  pesan WhatsApp untuk Kasatpol PP.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={handleEscalateCritical}
                    disabled={verifyBusy}
                  >
                    {verifyBusy ? (
                      <LoadingSpinner className="h-4 w-4" />
                    ) : (
                      <Send className="h-4 w-4" aria-hidden />
                    )}
                    Eskalasi 1-Klik
                  </Button>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold hover:bg-accent"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    Buka WhatsApp
                  </a>
                </div>
                <div className="pt-1">
                  <Label htmlFor="wa-preview" className="text-[10px] uppercase tracking-wide">
                    Preview pesan WhatsApp
                  </Label>
                  <Textarea
                    id="wa-preview"
                    readOnly
                    value={waMessage}
                    className="mt-1 font-mono text-[11px] min-h-24 bg-background/60"
                  />
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          {/* Update status section */}
          <GlassCard className="p-4 sm:p-5 space-y-4">
            <h2 className="text-sm font-bold tracking-tight inline-flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-jabar-gold" aria-hidden />
              Update Status
            </h2>
            <div className="space-y-2">
              <Label htmlFor="status-select" className="text-xs">
                Status
              </Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger id="status-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(REPORT_STATUSES) as ReportStatusKey[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {REPORT_STATUSES[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note-input" className="text-xs">
                Catatan Progress
              </Label>
              <Textarea
                id="note-input"
                value={progressNote}
                onChange={(e) => setProgressNote(e.target.value)}
                placeholder="Contoh: Tim sudah diberangkatkan ke lokasi."
                className="min-h-20"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleStatusUpdate}
              disabled={statusBusy}
            >
              {statusBusy ? (
                <LoadingSpinner className="h-4 w-4" />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden />
              )}
              Update Status
            </Button>

            {/* Photo after upload */}
            <div className="pt-3 border-t border-border/60 space-y-3">
              <Label htmlFor="photo-after-input" className="text-xs inline-flex items-center gap-2">
                <Camera className="h-3.5 w-3.5" aria-hidden />
                Foto Penanganan (Sebelum/Sesudah)
              </Label>
              <p className="text-xs text-muted-foreground">
                Format JPG/PNG/WebP, maks 1MB. Akan ditambahkan ke galeri penanganan.
              </p>
              <input
                id="photo-after-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoUpload}
                disabled={photoBusy}
                className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-jabar-gold/15 file:px-3 file:py-1.5 file:text-jabar-gold file:font-semibold hover:file:bg-jabar-gold/25 file:cursor-pointer"
              />
              {photoBusy ? (
                <p className="text-xs inline-flex items-center gap-1.5 text-muted-foreground">
                  <LoadingSpinner className="h-3.5 w-3.5" />
                  Mengunggah…
                </p>
              ) : null}
              {report.photosAfter.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {report.photosAfter.map((src, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPhotoDialogUrl(src)}
                      aria-label={`Perbesar foto penanganan ${i + 1}`}
                      className="aspect-square overflow-hidden rounded-md border border-border/60 bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jabar-gold"
                    >
                      <img
                        src={src}
                        alt={`Penanganan ${i + 1}`}
                        className="h-full w-full object-cover hover:opacity-80 transition"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                  <ImageOff className="h-3.5 w-3.5" aria-hidden />
                  Belum ada foto penanganan.
                </p>
              )}
            </div>
          </GlassCard>
        </aside>
      </div>

      {/* ─── Photo dialog (enlarge) ─── */}
      <Dialog
        open={!!photoDialogUrl}
        onOpenChange={(o) => !o && setPhotoDialogUrl(null)}
      >
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">Foto bukti</DialogTitle>
          <DialogDescription className="sr-only">
            Tampilan foto bukti dalam ukuran penuh.
          </DialogDescription>
          {photoDialogUrl ? (
            <img
              src={photoDialogUrl}
              alt="Foto bukti"
              className="w-full h-auto max-h-[80vh] object-contain bg-background"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ─── Sub: PelaporRow ───────────────────────────────────────────────────────

function PelaporRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">
        {icon}
        {label}
      </dt>
      <dd className="text-sm text-foreground break-words">{value}</dd>
    </div>
  );
}
