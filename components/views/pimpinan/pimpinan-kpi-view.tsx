"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Clock,
  ShieldAlert,
  TrendingUp,
  Timer,
  CheckCircle2,
  Inbox,
  Activity,
  Gauge,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/app-store";
import { GlassCard } from "@/components/shared/glass-card";
import { GoldShimmerText } from "@/components/shared/gold-shimmer-text";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Loading } from "@/components/shared/loading";
import { Badge } from "@/components/ui/badge";
import { getBidang } from "@/lib/constants";
import { apiFetch, ApiError } from "@/lib/api-client";

// ─── Types (mirror of /api/pimpinan/kpi response) ──────────────────────────

interface KpiRow {
  bidangId: string;
  bidangCode: string;
  bidangName: string;
  activeReports: number;
  resolvedThisMonth: number;
  avgResponseHours: number;
  closeRate: number;
  slaCompliance: number;
}

interface KpiResponse {
  kpi: KpiRow[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtInt(n: number | null | undefined): string {
  if (n == null) return "-";
  return n.toLocaleString("id-ID");
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "-";
  return `${n}%`;
}

function fmtHours(n: number | null | undefined): string {
  if (n == null) return "-";
  if (n === 0) return "—";
  return n.toFixed(1);
}

function slaTone(pct: number): "green" | "amber" | "red" {
  if (pct >= 80) return "green";
  if (pct >= 60) return "amber";
  return "red";
}

function slaColor(pct: number): string {
  const tone = slaTone(pct);
  switch (tone) {
    case "green":
      return "#22c55e";
    case "amber":
      return "#f9a825";
    case "red":
      return "#ef4444";
  }
}

function slaLabel(pct: number): string {
  const tone = slaTone(pct);
  switch (tone) {
    case "green":
      return "Sangat Baik";
    case "amber":
      return "Perlu Perhatian";
    case "red":
      return "Kritis";
  }
}

// ─── View ──────────────────────────────────────────────────────────────────

export function PimpinanKpiView() {
  const setView = useAppStore((s) => s.setView);
  const user = useAppStore((s) => s.user);

  const [kpi, setKpi] = React.useState<KpiRow[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = React.useState(false);

  const isKabid = user?.role === "PIMPINAN_KABID";

  const fetchKpi = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<KpiResponse>("/api/pimpinan/kpi");
      setKpi(res.kpi);
      setSessionExpired(false);
    } catch (err: unknown) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setSessionExpired(true);
        toast.error("Sesi berakhir, silakan masuk lagi");
      } else {
        const msg = err instanceof ApiError ? err.message : "Gagal memuat KPI Bidang";
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchKpi();
  }, [fetchKpi]);

  // ─── Session expired ───
  if (sessionExpired) {
    return (
      <EmptyState
        icon={Clock}
        title="Sesi berakhir"
        description="Sesi login Anda sudah berakhir. Silakan masuk kembali untuk melihat KPI Bidang."
        action={{ label: "Masuk lagi", onClick: () => setView("login") }}
      />
    );
  }

  if (loading && !kpi) {
    return (
      <div className="pb-6 space-y-5">
        <Header isKabid={isKabid} bidangName={user?.bidangName} />
        <Loading label="Memuat KPI per Bidang…" />
      </div>
    );
  }

  if (error && !kpi) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Gagal memuat KPI"
        description={error}
        action={{ label: "Coba lagi", onClick: () => void fetchKpi() }}
      />
    );
  }

  if (!kpi) return null;

  // Kabid scope: only show their own bidang.
  const visibleKpi = isKabid && user?.bidangId
    ? kpi.filter((k) => k.bidangId === user.bidangId)
    : kpi;

  // Overall aggregates
  const overallAvgResponse =
    visibleKpi.length > 0
      ? visibleKpi.reduce((s, k) => s + (k.avgResponseHours ?? 0), 0) /
        visibleKpi.length
      : 0;
  const overallCloseRate =
    visibleKpi.length > 0
      ? Math.round(
          visibleKpi.reduce((s, k) => s + (k.closeRate ?? 0), 0) /
            visibleKpi.length
        )
      : 0;
  const overallSlaCompliance =
    visibleKpi.length > 0
      ? Math.round(
          visibleKpi.reduce((s, k) => s + (k.slaCompliance ?? 0), 0) /
            visibleKpi.length
        )
      : 0;
  const totalActive = visibleKpi.reduce((s, k) => s + k.activeReports, 0);
  const totalResolved = visibleKpi.reduce((s, k) => s + k.resolvedThisMonth, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="pb-6 space-y-5"
    >
      <Header isKabid={isKabid} bidangName={user?.bidangName} />

      {/* ─── Overall summary ─── */}
      <section aria-label="Ringkasan KPI agregat">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard
            label="Total Laporan Aktif"
            value={fmtInt(totalActive)}
            accent="gold"
            icon={Inbox}
          />
          <StatCard
            label="Selesai Bulan Ini"
            value={fmtInt(totalResolved)}
            accent="green"
            icon={CheckCircle2}
          />
          <StatCard
            label="Rata-rata Response"
            value={`${fmtHours(overallAvgResponse)} jam`}
            accent="blue"
            icon={Timer}
          />
          <StatCard
            label="Close Rate"
            value={fmtPct(overallCloseRate)}
            accent="amber"
            icon={Activity}
          />
          <StatCard
            label="SLA Compliance"
            value={fmtPct(overallSlaCompliance)}
            accent="green"
            icon={Gauge}
          />
        </div>
      </section>

      {/* ─── Bidang cards ─── */}
      <section aria-label="KPI per Bidang">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleKpi.map((k) => {
            const info = getBidang(k.bidangCode);
            const description = info?.description ?? "—";
            const handles = info?.handles ?? [];
            const slaColorVal = slaColor(k.slaCompliance);

            return (
              <motion.div
                key={k.bidangId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
              >
                <GlassCard className="p-4 sm:p-5 h-full flex flex-col">
                  <div className="space-y-1 mb-3">
                    <h3 className="text-base font-bold text-jabar-gold leading-tight">
                      {k.bidangName}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {description}
                    </p>
                    {handles.length > 0 ? (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {handles.slice(0, 4).map((h) => (
                          <Badge
                            key={h}
                            variant="secondary"
                            className="text-[10px] font-mono text-muted-foreground"
                          >
                            {h}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <MiniStat
                      label="Aktif"
                      value={fmtInt(k.activeReports)}
                      icon={Inbox}
                      color="#ffd600"
                    />
                    <MiniStat
                      label="Selesai Bulan Ini"
                      value={fmtInt(k.resolvedThisMonth)}
                      icon={CheckCircle2}
                      color="#22c55e"
                    />
                    <MiniStat
                      label="Avg Response"
                      value={`${fmtHours(k.avgResponseHours)}j`}
                      icon={Timer}
                      color="#0d47a1"
                    />
                    <MiniStat
                      label="Close Rate"
                      value={fmtPct(k.closeRate)}
                      icon={TrendingUp}
                      color="#f9a825"
                    />
                  </div>

                  {/* SLA Compliance progress bar */}
                  <div className="mt-auto pt-2 border-t border-border/60">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        SLA Compliance
                      </span>
                      <span
                        className="text-sm font-mono font-bold"
                        style={{ color: slaColorVal }}
                      >
                        {fmtPct(k.slaCompliance)}
                      </span>
                    </div>
                    <div
                      className="h-2 w-full rounded-full bg-white/5 overflow-hidden"
                      role="progressbar"
                      aria-valuenow={k.slaCompliance}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`SLA Compliance ${k.slaCompliance}%`}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(k.slaCompliance, 4)}%`,
                          backgroundColor: slaColorVal,
                        }}
                      />
                    </div>
                    <p
                      className="text-[11px] mt-1 font-medium"
                      style={{ color: slaColorVal }}
                    >
                      {slaLabel(k.slaCompliance)}
                    </p>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>

        {visibleKpi.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Belum ada data KPI Bidang"
            description="Belum ada laporan ter-assign ke Bidang Anda. KPI akan ter-update otomatis saat laporan mulai ditugaskan."
          />
        ) : null}
      </section>
    </motion.div>
  );
}

// ─── Header sub-component ─────────────────────────────────────────────────

function Header({
  isKabid,
  bidangName,
}: {
  isKabid: boolean;
  bidangName?: string | null;
}) {
  return (
    <header className="space-y-2">
      <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
        <GoldShimmerText as="span">KPI per Bidang</GoldShimmerText>
      </h1>
      <p className="text-sm text-muted-foreground">
        Performa masing-masing Bidang Satpol PP Provinsi Jawa Barat.
      </p>
      {isKabid && bidangName ? (
        <p className="text-xs text-jabar-gold/90 inline-flex items-center gap-1.5 bg-jabar-gold/8 border border-jabar-gold/25 rounded-md px-2 py-1">
          <ShieldAlert className="h-3 w-3" aria-hidden />
          Menampilkan KPI Bidang Anda — {bidangName}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-jabar-gold" aria-hidden />
          Menampilkan KPI seluruh 5 Bidang.
        </p>
      )}
    </header>
  );
}

// ─── MiniStat sub-component (inline) ──────────────────────────────────────

function MiniStat({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div
      className="rounded-lg border border-border/60 p-2"
      style={{ backgroundColor: `${color}10` }}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon
          className="h-3.5 w-3.5"
          style={{ color }}
          aria-hidden
        />
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
          {label}
        </span>
      </div>
      <p
        className="text-base font-mono font-bold leading-tight"
        style={{ color }}
      >
        {value}
      </p>
    </div>
  );
}
