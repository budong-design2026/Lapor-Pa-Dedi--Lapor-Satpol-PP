"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  RefreshCw,
  Clock,
  AlertTriangle,
  Inbox,
  CalendarDays,
  CalendarRange,
  Activity,
  CheckCircle2,
  Timer,
  ChevronRight,
  ShieldAlert,
  Map as MapIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppStore } from "@/store/app-store";
import { GlassCard } from "@/components/shared/glass-card";
import { GoldShimmerText } from "@/components/shared/gold-shimmer-text";
import { StatCard } from "@/components/shared/stat-card";
import { RiskBadge } from "@/components/shared/risk-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { CategoryIcon } from "@/components/shared/category-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { Loading, RowSkeleton } from "@/components/shared/loading";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RISK_LEVELS,
  REPORT_STATUSES,
  type RiskLevelKey,
} from "@/lib/constants";
import { timeAgo } from "@/lib/report-helpers";
import { apiFetch, ApiError } from "@/lib/api-client";

// ─── Types (mirror of /api/pimpinan/dashboard response) ────────────────────

interface CriticalActiveItem {
  id: string;
  ticketNumber: string;
  category: string;
  description: string;
  address: string;
  kabupaten: string;
  status: string;
  slaRemaining: { ms: number; label: string; overdue: boolean };
  assignedBidangName: string | null;
  assigneeName: string | null;
  createdAt: string;
}

interface ByRiskRow { riskLevel: string; count: number; }
interface ByCategoryRow { category: string; name: string; count: number; }
interface ByKabupatenRow { kabupaten: string; count: number; }
interface ByBidangRow { bidangId: string; bidangName: string; count: number; }
interface ByStatusRow { status: string; count: number; }
interface TrendRow { date: string; count: number; }

interface DashboardData {
  scope: "all" | "bidang";
  today: number;
  thisWeek: number;
  thisMonth: number;
  total: number;
  byRisk: ByRiskRow[];
  byCategory: ByCategoryRow[];
  byKabupaten: ByKabupatenRow[];
  byBidang: ByBidangRow[];
  byStatus: ByStatusRow[];
  criticalActive: CriticalActiveItem[];
  avgResponseHours: number;
  closeRate: number;
  slaCompliance: number;
  trend: TrendRow[];
}

// ─── Constants ────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 20_000; // 20 seconds (pimpinan needs near-real-time)

const RISK_ORDER: RiskLevelKey[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const RISK_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(RISK_LEVELS).map(([k, v]) => [k, v.color])
);

const RISK_EMOJI: Record<string, string> = Object.fromEntries(
  Object.entries(RISK_LEVELS).map(([k, v]) => [k, v.emoji])
);

const RISK_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(RISK_LEVELS).map(([k, v]) => [k, v.label])
);

const STATUS_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(REPORT_STATUSES).map(([k, v]) => [k, v.color])
);

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(REPORT_STATUSES).map(([k, v]) => [k, v.label])
);

// ─── Helpers ───────────────────────────────────────────────────────────────

function shortKabupaten(name: string): string {
  // "Kota Bandung" → "Bandung", "Kab. Bandung Barat" → "Bandung Barat"
  return name.replace(/^(Kota|Kab\.)\s*/i, "").trim();
}

function shortLabel(name: string, max = 14): string {
  if (name.length <= max) return name;
  return name.slice(0, max - 1) + "…";
}

function fmtInt(n: number | null | undefined): string {
  if (n == null) return "-";
  return n.toLocaleString("id-ID");
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "-";
  return `${n}%`;
}

// ─── View ──────────────────────────────────────────────────────────────────

export function PimpinanCommandView() {
  const setView = useAppStore((s) => s.setView);
  const openReport = useAppStore((s) => s.openReport);
  const user = useAppStore((s) => s.user);

  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [sessionExpired, setSessionExpired] = React.useState(false);
  const [chartHeight, setChartHeight] = React.useState(220);

  // Responsive chart height
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setChartHeight(mq.matches ? 300 : 220);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Fetch command center dashboard. Stable identity (no closure deps) so the
  // polling effect does not re-subscribe on every data update.
  const fetchDashboard = React.useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setRefreshing(true);
      }
      setError(null);
      try {
        const res = await apiFetch<DashboardData>("/api/pimpinan/dashboard");
        setData(res);
        setLastUpdated(new Date());
        setSessionExpired(false);
      } catch (err: unknown) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setSessionExpired(true);
          if (!opts?.silent) toast.error("Sesi berakhir, silakan masuk lagi");
        } else {
          const msg = err instanceof ApiError ? err.message : "Gagal memuat dashboard";
          setError(msg);
          if (!opts?.silent) toast.error(msg);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  // Initial fetch
  React.useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  // Polling: 20s silent refresh
  React.useEffect(() => {
    const id = setInterval(() => {
      void fetchDashboard({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchDashboard]);

  function handleRefresh() {
    void fetchDashboard();
  }

  // ─── Session expired ───
  if (sessionExpired) {
    return (
      <EmptyState
        icon={Clock}
        title="Sesi berakhir"
        description="Sesi login Anda sudah berakhir. Silakan masuk kembali untuk mengakses Command Center."
        action={{ label: "Masuk lagi", onClick: () => setView("login") }}
      />
    );
  }

  if (loading && !data) {
    return (
      <div className="pb-6 space-y-5">
        <Header
          refreshing={refreshing}
          lastUpdated={lastUpdated}
          onRefresh={handleRefresh}
          scope={user?.bidangName}
        />
        <Loading label="Memuat Command Center…" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Gagal memuat dashboard"
        description={error}
        action={{ label: "Coba lagi", onClick: handleRefresh }}
      />
    );
  }

  if (!data) return null;

  // ─── Derived data ───
  const byRisk = RISK_ORDER
    .map((k) => {
      const row = data.byRisk.find((r) => r.riskLevel === k);
      return {
        key: k,
        name: `${RISK_EMOJI[k] ?? ""} ${RISK_LABELS[k] ?? k}`,
        count: row?.count ?? 0,
        color: RISK_COLORS[k] ?? "#9ca3af",
      };
    })
    .filter((r) => r.count > 0);

  const byStatus = data.byStatus.map((b) => ({
    key: b.status,
    name: STATUS_LABELS[b.status] ?? b.status,
    count: b.count,
    color: STATUS_COLORS[b.status] ?? "#9ca3af",
  }));

  const byCategoryTop = data.byCategory.slice(0, 10).map((b) => ({
    name: shortLabel(b.name, 28),
    count: b.count,
  }));

  const byKabupatenTop = [...data.byKabupaten]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const maxKab = byKabupatenTop.length > 0 ? byKabupatenTop[0].count : 1;

  const totalBidangCount = data.byBidang.reduce((s, r) => s + r.count, 0) || 1;
  const sortedByBidang = [...data.byBidang].sort((a, b) => b.count - a.count);

  const criticalTop = data.criticalActive.slice(0, 5);

  // Heatmap intensity
  const maxKabAll = data.byKabupaten.length > 0
    ? Math.max(...data.byKabupaten.map((k) => k.count), 1)
    : 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="pb-6 space-y-5"
    >
      <Header
        refreshing={refreshing}
        lastUpdated={lastUpdated}
        onRefresh={handleRefresh}
        scope={user?.bidangName}
      />

      {/* ─── Critical alert banner ─── */}
      {criticalTop.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          role="alert"
          aria-live="polite"
          className="critical-pulse rounded-xl border-l-4 border-l-red-500 bg-red-500/10 border border-red-500/40 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden>🚨</span>
            <div>
              <p className="text-sm font-bold text-red-400">
                {data.criticalActive.length} Laporan CRITICAL Aktif
              </p>
              <p className="text-xs text-muted-foreground">
                SLA berjalan — tinjau &amp; setujui eskalasi segera.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => setView("pimpinan-critical")}
            className="gap-1.5"
          >
            Lihat Semua Critical
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </motion.div>
      ) : null}

      {/* ─── Top KPI strip ─── */}
      <section
        aria-label="Statistik utama Command Center"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3"
      >
        <StatCard
          label="Laporan Hari Ini"
          value={fmtInt(data.today)}
          accent="gold"
          icon={Inbox}
        />
        <StatCard
          label="Minggu Ini"
          value={fmtInt(data.thisWeek)}
          accent="blue"
          icon={CalendarDays}
        />
        <StatCard
          label="Bulan Ini"
          value={fmtInt(data.thisMonth)}
          accent="amber"
          icon={CalendarRange}
        />
        <StatCard
          label="Critical Aktif"
          value={fmtInt(data.criticalActive.length)}
          accent="red"
          icon={AlertTriangle}
        />
        <StatCard
          label="Close Rate"
          value={fmtPct(data.closeRate)}
          accent="green"
          icon={CheckCircle2}
        />
        <StatCard
          label="SLA Compliance"
          value={fmtPct(data.slaCompliance)}
          accent="gold"
          icon={Timer}
          sub={`Avg ${fmtInt(data.avgResponseHours)} jam`}
        />
      </section>

      {/* ─── Risk + Status donuts ─── */}
      <section
        aria-label="Distribusi risiko dan status"
        className="grid lg:grid-cols-2 gap-4"
      >
        <GlassCard className="p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-jabar-gold" aria-hidden />
            <h2 className="text-base font-bold tracking-tight">Distribusi Risiko</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              Total {fmtInt(data.byRisk.reduce((s, r) => s + r.count, 0))}
            </span>
          </div>
          {byRisk.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">
              Belum ada laporan dengan risiko yang ditetapkan.
            </p>
          ) : (
            <div style={{ width: "100%", height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byRisk}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={Math.max(36, chartHeight * 0.18)}
                    outerRadius={Math.max(60, chartHeight * 0.4)}
                    paddingAngle={2}
                    stroke="rgba(0,0,0,0.2)"
                  >
                    {byRisk.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(13,20,36,0.95)",
                      border: "1px solid rgba(255,214,0,0.3)",
                      borderRadius: 8,
                      color: "#fff",
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#ffd600", fontWeight: 700 }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: "#cbd5e1" }}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-5 w-5 text-jabar-gold" aria-hidden />
            <h2 className="text-base font-bold tracking-tight">Distribusi Status</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              Total {fmtInt(data.byStatus.reduce((s, r) => s + r.count, 0))}
            </span>
          </div>
          {byStatus.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">
              Belum ada laporan.
            </p>
          ) : (
            <div style={{ width: "100%", height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byStatus}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={Math.max(36, chartHeight * 0.18)}
                    outerRadius={Math.max(60, chartHeight * 0.4)}
                    paddingAngle={2}
                    stroke="rgba(0,0,0,0.2)"
                  >
                    {byStatus.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(13,20,36,0.95)",
                      border: "1px solid rgba(255,214,0,0.3)",
                      borderRadius: 8,
                      color: "#fff",
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#ffd600", fontWeight: 700 }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: "#cbd5e1" }}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>
      </section>

      {/* ─── Category bar chart ─── */}
      <section aria-label="Laporan per kategori">
        <GlassCard className="p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-5 w-5 text-jabar-gold" aria-hidden />
            <h2 className="text-base font-bold tracking-tight">Laporan per Kategori</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              Top {byCategoryTop.length}
            </span>
          </div>
          {byCategoryTop.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">
              Belum ada data kategori.
            </p>
          ) : (
            <div style={{ width: "100%", height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={byCategoryTop}
                  layout="vertical"
                  margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.08)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: "#cbd5e1", fontSize: 11 }}
                    width={140}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,214,0,0.08)" }}
                    contentStyle={{
                      backgroundColor: "rgba(13,20,36,0.95)",
                      border: "1px solid rgba(255,214,0,0.3)",
                      borderRadius: 8,
                      color: "#fff",
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#ffd600", fontWeight: 700 }}
                  />
                  <Bar
                    dataKey="count"
                    name="Jumlah"
                    fill="#ffd600"
                    radius={[0, 4, 4, 0]}
                    maxBarSize={26}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>
      </section>

      {/* ─── Kabupaten bars + Heatmap ─── */}
      <section
        aria-label="Distribusi per kabupaten/kota"
        className="grid lg:grid-cols-2 gap-4"
      >
        <GlassCard className="p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <MapIcon className="h-5 w-5 text-jabar-gold" aria-hidden />
            <h2 className="text-base font-bold tracking-tight">Top 10 Kabupaten/Kota</h2>
          </div>
          <ul className="space-y-2">
            {byKabupatenTop.map((k) => {
              const pct = maxKab > 0 ? Math.round((k.count / maxKab) * 100) : 0;
              return (
                <li
                  key={k.kabupaten}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="w-32 sm:w-40 truncate text-xs text-muted-foreground">
                    {shortKabupaten(k.kabupaten)}
                  </span>
                  <div
                    className="flex-1 h-6 rounded-md bg-white/5 overflow-hidden relative"
                    role="presentation"
                  >
                    <div
                      className="h-full rounded-md bg-jabar-gold/80"
                      style={{ width: `${Math.max(pct, 6)}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-mono">
                      {k.count}
                    </span>
                  </div>
                </li>
              );
            })}
            {byKabupatenTop.length === 0 ? (
              <li className="text-sm text-muted-foreground py-6 text-center">
                Belum ada data kabupaten/kota.
              </li>
            ) : null}
          </ul>
        </GlassCard>

        <GlassCard className="p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <MapIcon className="h-5 w-5 text-jabar-gold" aria-hidden />
            <h2 className="text-base font-bold tracking-tight">Heatmap 27 Kabupaten/Kota</h2>
          </div>
          <ul
            aria-label="Heatmap kabupaten/kota Jabar"
            className="grid grid-cols-3 sm:grid-cols-4 gap-1.5"
          >
            {data.byKabupaten.map((k) => {
              const intensity = Math.max(0.08, k.count / maxKabAll);
              const isHot = k.count === maxKabAll && maxKabAll > 0;
              return (
                <li
                  key={k.kabupaten}
                  className="rounded-md border border-jabar-gold/15 px-1.5 py-1.5 text-center"
                  style={{
                    backgroundColor: `rgba(255, 214, 0, ${intensity.toFixed(2)})`,
                    boxShadow: isHot ? "0 0 0 1px rgba(239,68,68,0.5)" : undefined,
                  }}
                  title={`${k.kabupaten} — ${k.count} laporan`}
                >
                  <p className="text-[10px] font-semibold leading-tight truncate">
                    {shortKabupaten(k.kabupaten)}
                  </p>
                  <p className="text-[11px] font-mono leading-tight text-foreground/80">
                    {k.count}
                  </p>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>sedang</span>
            <span
              aria-hidden
              className="inline-flex gap-0.5"
            >
              {[0.15, 0.35, 0.55, 0.8, 1].map((o, i) => (
                <span
                  key={i}
                  className="inline-block h-2.5 w-5 rounded-sm"
                  style={{ backgroundColor: `rgba(255,214,0,${o})` }}
                />
              ))}
            </span>
            <span>tinggi</span>
          </div>
        </GlassCard>
      </section>

      {/* ─── By Bidang table ─── */}
      <section aria-label="Distribusi per Bidang">
        <GlassCard className="p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-jabar-gold" aria-hidden />
            <h2 className="text-base font-bold tracking-tight">Distribusi per Bidang</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bidang</TableHead>
                <TableHead className="text-right w-20">Jumlah</TableHead>
                <TableHead className="w-1/2">Proporsi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedByBidang.map((b) => {
                const pct =
                  totalBidangCount > 0
                    ? Math.round((b.count / totalBidangCount) * 100)
                    : 0;
                return (
                  <TableRow key={b.bidangId}>
                    <TableCell className="font-medium text-sm">
                      {b.bidangName}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {b.count}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-jabar-gold/80"
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground font-mono w-10 text-right">
                          {pct}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {sortedByBidang.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    Belum ada laporan ter-assign ke Bidang.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </GlassCard>
      </section>

      {/* ─── Critical active list (top 3-5) ─── */}
      <section aria-label="Laporan critical aktif teratas">
        <GlassCard className="p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" aria-hidden />
            <h2 className="text-base font-bold tracking-tight">
              Critical Aktif — Top {Math.min(criticalTop.length, 5)}
            </h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setView("pimpinan-critical")}
              className="ml-auto gap-1"
            >
              Lihat semua
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>

          {criticalTop.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Tidak ada laporan critical aktif 🎉"
              description="Semua laporan critical sudah ditangani atau selesai."
            />
          ) : (
            <ul className="space-y-3">
              {criticalTop.map((c) => {
                // SLA remaining comes pre-computed from the backend.
                const slaColor = c.slaRemaining?.overdue
                  ? "text-red-500"
                  : (c.slaRemaining?.ms ?? 0) < 15 * 60 * 1000
                  ? "text-amber-500"
                  : "text-green-500";
                return (
                  <li
                    key={c.id}
                    className="rounded-lg border-l-4 border-l-red-500 critical-pulse bg-red-500/5 p-3 sm:p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-jabar-gold">
                          {c.ticketNumber}
                        </span>
                        <RiskBadge riskLevel="CRITICAL" />
                        <StatusBadge status={c.status} />
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-mono font-bold ${slaColor}`}
                        >
                          <Timer className="h-3 w-3" aria-hidden />
                          SLA {c.slaRemaining?.label ?? "-"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CategoryIcon code={c.category} className="h-4 w-4 text-jabar-gold" />
                        <span className="truncate">{c.kabupaten}</span>
                        <span aria-hidden>•</span>
                        <span className="truncate">{c.address}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {c.description}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openReport(c.id)}
                      className="gap-1.5"
                    >
                      Tinjau
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>
      </section>
    </motion.div>
  );
}

// ─── Header sub-component ─────────────────────────────────────────────────

function Header({
  refreshing,
  lastUpdated,
  onRefresh,
  scope,
}: {
  refreshing: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
  scope?: string | null;
}) {
  return (
    <header className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            <GoldShimmerText as="span">COMMAND CENTER</GoldShimmerText>
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time monitoring pengaduan Trantibumlinmas Jabar
            {scope ? (
              <>
                {" "}
                — <span className="text-jabar-gold/80">Bidang {scope}</span>
              </>
            ) : null}
            .
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Segarkan dashboard"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            aria-hidden
          />
          Segarkan
        </Button>
      </div>
      {lastUpdated ? (
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <Clock className="h-3 w-3" aria-hidden />
          Terakhir diperbarui:{" "}
          <time dateTime={lastUpdated.toISOString()}>
            {timeAgo(lastUpdated)}
          </time>{" "}
          <span className="text-muted-foreground/70">
            (otomatis setiap 20 detik)
          </span>
        </p>
      ) : null}
    </header>
  );
}
