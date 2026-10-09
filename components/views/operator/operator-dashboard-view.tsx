"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Inbox,
  Clock,
  AlertTriangle,
  Timer,
  TrendingUp,
  Activity,
  Gauge,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/store/app-store";
import { GlassCard } from "@/components/shared/glass-card";
import { GoldShimmerText } from "@/components/shared/gold-shimmer-text";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Loading } from "@/components/shared/loading";
import { RiskBadge } from "@/components/shared/risk-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { apiFetch, ApiError } from "@/lib/api-client";
import { timeAgo, slaTimeRemaining } from "@/lib/report-helpers";
import { getCategory } from "@/lib/constants";

// ─── Types ────────────────────────────────────────────────────────────────

interface DashboardData {
  queueToday: number;
  unverified: number;
  inProgress: number;
  criticalActive: number;
  overdue: number;
  avgResponseHours: number;
  closeRate: number;
  slaCompliance: number;
}

interface RecentReport {
  id: string;
  ticketNumber: string;
  category: string;
  status: string;
  riskLevel: string | null;
  slaDeadline: string | null;
  createdAt: string;
  kabupaten: string;
}

// ─── View ──────────────────────────────────────────────────────────────────

export function OperatorDashboardView() {
  const setView = useAppStore((s) => s.setView);
  const openReport = useAppStore((s) => s.openReport);

  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = React.useState(false);

  const [recent, setRecent] = React.useState<RecentReport[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<DashboardData>("/api/operator/dashboard");
        if (cancelled) return;
        setData(res);
        setSessionExpired(false);
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 401) {
          setSessionExpired(true);
          toast.error("Sesi berakhir, silakan masuk lagi");
        } else {
          const msg = err instanceof ApiError ? err.message : "Gagal memuat dashboard";
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Fetch last 5 reports in parallel (best-effort)
    (async () => {
      try {
        const params = new URLSearchParams({
          limit: "5",
          page: "1",
          sort: "newest",
        });
        const res = await apiFetch<{ reports: RecentReport[]; total: number }>(
          `/api/reports?${params.toString()}`
        );
        if (!cancelled) setRecent(res.reports ?? []);
      } catch {
        // ignore — recent list is optional
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
          description="Sesi login Anda sudah berakhir. Silakan masuk kembali untuk melihat dashboard."
          action={{ label: "Masuk lagi", onClick: () => setView("login") }}
        />
      </motion.div>
    );
  }

  if (loading) {
    return (
      <div className="pb-6">
        <Loading label="Memuat dashboard…" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="pb-6"
      >
        <EmptyState
          icon={AlertTriangle}
          title="Gagal memuat dashboard"
          description={error}
          action={{ label: "Buka Inbox", onClick: () => setView("operator-inbox") }}
        />
      </motion.div>
    );
  }

  if (!data) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="pb-6 space-y-5"
    >
      {/* ─── Header ─── */}
      <header className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
          <GoldShimmerText as="span">Dashboard Operator</GoldShimmerText>
        </h1>
        <p className="text-sm text-muted-foreground">
          Ringkasan beban kerja &amp; performa penanganan hari ini.
        </p>
      </header>

      {/* ─── 6 stat cards ─── */}
      <section
        aria-label="KPI operator"
        className="grid grid-cols-2 sm:grid-cols-3 gap-3"
      >
        <StatCard
          label="Antrian Hari Ini"
          value={data.queueToday}
          accent="gold"
          icon={Inbox}
          sub="Laporan masuk hari ini"
        />
        <StatCard
          label="Belum Diverifikasi"
          value={data.unverified}
          accent="amber"
          icon={AlertTriangle}
          sub="Menunggu verifikasi"
        />
        <StatCard
          label="Diproses"
          value={data.inProgress}
          accent="blue"
          icon={Activity}
          sub="Sedang ditangani"
        />
        <StatCard
          label="Critical Aktif"
          value={data.criticalActive}
          accent="red"
          icon={AlertTriangle}
          sub="SLA 1 jam — eskalasi!"
        />
        <StatCard
          label="Overdue"
          value={data.overdue}
          accent="red"
          icon={Timer}
          sub="Melewati SLA"
        />
        <StatCard
          label="Close Rate"
          value={`${data.closeRate}%`}
          accent="green"
          icon={TrendingUp}
          sub="Tingkat penyelesaian"
        />
      </section>

      {/* ─── Response time + SLA compliance ─── */}
      <section
        aria-label="Performa penanganan"
        className="grid sm:grid-cols-2 gap-3"
      >
        <GlassCard className="p-5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Rata-rata Response Time
            </p>
            <Gauge className="h-4 w-4 text-jabar-gold" aria-hidden />
          </div>
          <p className="text-3xl font-black text-jabar-gold leading-none">
            {data.avgResponseHours > 0 ? data.avgResponseHours : "—"}
            {data.avgResponseHours > 0 ? (
              <span className="text-base font-bold text-muted-foreground ml-1">
                jam
              </span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">
            Rata-rata waktu (Diterima → Selesai) bulan ini.
          </p>
        </GlassCard>

        <GlassCard className="p-5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              SLA Compliance
            </p>
            <Activity className="h-4 w-4 text-jabar-gold" aria-hidden />
          </div>
          <p className="text-3xl font-black leading-none" style={{ color: slaComplianceColor(data.slaCompliance) }}>
            {data.slaCompliance}
            <span className="text-base font-bold text-muted-foreground ml-1">%</span>
          </p>
          <Progress
            value={data.slaCompliance}
            className="h-2 mt-2 bg-muted"
            aria-label={`SLA compliance ${data.slaCompliance} persen`}
          />
          <p className="text-xs text-muted-foreground">
            Laporan selesai sebelum tenggat SLA.
          </p>
        </GlassCard>
      </section>

      {/* ─── Quick CTA ─── */}
      <GlassCard className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-bold tracking-tight inline-flex items-center gap-2">
            <Inbox className="h-4 w-4 text-jabar-gold" aria-hidden />
            Buka Inbox Laporan
          </h2>
          <p className="text-xs text-muted-foreground">
            Tinjau antrian, verifikasi, dan teruskan laporan ke Bidang terkait.
          </p>
        </div>
        <Button
          type="button"
          className="bg-jabar-gold text-background hover:bg-jabar-gold/90 font-bold sm:w-auto w-full"
          onClick={() => setView("operator-inbox")}
        >
          Buka Inbox
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </GlassCard>

      {/* ─── Recent activity ─── */}
      {recent.length > 0 ? (
        <section aria-label="Aktivitas terbaru" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold tracking-tight inline-flex items-center gap-2">
              <Clock className="h-4 w-4 text-jabar-gold" aria-hidden />
              Aktivitas Terbaru
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setView("operator-inbox")}
            >
              Lihat semua
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
          <ul className="space-y-2">
            {recent.map((r) => {
              const cat = getCategory(r.category);
              const sla = slaTimeRemaining(r.slaDeadline);
              return (
                <li key={r.id}>
                  <GlassCard className="p-3 sm:p-4 flex items-center gap-3 hover:shadow-lg transition">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-jabar-gold/15 text-jabar-gold">
                      <Clock className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-jabar-gold">
                          {r.ticketNumber}
                        </span>
                        <StatusBadge status={r.status} />
                        <RiskBadge riskLevel={r.riskLevel} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {cat?.name ?? r.category} · {r.kabupaten} ·{" "}
                        {timeAgo(r.createdAt)}
                        {sla.label && sla.label !== "-"
                          ? ` · SLA ${sla.overdue ? "overdue " : ""}${sla.label}`
                          : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openReport(r.id)}
                      aria-label={`Tinjau ${r.ticketNumber}`}
                    >
                      Tinjau
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </GlassCard>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </motion.div>
  );
}

function slaComplianceColor(pct: number): string {
  if (pct >= 80) return "#22c55e";
  if (pct >= 60) return "#f9a825";
  return "#ef4444";
}
