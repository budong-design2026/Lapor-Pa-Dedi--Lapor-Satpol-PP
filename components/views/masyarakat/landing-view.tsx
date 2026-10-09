"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ClipboardList,
  Search,
  Cog,
  CheckCircle2,
  ArrowRight,
  ArrowDown,
  FileBarChart2,
  Inbox,
  Clock,
  Percent,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { GoldShimmerText } from "@/components/shared/gold-shimmer-text";
import { StatCard } from "@/components/shared/stat-card";
import { CategoryIcon } from "@/components/shared/category-icon";
import { Loading } from "@/components/shared/loading";
import { LogoPemprov } from "@/components/shared/logo-pemprov";
import { LogoSatpolpp } from "@/components/shared/logo-satpolpp";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app-store";
import {
  CATEGORIES,
  RISK_LEVELS,
  TAGLINE,
  APP_NAME,
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

const STEPS = [
  {
    icon: ClipboardList,
    label: "Lapor",
    desc: "Warga melaporkan pelanggaran",
    color: "#0d47a1",
  },
  {
    icon: Search,
    label: "Verifikasi",
    desc: "Operator memverifikasi laporan",
    color: "#a855f7",
  },
  {
    icon: Cog,
    label: "Diproses",
    desc: "Bidang turun tangan",
    color: "#f9a825",
  },
  {
    icon: CheckCircle2,
    label: "Selesai",
    desc: "Laporan ditindaklanjuti",
    color: "#22c55e",
  },
] as const;

const RISK_ORDER: RiskLevelKey[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export function LandingView() {
  const setView = useAppStore((s) => s.setView);

  const [stats, setStats] = React.useState<PublicStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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
        const msg =
          err instanceof ApiError ? err.message : "Gagal memuat statistik";
        setError(msg);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const fmtInt = (n: number | null | undefined) =>
    n == null ? "-" : n.toLocaleString("id-ID");

  return (
    <div className="space-y-10 sm:space-y-14 pb-6">
      {/* ─── HERO ─── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        aria-labelledby="hero-title"
      >
        <GlassCard className="relative overflow-hidden p-6 sm:p-10">
          {/* Decorative gold glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-25 blur-3xl"
            style={{ background: "radial-gradient(circle, #ffd600 0%, transparent 70%)" }}
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 space-y-4">
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-jabar-gold/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-jabar-gold"
                style={{ boxShadow: "0 0 0 1px rgba(255,214,0,0.3) inset" }}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                <GoldShimmerText as="span" className="text-xs">
                  JABAR ISTIMEWA
                </GoldShimmerText>
              </span>

              <GoldShimmerText
                as="h1"
                className="text-3xl sm:text-5xl leading-tight"
              >
                {APP_NAME}
              </GoldShimmerText>

              <p className="max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
                {TAGLINE}. Lapor pelanggaran ketertiban, lacak statusnya
                real-time, dan lihat transparansi penegakan Satpol PP Provinsi
                Jawa Barat.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  type="button"
                  size="lg"
                  onClick={() => setView("lapor")}
                  className="bg-jabar-gold text-background hover:bg-jabar-gold/90 font-bold"
                >
                  <ClipboardList className="h-4 w-4" aria-hidden />
                  Lapor Sekarang
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={() => setView("track")}
                  className="border-jabar-gold/60 text-jabar-gold hover:bg-jabar-gold/10 hover:text-jabar-gold"
                >
                  <Search className="h-4 w-4" aria-hidden />
                  Lacak Laporan
                </Button>
              </div>
            </div>

            {/* Logos side by side (NOT rounded) */}
            <div className="flex shrink-0 items-center justify-center gap-4 sm:gap-6 lg:justify-end">
              <LogoPemprov className="drop-shadow-lg" />
              <div
                aria-hidden
                className="hidden sm:block h-24 w-px bg-border/60"
              />
              <LogoSatpolpp className="drop-shadow-lg" />
            </div>
          </div>
        </GlassCard>
      </motion.section>

      {/* ─── QUICK STATS STRIP ─── */}
      <section aria-labelledby="stats-title">
        <div className="mb-3 flex items-center gap-2">
          <FileBarChart2 className="h-5 w-5 text-jabar-gold" aria-hidden />
          <h2 id="stats-title" className="text-lg font-bold tracking-tight">
            Ringkasan Pengaduan
          </h2>
        </div>
        {loading ? (
          <Loading label="Memuat statistik…" />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              label="Total Laporan"
              value={fmtInt(stats?.totalReports)}
              icon={Inbox}
              accent="gold"
              sub="Sepanjang waktu"
            />
            <StatCard
              label="Bulan Ini"
              value={fmtInt(stats?.thisMonth)}
              icon={ClipboardList}
              accent="blue"
              sub="Pengaduan baru"
            />
            <StatCard
              label="Selesai"
              value={fmtInt(stats?.completed)}
              icon={CheckCircle2}
              accent="green"
              sub="Ditindaklanjuti"
            />
            <StatCard
              label="Tingkat Penyelesaian"
              value={`${stats?.completionRate ?? 0}%`}
              icon={Percent}
              accent="amber"
              sub={`${(stats?.avgResponseHours ?? 0).toFixed(1)} jam rata-rata`}
            />
          </div>
        )}
        {error && !stats ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : null}
      </section>

      {/* ─── 17 KETERTIBAN FEATURE GRID ─── */}
      <section aria-labelledby="cats-title">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-jabar-gold" aria-hidden />
          <h2 id="cats-title" className="text-lg font-bold tracking-tight">
            17 Ketertiban + Lainnya
          </h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground max-w-3xl">
          Klik kategori untuk melihat ruang lingkup. Pilih saat melapor agar
          laporan diteruskan ke bidang yang tepat.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {CATEGORIES.map((c, idx) => (
            <motion.div
              key={c.code}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.2) }}
              whileHover={{ scale: 1.03 }}
              className="cursor-pointer"
              onClick={() => setView("lapor")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setView("lapor");
                }
              }}
              aria-label={`Lapor kategori ${c.name}`}
            >
              <GlassCard className="h-full p-4 hover:border-jabar-gold/40 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-jabar-gold/15 text-jabar-gold">
                    <CategoryIcon code={c.code} />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {c.perdaRef ? "17 Ketertiban" : "Lainnya"}
                  </span>
                </div>
                <h3 className="text-sm font-bold leading-tight mb-1 line-clamp-2">
                  {c.name}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {c.description}
                </p>
                {c.perdaRef ? (
                  <p className="mt-2 text-[10px] font-mono text-jabar-gold/80 truncate">
                    {c.perdaRef}
                  </p>
                ) : null}
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ─── CARA KERJA ─── */}
      <section aria-labelledby="how-title">
        <div className="mb-4 flex items-center gap-2">
          <Cog className="h-5 w-5 text-jabar-gold" aria-hidden />
          <h2 id="how-title" className="text-lg font-bold tracking-tight">
            Cara Kerja
          </h2>
        </div>
        <GlassCard className="p-5 sm:p-8">
          <ol className="flex flex-col gap-4 sm:flex-row sm:items-stretch sm:gap-0">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isLast = i === STEPS.length - 1;
              return (
                <li
                  key={s.label}
                  className="flex flex-1 flex-col items-center text-center gap-2 sm:flex-row sm:gap-3"
                >
                  <div className="flex flex-col items-center gap-2 sm:flex-1">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: `${s.color}1f`,
                        color: s.color,
                        boxShadow: `0 0 0 2px ${s.color}33 inset`,
                      }}
                    >
                      <Icon className="h-6 w-6" aria-hidden />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold">
                        {i + 1}. {s.label}
                      </p>
                      <p className="text-xs text-muted-foreground max-w-[14rem]">
                        {s.desc}
                      </p>
                    </div>
                  </div>
                  {!isLast ? (
                    <>
                      <ArrowRight
                        className="hidden sm:block h-5 w-5 text-muted-foreground shrink-0"
                        aria-hidden
                      />
                      <ArrowDown
                        className="sm:hidden h-5 w-5 text-muted-foreground shrink-0"
                        aria-hidden
                      />
                    </>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </GlassCard>
      </section>

      {/* ─── RISK LEVEL LEGEND ─── */}
      <section aria-labelledby="risk-title">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-5 w-5 text-jabar-gold" aria-hidden />
          <h2 id="risk-title" className="text-lg font-bold tracking-tight">
            Tingkat Risiko &amp; SLA
          </h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground max-w-3xl">
          Setiap laporan ditentukan tingkat risikonya. SLA (Service Level
          Agreement) adalah batas waktu penanganan sejak laporan diterima.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {RISK_ORDER.map((k) => {
            const r = RISK_LEVELS[k];
            return (
              <GlassCard key={k} className="p-4">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-2xl" aria-hidden>
                    {r.emoji}
                  </span>
                  <span
                    className="text-xs font-bold uppercase tracking-wide"
                    style={{ color: r.color }}
                  >
                    {r.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  SLA{" "}
                  <span className="font-bold text-foreground">
                    {r.slaHours} jam
                  </span>{" "}
                  penanganan
                </p>
              </GlassCard>
            );
          })}
        </div>
      </section>

      {/* ─── LOGIN CTA ─── */}
      <section aria-labelledby="login-cta-title" className="pt-2">
        <GlassCard className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2
              id="login-cta-title"
              className="text-base font-bold tracking-tight"
            >
              Anda staf Satpol PP Jabar?
            </h2>
            <p className="text-sm text-muted-foreground">
              Masuk untuk mengakses inbox operator atau dashboard pimpinan.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setView("login")}
            className="text-jabar-gold hover:bg-jabar-gold/10 hover:text-jabar-gold"
          >
            Masuk Operator/Pimpinan
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </GlassCard>
      </section>
    </div>
  );
}
