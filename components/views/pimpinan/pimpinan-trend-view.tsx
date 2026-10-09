"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Clock,
  ShieldAlert,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Printer,
  CalendarDays,
  Activity,
  Map as MapIcon,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppStore } from "@/store/app-store";
import { GlassCard } from "@/components/shared/glass-card";
import { GoldShimmerText } from "@/components/shared/gold-shimmer-text";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Loading } from "@/components/shared/loading";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, ApiError } from "@/lib/api-client";

// ─── Types (mirror of /api/pimpinan/dashboard response) ───────────────────

interface TrendRow {
  date: string;
  count: number;
}

interface ByCategoryRow {
  category: string;
  name: string;
  count: number;
}

interface ByKabupatenRow {
  kabupaten: string;
  count: number;
}

interface DashboardData {
  scope: "all" | "bidang";
  today: number;
  thisWeek: number;
  thisMonth: number;
  total: number;
  byRisk: { riskLevel: string; count: number }[];
  byCategory: ByCategoryRow[];
  byKabupaten: ByKabupatenRow[];
  byBidang: { bidangId: string; bidangName: string; count: number }[];
  byStatus: { status: string; count: number }[];
  criticalActive: unknown[];
  avgResponseHours: number;
  closeRate: number;
  slaCompliance: number;
  trend: TrendRow[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function shortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  } catch {
    return iso;
  }
}

function shortKabupaten(name: string): string {
  return name.replace(/^(Kota|Kab\.)\s*/i, "").trim();
}

function fmtInt(n: number | null | undefined): string {
  if (n == null) return "-";
  return n.toLocaleString("id-ID");
}

function isCurrentMonth(iso: string, ref = new Date()): boolean {
  try {
    const d = new Date(iso);
    return (
      d.getUTCFullYear() === ref.getUTCFullYear() &&
      d.getUTCMonth() === ref.getUTCMonth()
    );
  } catch {
    return false;
  }
}

// ─── View ──────────────────────────────────────────────────────────────────

export function PimpinanTrendView() {
  const setView = useAppStore((s) => s.setView);
  const user = useAppStore((s) => s.user);

  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = React.useState(false);
  const [chartHeight, setChartHeight] = React.useState(240);

  // Responsive chart height
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setChartHeight(mq.matches ? 300 : 240);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const fetchDashboard = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<DashboardData>("/api/pimpinan/dashboard");
      setData(res);
      setSessionExpired(false);
    } catch (err: unknown) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setSessionExpired(true);
        toast.error("Sesi berakhir, silakan masuk lagi");
      } else {
        const msg = err instanceof ApiError ? err.message : "Gagal memuat tren";
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  // ─── Session expired ───
  if (sessionExpired) {
    return (
      <EmptyState
        icon={Clock}
        title="Sesi berakhir"
        description="Sesi login Anda sudah berakhir. Silakan masuk kembali untuk melihat tren analitik."
        action={{ label: "Masuk lagi", onClick: () => setView("login") }}
      />
    );
  }

  if (loading && !data) {
    return (
      <div className="pb-6 space-y-5">
        <Header scope={user?.bidangName} />
        <Loading label="Memuat tren analitik…" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Gagal memuat tren"
        description={error}
        action={{ label: "Coba lagi", onClick: () => void fetchDashboard() }}
      />
    );
  }

  if (!data) return null;

  // ─── Derived data ───

  // Trend data for recharts (last 30 days)
  const trendData = data.trend.map((t) => ({
    date: shortDate(t.date),
    fullDate: t.date,
    count: t.count,
  }));

  // Month split — current month vs previous period (within the 30-day window)
  const thisMonthTrendTotal = data.trend
    .filter((t) => isCurrentMonth(t.date))
    .reduce((s, t) => s + t.count, 0);
  const lastPeriodTrendTotal =
    data.trend.reduce((s, t) => s + t.count, 0) - thisMonthTrendTotal;

  // Delta direction (up = more reports = red; down = fewer = green)
  const delta = thisMonthTrendTotal - lastPeriodTrendTotal;
  const deltaUp = delta > 0;
  const deltaDown = delta < 0;
  const deltaNeutral = delta === 0;

  // Simple 7-day moving average prediction: avg(last 7 days) × 7
  const last7 = data.trend.slice(-7);
  const last7Total = last7.reduce((s, t) => s + t.count, 0);
  const last7Avg = last7.length > 0 ? last7Total / last7.length : 0;
  const prediction7 = Math.round(last7Avg * 7);

  // Top 5 kabupaten
  const top5Kab = [...data.byKabupaten]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const maxKab = top5Kab.length > 0 ? top5Kab[0].count : 1;

  // Top categories (for table)
  const topCategories = [...data.byCategory]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Total reports in 30 days
  const total30 = data.trend.reduce((s, t) => s + t.count, 0);

  function handlePrint() {
    if (typeof window === "undefined") return;
    try {
      window.print();
    } catch (err) {
      toast.error("Gagal mencetak — browser memblok print.");
      console.warn(err);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="pb-6 space-y-5"
    >
      <Header scope={user?.bidangName} />

      {/* ─── Print button + note ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-jabar-gold" aria-hidden />
          Total {fmtInt(total30)} laporan dalam 30 hari terakhir.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handlePrint}
          className="gap-1.5"
          aria-label="Ekspor dashboard sebagai PDF (buka dialog cetak browser)"
        >
          <Printer className="h-4 w-4" aria-hidden />
          Ekspor Laporan (PDF)
        </Button>
      </div>

      {/* ─── Trend area chart ─── */}
      <section aria-label="Grafik tren 30 hari">
        <GlassCard className="p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-jabar-gold" aria-hidden />
            <h2 className="text-base font-bold tracking-tight">
              Tren Pengaduan — 30 Hari
            </h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {fmtInt(total30)} laporan
            </span>
          </div>
          {trendData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">
              Belum ada data tren.
            </p>
          ) : (
            <div style={{ width: "100%", height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trendData}
                  margin={{ top: 8, right: 12, bottom: 8, left: -8 }}
                >
                  <defs>
                    <linearGradient id="trendGold" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffd600" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#ffd600" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.08)"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                    interval={3}
                  />
                  <YAxis
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(13,20,36,0.95)",
                      border: "1px solid rgba(255,214,0,0.3)",
                      borderRadius: 8,
                      color: "#fff",
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#ffd600", fontWeight: 700 }}
                    formatter={(value: number | string) => [`${value} laporan`, "Jumlah"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Jumlah"
                    stroke="#ffd600"
                    strokeWidth={2}
                    fill="url(#trendGold)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#ffd600", stroke: "#060912" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>
      </section>

      {/* ─── Month comparison + prediction ─── */}
      <section
        aria-label="Perbandingan bulan ini vs periode lalu + prediksi"
        className="grid sm:grid-cols-3 gap-3"
      >
        <StatCard
          label="Bulan Ini"
          value={fmtInt(thisMonthTrendTotal)}
          accent="gold"
          icon={CalendarDays}
          sub="Month-to-date"
        />
        <StatCard
          label="Periode Lalu"
          value={fmtInt(lastPeriodTrendTotal)}
          accent="blue"
          icon={CalendarDays}
          sub="30 hari sebelum bulan ini"
        />
        <GlassCard className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Delta Bulan Ini
              </p>
              <p
                className={`mt-1 text-2xl font-black leading-none inline-flex items-center gap-1 ${
                  deltaUp
                    ? "text-red-500"
                    : deltaDown
                    ? "text-green-500"
                    : "text-muted-foreground"
                }`}
              >
                {deltaUp ? (
                  <ArrowUp className="h-5 w-5" aria-hidden />
                ) : deltaDown ? (
                  <ArrowDown className="h-5 w-5" aria-hidden />
                ) : null}
                {delta > 0 ? "+" : ""}
                {fmtInt(Math.abs(delta))}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {deltaUp
                  ? "Naik — perlu evaluasi"
                  : deltaDown
                  ? "Turun — tren membaik"
                  : "Stabil"}
              </p>
            </div>
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{
                backgroundColor: deltaUp
                  ? "rgba(239,68,68,0.15)"
                  : deltaDown
                  ? "rgba(34,197,94,0.15)"
                  : "rgba(255,214,0,0.15)",
                color: deltaUp
                  ? "#ef4444"
                  : deltaDown
                  ? "#22c55e"
                  : "#ffd600",
              }}
            >
              <Activity className="h-5 w-5" aria-hidden />
            </div>
          </div>
        </GlassCard>
      </section>

      {/* ─── Prediction ─── */}
      <section aria-label="Prediksi 7 hari ke depan">
        <GlassCard className="p-4 sm:p-5">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-jabar-gold" aria-hidden />
            <h2 className="text-base font-bold tracking-tight">
              Prediksi 7 Hari ke Depan
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Estimasi berdasarkan rata-rata 7 hari terakhir.
          </p>
          <div className="flex items-center gap-3">
            <p className="text-3xl font-black text-jabar-gold font-mono">
              {fmtInt(prediction7)}
            </p>
            <p className="text-sm text-muted-foreground">
              laporan diprediksi dalam 7 hari ke depan.
              <br />
              <span className="text-xs">
                Rata-rata harian 7 hari terakhir:{" "}
                <span className="font-mono text-foreground/80">
                  {last7Avg.toFixed(1)}
                </span>{" "}
                laporan/hari.
              </span>
            </p>
          </div>
        </GlassCard>
      </section>

      {/* ─── Category trend (table) ─── */}
      <section aria-label="Tren kategori">
        <GlassCard className="p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-5 w-5 text-jabar-gold" aria-hidden />
            <h2 className="text-base font-bold tracking-tight">
              Top Kategori (30 hari)
            </h2>
          </div>
          {topCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Belum ada data kategori.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-2/3">Kategori</TableHead>
                  <TableHead className="text-right w-20">Jumlah</TableHead>
                  <TableHead className="w-1/3">Proporsi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCategories.map((c) => {
                  const pct =
                    total30 > 0 ? Math.round((c.count / total30) * 100) : 0;
                  return (
                    <TableRow key={c.category}>
                      <TableCell className="font-medium text-sm">
                        {c.name}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {c.count}
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
              </TableBody>
            </Table>
          )}
        </GlassCard>
      </section>

      {/* ─── Top 5 kabupaten ─── */}
      <section aria-label="Top 5 kabupaten/kota">
        <GlassCard className="p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <MapIcon className="h-5 w-5 text-jabar-gold" aria-hidden />
            <h2 className="text-base font-bold tracking-tight">
              Top 5 Kabupaten/Kota
            </h2>
          </div>
          {top5Kab.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Belum ada data kabupaten/kota.
            </p>
          ) : (
            <ol className="space-y-2.5">
              {top5Kab.map((k, idx) => {
                const pct = maxKab > 0 ? Math.round((k.count / maxKab) * 100) : 0;
                return (
                  <li
                    key={k.kabupaten}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-jabar-gold/15 text-xs font-mono font-bold text-jabar-gold"
                      aria-hidden
                    >
                      {idx + 1}
                    </span>
                    <span className="w-32 sm:w-48 truncate">
                      {shortKabupaten(k.kabupaten)}
                    </span>
                    <div
                      className="flex-1 h-5 rounded-md bg-white/5 overflow-hidden relative"
                      role="presentation"
                    >
                      <div
                        className="h-full rounded-md bg-jabar-gold/80"
                        style={{ width: `${Math.max(pct, 6)}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-muted-foreground w-10 text-right">
                      {k.count}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </GlassCard>
      </section>

      {/* ─── Note about full PDF ─── */}
      <p className="text-[11px] text-muted-foreground italic px-1">
        Catatan: Laporan PDF otomatis tersedia via Vercel cron (Phase 2).
        Untuk MVP, gunakan tombol &quot;Ekspor Laporan (PDF)&quot; di atas
        untuk mencetak dashboard ini melalui dialog cetak browser.
      </p>
    </motion.div>
  );
}

// ─── Header sub-component ─────────────────────────────────────────────────

function Header({ scope }: { scope?: string | null }) {
  return (
    <header className="space-y-1">
      <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
        <GoldShimmerText as="span">Trend Analitik</GoldShimmerText>
      </h1>
      <p className="text-sm text-muted-foreground">
        Perkembangan pengaduan 30 hari terakhir
        {scope ? (
          <>
            {" "}
            — <span className="text-jabar-gold/80">Bidang {scope}</span>
          </>
        ) : null}
        .
      </p>
    </header>
  );
}
