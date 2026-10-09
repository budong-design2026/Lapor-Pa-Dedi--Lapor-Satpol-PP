"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  BarChart2,
  PieChart as PieChartIcon,
  TrendingUp,
  Map as MapIcon,
  Inbox,
  ClipboardList,
  CheckCircle2,
  Percent,
  ShieldCheck,
  Lock,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GlassCard } from "@/components/shared/glass-card";
import { GoldShimmerText } from "@/components/shared/gold-shimmer-text";
import { StatCard } from "@/components/shared/stat-card";
import { Loading } from "@/components/shared/loading";
import {
  RISK_LEVELS,
  REPORT_STATUSES,
  type RiskLevelKey,
} from "@/lib/constants";
import { apiFetch, ApiError } from "@/lib/api-client";

interface PublicStats {
  totalReports: number;
  thisMonth: number;
  completed: number;
  completionRate: number;
  avgResponseHours: number;
  byCategory: { category: string; name: string; count: number }[];
  byKabupaten: { kabupaten: string; count: number }[];
  byRisk: { riskLevel: string; count: number }[];
  byStatus: { status: string; count: number }[];
  last7Days: { date: string; count: number }[];
}

const RISK_ORDER: RiskLevelKey[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const STATUS_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(REPORT_STATUSES).map(([k, v]) => [k, v.color])
);

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(REPORT_STATUSES).map(([k, v]) => [k, v.label])
);

function shortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  } catch {
    return iso;
  }
}

function shortLabel(name: string, max = 12): string {
  if (name.length <= max) return name;
  return name.slice(0, max - 1) + "…";
}

export function TransparencyView() {
  const [stats, setStats] = React.useState<PublicStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [chartHeight, setChartHeight] = React.useState(260);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    apiFetch<PublicStats>("/api/reports/stats")
      .then((data) => {
        if (!alive) return;
        setStats(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof ApiError ? err.message : "Gagal memuat statistik");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Responsive chart height
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setChartHeight(mq.matches ? 300 : 220);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const fmtInt = (n: number | null | undefined) =>
    n == null ? "-" : n.toLocaleString("id-ID");

  // Derived data
  const byCategory = (stats?.byCategory ?? []).slice(0, 8).map((b) => ({
    name: shortLabel(b.name, 14),
    count: b.count,
  }));
  const byStatus = (stats?.byStatus ?? []).map((b) => ({
    key: b.status,
    name: STATUS_LABELS[b.status] ?? b.status,
    count: b.count,
    color: STATUS_COLORS[b.status] ?? "#9ca3af",
  }));
  const byKabupaten = stats?.byKabupaten ?? [];
  const maxKab = byKabupaten.length > 0 ? byKabupaten[0].count : 1;
  const last7Days = (stats?.last7Days ?? []).map((d) => ({
    date: shortDate(d.date),
    count: d.count,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="pb-6 space-y-6"
    >
      {/* ─── Header ─── */}
      <header className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
          <GoldShimmerText as="span">Transparansi Publik</GoldShimmerText>
        </h1>
        <p className="text-sm text-muted-foreground">
          Data agregat pengaduan Satpol PP Provinsi Jawa Barat.
        </p>
      </header>

      {/* ─── Stat cards ─── */}
      <section aria-label="Statistik utama">
        {loading ? (
          <Loading label="Memuat statistik…" />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              label="Total Laporan"
              value={fmtInt(stats?.totalReports)}
              icon={Inbox}
              accent="gold"
            />
            <StatCard
              label="Bulan Ini"
              value={fmtInt(stats?.thisMonth)}
              icon={ClipboardList}
              accent="blue"
            />
            <StatCard
              label="Selesai"
              value={fmtInt(stats?.completed)}
              icon={CheckCircle2}
              accent="green"
            />
            <StatCard
              label="Tingkat Penyelesaian"
              value={`${stats?.completionRate ?? 0}%`}
              icon={Percent}
              accent="amber"
              sub={`Rata-rata ${(stats?.avgResponseHours ?? 0).toFixed(1)} jam`}
            />
          </div>
        )}
        {error ? (
          <p className="text-sm text-destructive mt-2" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {/* ─── Bar chart byCategory + Pie byStatus ─── */}
      <section
        aria-label="Grafik kategori dan status"
        className="grid lg:grid-cols-3 gap-4 sm:gap-5"
      >
        <GlassCard className="lg:col-span-2 p-5">
          <div className="mb-3 flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-jabar-gold" aria-hidden />
            <h2 className="text-base font-bold tracking-tight">
              Laporan per Kategori
            </h2>
            <span className="text-xs text-muted-foreground ml-auto">
              Top {byCategory.length}
            </span>
          </div>
          <div style={{ width: "100%", height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={byCategory}
                margin={{ top: 8, right: 8, bottom: 24, left: -12 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.08)"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  allowDecimals={false}
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
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-jabar-gold" aria-hidden />
            <h2 className="text-base font-bold tracking-tight">per Status</h2>
          </div>
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
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: "#cbd5e1" }}
                  iconType="circle"
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </section>

      {/* ─── 7-day trend + Risk distribution ─── */}
      <section
        aria-label="Tren dan distribusi risiko"
        className="grid lg:grid-cols-3 gap-4 sm:gap-5"
      >
        <GlassCard className="lg:col-span-2 p-5">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-jabar-gold" aria-hidden />
            <h2 className="text-base font-bold tracking-tight">
              Tren 7 Hari Terakhir
            </h2>
            <span className="text-xs text-muted-foreground ml-auto">
              {last7Days.reduce((s, d) => s + d.count, 0)} laporan
            </span>
          </div>
          <div style={{ width: "100%", height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={last7Days}
                margin={{ top: 8, right: 12, bottom: 8, left: -12 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.08)"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <YAxis
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ stroke: "rgba(255,214,0,0.3)" }}
                  contentStyle={{
                    backgroundColor: "rgba(13,20,36,0.95)",
                    border: "1px solid rgba(255,214,0,0.3)",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#ffd600", fontWeight: 700 }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Laporan"
                  stroke="#ffd600"
                  strokeWidth={3}
                  dot={{ fill: "#ffd600", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-jabar-gold" aria-hidden />
            <h2 className="text-base font-bold tracking-tight">
              Distribusi Risiko
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {RISK_ORDER.map((k) => {
              const r = RISK_LEVELS[k];
              const count =
                stats?.byRisk?.find((b) => b.riskLevel === k)?.count ?? 0;
              return (
                <div
                  key={k}
                  className="rounded-lg border border-border/60 bg-accent/20 p-3 space-y-1"
                  style={{
                    boxShadow: `0 0 0 1px ${r.color}22 inset`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl" aria-hidden>
                      {r.emoji}
                    </span>
                    <span
                      className="text-2xl font-black"
                      style={{ color: r.color }}
                    >
                      {count}
                    </span>
                  </div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-wide"
                    style={{ color: r.color }}
                  >
                    {r.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    SLA {r.slaHours} jam
                  </p>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </section>

      {/* ─── byKabupaten horizontal bar list ─── */}
      <section aria-label="Distribusi per kabupaten/kota">
        <GlassCard className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <MapIcon className="h-5 w-5 text-jabar-gold" aria-hidden />
            <h2 className="text-base font-bold tracking-tight">
              Top {byKabupaten.length} Kabupaten/Kota
            </h2>
          </div>
          {byKabupaten.length === 0 ? (
            <EmptyInline label="Belum ada data" />
          ) : (
            <ul className="space-y-2.5 max-h-96 overflow-y-auto custom-scroll pr-2">
              {byKabupaten.map((b, i) => {
                const pct = Math.max(6, Math.round((b.count / maxKab) * 100));
                return (
                  <li key={`${b.kabupaten}-${i}`} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium truncate pr-2">
                        {b.kabupaten}
                      </span>
                      <span className="font-mono font-bold text-jabar-gold">
                        {b.count}
                      </span>
                    </div>
                    <div
                      className="h-2 rounded-full bg-accent/40 overflow-hidden"
                      role="presentation"
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background:
                            "linear-gradient(90deg, #ffd600 0%, #f9a825 100%)",
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>
      </section>

      {/* ─── Privacy note ─── */}
      <GlassCard className="p-4">
        <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <Lock className="h-4 w-4 shrink-0 mt-0.5 text-jabar-gold" aria-hidden />
          <p>
            <span className="font-semibold text-foreground">
              Catatan privasi:
            </span>{" "}
            Data agregat. Detail laporan tidak dipublikasikan untuk melindungi
            privasi pelapor.
          </p>
        </div>
      </GlassCard>
    </motion.div>
  );
}

function EmptyInline({ label }: { label: string }) {
  return (
    <div className="text-center py-8 text-sm text-muted-foreground">
      {label}
    </div>
  );
}
