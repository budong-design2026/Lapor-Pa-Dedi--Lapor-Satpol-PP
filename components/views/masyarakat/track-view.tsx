"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Search,
  MessageSquare,
  Send,
  RefreshCw,
  AlertTriangle,
  MapPin,
  Calendar,
  Building2,
  Clock,
  SearchX,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { GoldShimmerText } from "@/components/shared/gold-shimmer-text";
import { CategoryIcon } from "@/components/shared/category-icon";
import { StatusBadge } from "@/components/shared/status-badge";
import { RiskBadge } from "@/components/shared/risk-badge";
import { MapPreview } from "@/components/shared/map-preview";
import { EmptyState } from "@/components/shared/empty-state";
import { Loading } from "@/components/shared/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/store/app-store";
import { REPORT_STATUSES, getCategory } from "@/lib/constants";
import { timeAgo } from "@/lib/report-helpers";
import { apiFetch, ApiError } from "@/lib/api-client";

interface TrackReport {
  id: string;
  ticketNumber: string;
  category: string;
  subCategory: string | null;
  description: string;
  address: string;
  kabupaten: string;
  status: string;
  riskLevel: string | null;
  slaDeadline: string | null;
  slaRemaining: { ms: number; label: string; overdue: boolean };
  createdAt: string;
  verifiedAt: string | null;
  assignedAt: string | null;
  inProgressAt: string | null;
  resolvedAt: string | null;
  assignedBidangName: string | null;
  timeline: {
    id: string;
    note: string;
    type: string;
    createdAt: string;
    authorName: string | null;
  }[];
}

interface FullReport {
  latitude: number;
  longitude: number;
  photos: string[];
}

const PIPELINE = [
  { key: "DITERIMA", label: "Diterima" },
  { key: "DIVERIFIKASI", label: "Diverifikasi" },
  { key: "DIPROSES", label: "Diproses" },
  { key: "SELESAI", label: "Selesai" },
] as const;

const NOTE_TYPE_META: Record<
  string,
  { icon: React.ElementType; color: string; label: string }
> = {
  PROGRESS: { icon: MessageSquare, color: "#3b82f6", label: "Progress" },
  VERIFY: { icon: Search, color: "#a855f7", label: "Verifikasi" },
  ASSIGN: { icon: Send, color: "#0d47a1", label: "Penugasan" },
  STATUS: { icon: RefreshCw, color: "#f9a825", label: "Status" },
  ESCALATE: { icon: AlertTriangle, color: "#ef4444", label: "Eskalasi" },
};

function noteTypeMeta(type: string) {
  return (
    NOTE_TYPE_META[type.toUpperCase()] ?? {
      icon: MessageSquare,
      color: "#3b82f6",
      label: type,
    }
  );
}

export function TrackView() {
  const setView = useAppStore((s) => s.setView);

  const [ticket, setTicket] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [report, setReport] = React.useState<TrackReport | null>(null);
  const [extra, setExtra] = React.useState<FullReport | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const doTrack = React.useCallback(
    async (rawTicket: string) => {
      const t = rawTicket.trim().toUpperCase();
      if (!t) {
        toast.error("Masukkan nomor tiket");
        return;
      }
      setLoading(true);
      setError(null);
      setNotFound(false);
      setReport(null);
      setExtra(null);
      try {
        const res = await apiFetch<{ report: TrackReport }>(
          `/api/reports/track/${encodeURIComponent(t)}`
        );
        setReport(res.report);

        // Fetch lat/lng + photos in parallel (best-effort; may 403/404 if caller role weird)
        try {
          const full = await apiFetch<{ report: FullReport }>(
            `/api/reports/${res.report.id}`
          );
          setExtra({
            latitude: full.report.latitude,
            longitude: full.report.longitude,
            photos: full.report.photos ?? [],
          });
        } catch {
          // Ignore — MapPreview will be hidden
        }
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
          toast.error("Tiket tidak ditemukan");
        } else {
          const msg =
            err instanceof ApiError ? err.message : "Gagal melacak tiket";
          setError(msg);
          toast.error(msg);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Pre-fill from ?ticket= query param (hydration-safe)
  const initialFetched = React.useRef(false);
  React.useEffect(() => {
    if (initialFetched.current) return;
    initialFetched.current = true;
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const t = url.searchParams.get("ticket");
    if (t) {
      setTicket(t);
      void doTrack(t);
      // Clean URL (optional)
      url.searchParams.delete("ticket");
      window.history.replaceState(null, "", url.toString());
    }
  }, [doTrack]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void doTrack(ticket);
  }

  function copyTicket() {
    if (!report) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard
        .writeText(report.ticketNumber)
        .then(() => {
          setCopied(true);
          toast.success("Tiket disalin");
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => toast.error("Gagal menyalin"));
    }
  }

  // ─── Not found state ───
  if (notFound) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="pb-6 space-y-4"
      >
        <TrackSearchForm
          ticket={ticket}
          onChange={setTicket}
          onSubmit={handleSubmit}
          loading={loading}
        />
        <EmptyState
          icon={SearchX}
          title="Tiket tidak ditemukan"
          description={`Tiket "${ticket || "-"}" tidak terdaftar. Pastikan penulisan benar (format: YP-YYYYMMDD-XXXX).`}
          action={{ label: "Lapor Baru", onClick: () => setView("lapor") }}
        />
      </motion.div>
    );
  }

  // ─── Error state ───
  if (error && !report) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="pb-6 space-y-4"
      >
        <TrackSearchForm
          ticket={ticket}
          onChange={setTicket}
          onSubmit={handleSubmit}
          loading={loading}
        />
        <EmptyState
          icon={AlertTriangle}
          title="Gagal melacak"
          description={error}
          action={{
            label: "Coba lagi",
            onClick: () => void doTrack(ticket),
          }}
        />
      </motion.div>
    );
  }

  // ─── Loading ───
  if (loading && !report) {
    return (
      <div className="pb-6 space-y-4">
        <TrackSearchForm
          ticket={ticket}
          onChange={setTicket}
          onSubmit={handleSubmit}
          loading={loading}
        />
        <Loading label="Mencari tiket…" />
      </div>
    );
  }

  // ─── Result ───
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="pb-6 space-y-5"
    >
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
          <GoldShimmerText as="span">Lacak Laporan</GoldShimmerText>
        </h1>
        <p className="text-sm text-muted-foreground">
          Masukkan nomor tiket untuk melihat status &amp; riwayat.
        </p>
      </div>

      <TrackSearchForm
        ticket={ticket}
        onChange={setTicket}
        onSubmit={handleSubmit}
        loading={loading}
      />

      {report ? (
        <TrackResult
          report={report}
          extra={extra}
          copied={copied}
          onCopy={copyTicket}
        />
      ) : null}
    </motion.div>
  );
}

// ─── Search form ───

function TrackSearchForm({
  ticket,
  onChange,
  onSubmit,
  loading,
}: {
  ticket: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
}) {
  return (
    <GlassCard className="p-4 sm:p-5">
      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="ticket-input" className="sr-only">
            Nomor Tiket
          </Label>
          <Input
            id="ticket-input"
            value={ticket}
            onChange={(e) => onChange(e.target.value)}
            placeholder="YP-YYYYMMDD-XXXX"
            inputMode="text"
            autoComplete="off"
            className="font-mono uppercase"
            aria-label="Nomor tiket"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="bg-jabar-gold text-background hover:bg-jabar-gold/90 font-bold sm:w-auto"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Search className="h-4 w-4" aria-hidden />
          )}
          Lacak
        </Button>
      </form>
    </GlassCard>
  );
}

// ─── Result card ───

function TrackResult({
  report,
  extra,
  copied,
  onCopy,
}: {
  report: TrackReport;
  extra: FullReport | null;
  copied: boolean;
  onCopy: () => void;
}) {
  const category = getCategory(report.category);
  const statusStep =
    REPORT_STATUSES[report.status as keyof typeof REPORT_STATUSES]?.step ??
    -1;
  const isRejected = report.status === "DITOLAK";
  const activeStep = isRejected ? -1 : Math.max(0, statusStep);

  const photos = extra?.photos ?? [];
  const hasCoords =
    extra &&
    Number.isFinite(extra.latitude) &&
    Number.isFinite(extra.longitude) &&
    !(extra.latitude === 0 && extra.longitude === 0);

  return (
    <div className="space-y-5">
      {/* ─── Summary card ─── */}
      <GlassCard className="p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Nomor Tiket
              </p>
              <button
                type="button"
                onClick={onCopy}
                aria-label="Salin nomor tiket"
                className="text-muted-foreground hover:text-jabar-gold transition"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" aria-hidden />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            </div>
            <GoldShimmerText
              as="span"
              className="text-2xl sm:text-3xl font-mono"
            >
              {report.ticketNumber}
            </GoldShimmerText>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <StatusBadge status={report.status} />
              <RiskBadge riskLevel={report.riskLevel} />
            </div>
          </div>
          <div className="flex flex-col gap-1 sm:items-end text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" aria-hidden />
              Diterima {timeAgo(report.createdAt)}
            </span>
            {report.slaRemaining?.label ? (
              <span
                className={`inline-flex items-center gap-1.5 ${
                  report.slaRemaining.overdue
                    ? "text-destructive font-semibold"
                    : ""
                }`}
              >
                <Clock className="h-3.5 w-3.5" aria-hidden />
                SLA: {report.slaRemaining.overdue ? "Terlewat " : ""}
                {report.slaRemaining.label}
              </span>
            ) : null}
            {report.assignedBidangName ? (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" aria-hidden />
                {report.assignedBidangName}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-jabar-gold/15 text-jabar-gold">
                <CategoryIcon code={report.category} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Kategori
                </p>
                <p className="text-sm font-bold leading-tight">
                  {category?.name ?? report.category}
                </p>
              </div>
            </div>
            {report.subCategory ? (
              <p className="text-xs text-muted-foreground pl-10">
                {report.subCategory}
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

        {report.description ? (
          <div className="space-y-1 pt-2 border-t border-border/60">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Deskripsi
            </p>
            <p className="text-sm leading-relaxed text-foreground/90">
              {report.description}
            </p>
          </div>
        ) : null}

        {/* Pipeline */}
        <div className="pt-3 border-t border-border/60">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-3">
            Alur Penanganan
          </p>
          <Pipeline activeStep={activeStep} rejected={isRejected} />
        </div>

        {/* Photos */}
        {photos.length > 0 ? (
          <div className="pt-3 border-t border-border/60 space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Foto Bukti
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {photos.slice(0, 5).map((src, i) => (
                <a
                  key={i}
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square overflow-hidden rounded-lg border border-border/60 bg-background block"
                >
                  {/* shared photo URL */}
                  <img
                    src={src}
                    alt={`Bukti ${i + 1}`}
                    className="h-full w-full object-cover hover:opacity-80 transition"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          </div>
        ) : null}

        {/* Map */}
        {hasCoords && extra ? (
          <div className="pt-3 border-t border-border/60">
            <MapPreview latitude={extra.latitude} longitude={extra.longitude} />
          </div>
        ) : null}
      </GlassCard>

      {/* ─── Timeline ─── */}
      <GlassCard className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-base font-bold tracking-tight inline-flex items-center gap-2">
            <Clock className="h-4 w-4 text-jabar-gold" aria-hidden />
            Riwayat Penanganan
          </h2>
          <span className="text-xs text-muted-foreground">
            {report.timeline.length} catatan
          </span>
        </div>

        {report.timeline.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Belum ada catatan"
            description="Laporan baru diterima. Operator akan segera memverifikasi."
          />
        ) : (
          <ol className="relative space-y-4 before:absolute before:top-1 before:bottom-1 before:left-[15px] before:w-px before:bg-border/70">
            {report.timeline.map((entry, i) => {
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
                    <p className="text-sm text-foreground leading-snug">
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
  );
}

// ─── 4-step pipeline ───

function Pipeline({
  activeStep,
  rejected,
}: {
  activeStep: number;
  rejected: boolean;
}) {
  if (rejected) {
    return (
      <div
        className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2"
        role="status"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        Laporan ditolak — tidak dapat diproses lebih lanjut.
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-1">
      {PIPELINE.map((step, i) => {
        const isDone = i < activeStep;
        const isCurrent = i === activeStep;
        const isLast = i === PIPELINE.length - 1;
        const color = isCurrent
          ? "#ffd600"
          : isDone
          ? "#22c55e"
          : "#6b7280";
        return (
          <div
            key={step.key}
            className="flex items-center gap-1 flex-1 last:flex-none"
          >
            <div className="flex flex-col items-center gap-1.5 min-w-0 flex-1">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shrink-0"
                style={{
                  backgroundColor: `${color}1f`,
                  color,
                  boxShadow: isCurrent ? `0 0 0 2px ${color}55 inset` : "none",
                }}
                aria-label={`Langkah ${i + 1}: ${step.label}${
                  isCurrent ? " (aktif)" : isDone ? " (selesai)" : " (belum)"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
              </div>
              <span
                className="text-[10px] sm:text-xs text-center font-medium truncate w-full"
                style={{ color: isCurrent || isDone ? color : undefined }}
              >
                {step.label}
              </span>
            </div>
            {!isLast ? (
              <div
                className="h-px flex-1 mx-1"
                style={{
                  backgroundColor: i < activeStep ? "#22c55e" : "#6b728040",
                }}
                aria-hidden
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
