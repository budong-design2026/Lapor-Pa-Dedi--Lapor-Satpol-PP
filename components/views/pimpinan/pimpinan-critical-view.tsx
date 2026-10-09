"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Timer,
  ChevronRight,
  ShieldAlert,
  UserRound,
  ExternalLink,
  MessageCircle,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/app-store";
import { GlassCard } from "@/components/shared/glass-card";
import { GoldShimmerText } from "@/components/shared/gold-shimmer-text";
import { RiskBadge } from "@/components/shared/risk-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { CategoryIcon } from "@/components/shared/category-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { RowSkeleton } from "@/components/shared/loading";
import { LoadingSpinner } from "@/components/shared/loading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCategory } from "@/lib/constants";
import { timeAgo } from "@/lib/report-helpers";
import { apiFetch, ApiError } from "@/lib/api-client";

// ─── Types (mirror of /api/pimpinan/critical response) ─────────────────────

interface CriticalReport {
  id: string;
  ticketNumber: string;
  category: string;
  description: string;
  address: string;
  kabupaten: string;
  status: string;
  slaRemaining: { ms: number; label: string; overdue: boolean };
  assignedBidangId: string | null;
  assignedBidangName: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  createdAt: string;
  slaDeadline: string | null;
  isAnonymous?: boolean;
  reporterName?: string;
}

interface CriticalResponse {
  reports: CriticalReport[];
  total: number;
}

interface BidangRow {
  id: string;
  code: string;
  name: string;
  description: string;
  handles: string[];
}

const POLL_INTERVAL_MS = 20_000; // 20 seconds

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtSlaLabel(sla: { ms: number; label: string; overdue: boolean } | undefined): string {
  if (!sla) return "-";
  if (sla.overdue) {
    const min = Math.max(1, Math.floor(Math.abs(sla.ms) / (60 * 1000)));
    return `Overdue ${min}m`;
  }
  return sla.label;
}

function slaTone(sla: CriticalReport["slaRemaining"]): "red" | "amber" | "green" {
  if (!sla) return "green";
  if (sla.overdue) return "red";
  if (sla.ms < 15 * 60 * 1000) return "amber";
  return "green";
}

function slaColorClass(tone: "red" | "amber" | "green"): string {
  switch (tone) {
    case "red":
      return "text-red-500";
    case "amber":
      return "text-amber-500";
    case "green":
      return "text-green-500";
  }
}

function slaBgClass(tone: "red" | "amber" | "green"): string {
  switch (tone) {
    case "red":
      return "bg-red-500/10 border-red-500/40";
    case "amber":
      return "bg-amber-500/10 border-amber-500/40";
    case "green":
      return "bg-green-500/10 border-green-500/40";
  }
}

function buildWhatsAppUrl(r: CriticalReport): string {
  const cat = getCategory(r.category);
  const catName = cat?.name ?? r.category;
  const fullAddress = `${r.address}, ${r.kabupaten}`;
  const mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}`;
  const lines = [
    "🚨 LAPORAN CRITICAL — YEUH SATPOL!",
    `Tiket : ${r.ticketNumber}`,
    `Kategori : ${catName}`,
    `Lokasi : ${fullAddress}`,
    `Maps : ${mapsUrl}`,
    `SLA : 1 jam (sejak ${new Date(r.createdAt).toLocaleString("id-ID")})`,
    `Detail : ${typeof window !== "undefined" ? window.location.origin : ""}/?track=${encodeURIComponent(r.ticketNumber)}`,
  ];
  return `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
}

// ─── View ──────────────────────────────────────────────────────────────────

export function PimpinanCriticalView() {
  const openReport = useAppStore((s) => s.openReport);
  const setView = useAppStore((s) => s.setView);
  const user = useAppStore((s) => s.user);

  const [reports, setReports] = React.useState<CriticalReport[]>([]);
  const [total, setTotal] = React.useState(0);
  const [bidangs, setBidangs] = React.useState<BidangRow[]>([]);
  const [bidangFilter, setBidangFilter] = React.useState<string>("all");
  const [onlyOverdue, setOnlyOverdue] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [sessionExpired, setSessionExpired] = React.useState(false);
  const [approvingId, setApprovingId] = React.useState<string | null>(null);

  const isKabid = user?.role === "PIMPINAN_KABID";

  // Fetch bidangs once (for the filter select)
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch<{ bidangs: BidangRow[] }>("/api/bidangs");
        if (alive) setBidangs(res.bidangs);
      } catch {
        // ignore — filter just won't populate; pimpinan can still see reports
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Stable fetch function (no closure deps on state) so polling effect
  // does not re-subscribe every time the filter changes.
  const fetchCritical = React.useCallback(
    async (opts?: { silent?: boolean; filter?: string }) => {
      if (!opts?.silent) setRefreshing(true);
      setError(null);
      try {
        const filterValue = opts?.filter ?? bidangFilter;
        const params = new URLSearchParams();
        if (filterValue && filterValue !== "all") {
          params.set("bidang", filterValue);
        }
        const url = `/api/pimpinan/critical${params.toString() ? `?${params.toString()}` : ""}`;
        const res = await apiFetch<CriticalResponse>(url);
        setReports(res.reports);
        setTotal(res.total);
        setLastUpdated(new Date());
        setSessionExpired(false);
      } catch (err: unknown) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setSessionExpired(true);
          if (!opts?.silent) toast.error("Sesi berakhir, silakan masuk lagi");
        } else {
          const msg = err instanceof ApiError ? err.message : "Gagal memuat laporan critical";
          setError(msg);
          if (!opts?.silent) toast.error(msg);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [bidangFilter]
  );

  // Initial fetch + re-fetch on filter change
  React.useEffect(() => {
    setLoading(true);
    void fetchCritical();
  }, [bidangFilter, fetchCritical]);

  // Polling: 20s silent refresh
  React.useEffect(() => {
    const id = setInterval(() => {
      void fetchCritical({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchCritical]);

  function handleRefresh() {
    void fetchCritical();
  }

  async function handleApprove(id: string, ticket: string) {
    setApprovingId(id);
    try {
      await apiFetch(`/api/pimpinan/approve/${encodeURIComponent(id)}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      toast.success(`Eskalasi ${ticket} disetujui. Penanganan segera dimulai.`);
      // Refetch silently to refresh the list (the report stays critical until
      // status moves to SELESAI/DITOLAK).
      await fetchCritical({ silent: true });
    } catch (err: unknown) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setSessionExpired(true);
        toast.error("Sesi berakhir, silakan masuk lagi");
      } else {
        const msg = err instanceof ApiError ? err.message : "Gagal menyetujui eskalasi";
        toast.error(msg);
      }
    } finally {
      setApprovingId(null);
    }
  }

  // ─── Session expired ───
  if (sessionExpired) {
    return (
      <EmptyState
        icon={Clock}
        title="Sesi berakhir"
        description="Sesi login Anda sudah berakhir. Silakan masuk kembali untuk membuka Critical Alert Panel."
        action={{ label: "Masuk lagi", onClick: () => setView("login") }}
      />
    );
  }

  // Apply "only overdue" client-side filter (the backend doesn't support it).
  const visibleReports = onlyOverdue
    ? reports.filter((r) => r.slaRemaining?.overdue)
    : reports;

  const overdueCount = reports.filter((r) => r.slaRemaining?.overdue).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="pb-6 space-y-5"
    >
      {/* ─── Header ─── */}
      <header className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
              <span aria-hidden>🔴</span>
              <GoldShimmerText as="span">Critical Alert Panel</GoldShimmerText>
            </h1>
            <p className="text-sm text-muted-foreground">
              Laporan CRITICAL aktif di seluruh Jabar — SLA 1 jam per laporan.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Segarkan daftar critical"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              aria-hidden
            />
            Segarkan
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-red-500 border-red-500/40 bg-red-500/10">
            {total} Critical Aktif
          </Badge>
          <Badge variant="outline" className="text-amber-500 border-amber-500/40 bg-amber-500/10">
            {overdueCount} Overdue
          </Badge>
          {lastUpdated ? (
            <span className="inline-flex items-center gap-1.5 ml-auto">
              <Clock className="h-3 w-3" aria-hidden />
              Terakhir diperbarui:{" "}
              <time dateTime={lastUpdated.toISOString()}>
                {timeAgo(lastUpdated)}
              </time>{" "}
              <span className="text-muted-foreground/70">(otomatis 20 detik)</span>
            </span>
          ) : null}
        </div>
      </header>

      {/* ─── Filters ─── */}
      <GlassCard className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <label
              htmlFor="bidang-filter"
              className="block text-[11px] uppercase tracking-wide text-muted-foreground mb-1"
            >
              Filter Bidang
            </label>
            {isKabid ? (
              <p className="text-sm text-muted-foreground italic">
                Otomatis dibatasi ke Bidang Anda ({user?.bidangName ?? "-"}).
              </p>
            ) : (
              <Select
                value={bidangFilter}
                onValueChange={(v) => setBidangFilter(v)}
                disabled={bidangs.length === 0}
              >
                <SelectTrigger id="bidang-filter" className="w-full">
                  <SelectValue placeholder={
                    bidangs.length === 0 ? "Memuat Bidang…" : "Semua Bidang"
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Bidang</SelectItem>
                  {bidangs.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-center gap-2 sm:mt-4">
            <Switch
              id="overdue-only"
              checked={onlyOverdue}
              onCheckedChange={setOnlyOverdue}
              aria-label="Hanya tampilkan laporan overdue"
            />
            <label
              htmlFor="overdue-only"
              className="text-sm font-medium cursor-pointer select-none"
            >
              Hanya Overdue
            </label>
          </div>
        </div>
      </GlassCard>

      {/* ─── Report cards ─── */}
      {loading && reports.length === 0 ? (
        <RowSkeleton count={3} />
      ) : error && reports.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="Gagal memuat laporan critical"
          description={error}
          action={{ label: "Coba lagi", onClick: handleRefresh }}
        />
      ) : visibleReports.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Tidak ada laporan critical aktif 🎉"
          description={
            onlyOverdue
              ? "Tidak ada laporan overdue. Anda dapat mematikan filter untuk melihat semua laporan critical aktif."
              : "Semua laporan critical telah ditangani atau selesai. Pantau terus panel ini setiap 20 detik."
          }
          action={
            onlyOverdue
              ? {
                  label: "Tampilkan semua",
                  onClick: () => setOnlyOverdue(false),
                }
              : undefined
          }
        />
      ) : (
        <ul aria-label="Daftar laporan critical aktif" className="space-y-3">
          {visibleReports.map((r) => (
            <CriticalCard
              key={r.id}
              report={r}
              onOpen={() => openReport(r.id)}
              onApprove={() => handleApprove(r.id, r.ticketNumber)}
              approving={approvingId === r.id}
            />
          ))}
        </ul>
      )}
    </motion.div>
  );
}

// ─── Critical card sub-component ───────────────────────────────────────────

function CriticalCard({
  report,
  onOpen,
  onApprove,
  approving,
}: {
  report: CriticalReport;
  onOpen: () => void;
  onApprove: () => void;
  approving: boolean;
}) {
  const cat = getCategory(report.category);
  const catName = cat?.name ?? report.category;
  const slaToneVal = slaTone(report.slaRemaining);
  const waUrl = buildWhatsAppUrl(report);

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <GlassCard className="p-0 overflow-hidden border-l-4 border-l-red-500 critical-pulse">
        <div className="p-4 sm:p-5 space-y-3">
          {/* Row 1 — ticket + badges + big SLA timer */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-jabar-gold font-bold">
                {report.ticketNumber}
              </span>
              <RiskBadge riskLevel="CRITICAL" />
              <StatusBadge status={report.status} />
            </div>
            <div
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 ${slaBgClass(slaToneVal)}`}
              aria-label={`SLA ${fmtSlaLabel(report.slaRemaining)}`}
            >
              <Timer className="h-4 w-4" aria-hidden />
              <span className={`text-base sm:text-lg font-mono font-bold ${slaColorClass(slaToneVal)}`}>
                SLA {fmtSlaLabel(report.slaRemaining)}
              </span>
            </div>
          </div>

          {/* Row 2 — category + kabupaten + address + maps link */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-foreground/90">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-jabar-gold/15 text-jabar-gold">
                <CategoryIcon code={report.category} className="h-4 w-4" />
              </span>
              {catName}
            </span>
            <span aria-hidden>•</span>
            <span>{report.kabupaten}</span>
            <span aria-hidden>•</span>
            <span className="truncate max-w-[14rem]">{report.address}</span>
            <a
              href={`https://www.google.com/maps?q=${encodeURIComponent(`${report.address}, ${report.kabupaten}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-xs text-jabar-gold hover:underline"
            >
              <ExternalLink className="h-3 w-3" aria-hidden />
              Buka Maps
            </a>
          </div>

          {/* Row 3 — description + reporter + assignee */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Deskripsi
              </p>
              <p className="text-sm text-foreground/90 line-clamp-2">
                {report.description}
              </p>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Pelapor
                </p>
                {report.isAnonymous ? (
                  <Badge variant="secondary" className="text-muted-foreground">
                    <UserRound className="h-3 w-3 mr-1" aria-hidden /> Anonim
                  </Badge>
                ) : (
                  <p className="text-sm font-medium inline-flex items-center gap-1.5">
                    <UserRound className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    {report.reporterName || "—"}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Penanggung Jawab
                </p>
                {report.assignedBidangName ? (
                  <p className="text-sm font-medium inline-flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-jabar-gold" aria-hidden />
                    {report.assignedBidangName}
                    {report.assigneeName ? ` · ${report.assigneeName}` : ""}
                  </p>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-red-500 border-red-500/40 bg-red-500/10"
                  >
                    Belum di-assign
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Row 4 — actions */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-border/60">
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={onOpen}
              className="gap-1.5"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              Tinjau Detail
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={onApprove}
              disabled={approving}
              className="gap-1.5"
            >
              {approving ? (
                <LoadingSpinner className="h-3.5 w-3.5" />
              ) : (
                <Send className="h-3.5 w-3.5" aria-hidden />
              )}
              Approve Eskalasi
            </Button>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-green-500/50 bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-500 hover:bg-green-500/20 transition"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              Buka WhatsApp Alert
            </a>
            <p className="text-[11px] text-muted-foreground sm:ml-auto mt-2 sm:mt-0">
              Diterima {timeAgo(report.createdAt)}
            </p>
          </div>
        </div>
      </GlassCard>
    </motion.li>
  );
}
