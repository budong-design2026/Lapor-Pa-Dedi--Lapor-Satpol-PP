"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Inbox,
  RefreshCw,
  Search,
  Clock,
  AlertTriangle,
  Timer,
  ChevronRight,
  UserRound,
  ImageOff,
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore, type ViewKey } from "@/store/app-store";
import { GlassCard } from "@/components/shared/glass-card";
import { GoldShimmerText } from "@/components/shared/gold-shimmer-text";
import { RoleBadge } from "@/components/shared/role-badge";
import { RiskBadge } from "@/components/shared/risk-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { CategoryIcon } from "@/components/shared/category-icon";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Loading, RowSkeleton } from "@/components/shared/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCategory, RISK_LEVELS } from "@/lib/constants";
import { timeAgo, slaTimeRemaining } from "@/lib/report-helpers";
import { apiFetch, ApiError } from "@/lib/api-client";

// ─── Types (mirror of backend SerializedInboxItem) ─────────────────────────

interface InboxReport {
  id: string;
  ticketNumber: string;
  isAnonymous: boolean;
  reporterName: string;
  reporterPhone: string | null;
  category: string;
  subCategory: string | null;
  description: string;
  address: string;
  kabupaten: string;
  status: string;
  riskLevel: string | null;
  assignedBidangName: string | null;
  slaDeadline: string | null;
  slaRemaining: { ms: number; label: string; overdue: boolean };
  photos: string[];
  photosAfter: string[];
  createdAt: string;
}

interface InboxCounts {
  all: number;
  unverified: number;
  inProgress: number;
  critical: number;
  overdue: number;
}

interface InboxResponse {
  reports: InboxReport[];
  total: number;
  page: number;
  limit: number;
  counts: InboxCounts;
  canSeePii?: boolean;
}

type FilterKey = "all" | "unverified" | "in_progress" | "critical" | "overdue";
type SortKey = "newest" | "oldest" | "risk";

const FILTER_TABS: { key: FilterKey; label: string; countKey: keyof InboxCounts }[] = [
  { key: "all", label: "Semua", countKey: "all" },
  { key: "unverified", label: "Belum Diverifikasi", countKey: "unverified" },
  { key: "in_progress", label: "Diproses", countKey: "inProgress" },
  { key: "critical", label: "Critical", countKey: "critical" },
  { key: "overdue", label: "Overdue", countKey: "overdue" },
];

const POLL_INTERVAL_MS = 15000; // 15 seconds
const PAGE_SIZE = 20;

// ─── View ──────────────────────────────────────────────────────────────────

export function OperatorInboxView() {
  const user = useAppStore((s) => s.user);
  const openReport = useAppStore((s) => s.openReport);
  const setView = useAppStore((s) => s.setView);

  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("newest");
  const [reports, setReports] = React.useState<InboxReport[]>([]);
  const [counts, setCounts] = React.useState<InboxCounts>({
    all: 0,
    unverified: 0,
    inProgress: 0,
    critical: 0,
    overdue: 0,
  });
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [sessionExpired, setSessionExpired] = React.useState(false);

  // Debounced search input
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  // Reset to page 1 when filter/search/sort changes
  React.useEffect(() => {
    setPage(1);
  }, [filter, debouncedSearch, sort]);

  // Debounce search input (300ms)
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch the inbox (used both for polling and manual refresh)
  const fetchInbox = React.useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        if (reports.length === 0) setLoading(true);
        else setRefreshing(true);
      }
      setError(null);
      try {
        const params = new URLSearchParams({
          filter,
          search: debouncedSearch,
          sort,
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        const res = await apiFetch<InboxResponse>(
          `/api/operator/inbox?${params.toString()}`
        );
        setReports(res.reports);
        setCounts(res.counts);
        setTotal(res.total);
        setLastUpdated(new Date());
        setSessionExpired(false);
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 401) {
          setSessionExpired(true);
          toast.error("Sesi berakhir, silakan masuk lagi");
        } else if (err instanceof ApiError && err.status === 403) {
          setSessionExpired(true);
          toast.error("Akses khusus Operator");
        } else {
          const msg = err instanceof ApiError ? err.message : "Gagal memuat inbox";
          setError(msg);
          if (!opts?.silent) toast.error(msg);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filter, debouncedSearch, sort, page, reports.length]
  );

  // Initial fetch + on dependency change
  React.useEffect(() => {
    void fetchInbox();
  }, [filter, debouncedSearch, sort, page, fetchInbox]);

  // Polling: 15s interval, re-fetch silently (no loading spinner, no error toasts)
  React.useEffect(() => {
    const id = setInterval(() => {
      void fetchInbox({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchInbox]);

  function handleRefresh() {
    void fetchInbox();
  }

  function handleLoadMore() {
    setPage((p) => p + 1);
  }

  function handleClearFilters() {
    setFilter("all");
    setSearch("");
    setSort("newest");
    setPage(1);
  }

  // ─── Session expired — show login CTA ───
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
          action={{ label: "Masuk lagi", onClick: () => setView("login" as ViewKey) }}
        />
      </motion.div>
    );
  }

  const hasMore = total > page * PAGE_SIZE;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="pb-6 space-y-5"
    >
      {/* ─── Top bar ─── */}
      <header className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              <GoldShimmerText as="span">Inbox Laporan</GoldShimmerText>
            </h1>
            <p className="text-sm text-muted-foreground">
              Antrian verifikasi &amp; penugasan — diperbarui otomatis setiap 15 detik.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <RoleBadge role={user?.role} />
            {user?.bidangName ? (
              <Badge variant="outline" className="text-muted-foreground">
                {user.bidangName}
              </Badge>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Segarkan inbox"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                aria-hidden
              />
              Segarkan
            </Button>
          </div>
        </div>

        {lastUpdated ? (
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <Clock className="h-3 w-3" aria-hidden />
            Terakhir diperbarui: <time dateTime={lastUpdated.toISOString()}>{timeAgo(lastUpdated)}</time>
          </p>
        ) : null}
      </header>

      {/* ─── Quick stats strip ─── */}
      <section
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        aria-label="Statistik inbox"
      >
        <StatCard label="Antrian Hari Ini" value={counts.all} accent="gold" icon={Inbox} />
        <StatCard
          label="Belum Diverifikasi"
          value={counts.unverified}
          accent="amber"
          icon={AlertTriangle}
        />
        <StatCard
          label="Critical Aktif"
          value={counts.critical}
          accent="red"
          icon={AlertTriangle}
        />
        <StatCard
          label="Overdue"
          value={counts.overdue}
          accent="red"
          icon={Timer}
        />
      </section>

      {/* ─── Filter tabs ─── */}
      <GlassCard className="p-3 sm:p-4 space-y-3">
        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as FilterKey)}
          aria-label="Filter inbox"
        >
          <TabsList className="flex w-full flex-wrap h-auto gap-1 bg-transparent p-0">
            {FILTER_TABS.map((t) => (
              <TabsTrigger
                key={t.key}
                value={t.key}
                className="data-[state=active]:bg-jabar-gold/15 data-[state=active]:text-jabar-gold gap-1.5"
              >
                <span>{t.label}</span>
                <Badge
                  variant="secondary"
                  className="ml-1 h-4 px-1 text-[10px] font-mono"
                >
                  {counts[t.countKey] ?? 0}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* ─── Search + Sort ─── */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari tiket / lokasi / deskripsi…"
              aria-label="Cari laporan"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="sort-select" className="sr-only">
              Urutkan
            </label>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger id="sort-select" className="w-full sm:w-40">
                <SelectValue placeholder="Urutkan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Terbaru</SelectItem>
                <SelectItem value="oldest">Terlama</SelectItem>
                <SelectItem value="risk">Risiko tertinggi</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </GlassCard>

      {/* ─── List ─── */}
      <section aria-label="Daftar laporan" className="space-y-3">
        {loading ? (
          <RowSkeleton count={5} />
        ) : error ? (
          <EmptyState
            icon={AlertTriangle}
            title="Gagal memuat inbox"
            description={error}
            action={{ label: "Coba lagi", onClick: handleRefresh }}
          />
        ) : reports.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Tidak ada laporan"
            description={
              filter === "all"
                ? "Belum ada laporan masuk pada filter ini."
                : "Tidak ada laporan pada filter ini. Coba ganti filter atau kata kunci pencarian."
            }
            action={
              filter !== "all" || search
                ? { label: "Reset filter", onClick: handleClearFilters }
                : undefined
            }
          />
        ) : (
          <>
            {reports.map((r) => (
              <InboxReportCard
                key={r.id}
                report={r}
                onReview={() => openReport(r.id)}
              />
            ))}
            {hasMore ? (
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loading}
                >
                  Muat Lebih Banyak
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ) : null}
            <p className="text-center text-xs text-muted-foreground pt-2">
              Menampilkan {reports.length} dari {total} laporan
            </p>
          </>
        )}
      </section>
    </motion.div>
  );
}

// ─── InboxReportCard ───────────────────────────────────────────────────────

function InboxReportCard({
  report,
  onReview,
}: {
  report: InboxReport;
  onReview: () => void;
}) {
  const category = getCategory(report.category);
  const isCritical = report.riskLevel === "CRITICAL";
  const sla = report.slaRemaining;

  // SLA color: red if overdue, amber if <25% remaining, green otherwise
  let slaColor = "#22c55e"; // green
  if (sla.overdue) slaColor = "#ef4444";
  else if (sla.ms > 0) {
    const totalSlaMs =
      (RISK_LEVELS[(report.riskLevel as keyof typeof RISK_LEVELS) ?? "LOW"]
        ?.slaHours ?? 72) *
      60 *
      60 *
      1000;
    const remainingFrac = totalSlaMs > 0 ? sla.ms / totalSlaMs : 1;
    if (remainingFrac < 0.25) slaColor = "#f9a825";
  }

  const thumbnail = report.photos?.[0] ?? null;

  return (
    <GlassCard
      className={`p-4 sm:p-5 transition hover:shadow-lg ${
        isCritical ? "border-l-4 border-l-red-500 critical-pulse" : ""
      }`}
    >
      <article className="space-y-3" aria-label={`Laporan ${report.ticketNumber}`}>
        {/* Row 1 — ticket / status / risk / SLA */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-bold text-jabar-gold">
            {report.ticketNumber}
          </span>
          <StatusBadge status={report.status} />
          <RiskBadge riskLevel={report.riskLevel} />
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold ml-auto"
            style={{ color: slaColor }}
            aria-label={`SLA ${sla.overdue ? "terlewat" : sla.label}`}
          >
            <Clock className="h-3 w-3" aria-hidden />
            {sla.overdue ? `Overdue ${sla.label}` : `SLA ${sla.label}`}
          </span>
        </div>

        {/* Row 2 — category + kabupaten */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-jabar-gold/15 text-jabar-gold">
              <CategoryIcon code={report.category} className="h-4 w-4" />
            </div>
            <span className="font-semibold">{category?.name ?? report.category}</span>
          </div>
          {report.subCategory ? (
            <span className="text-xs text-muted-foreground">
              · {report.subCategory}
            </span>
          ) : null}
          <span className="text-xs text-muted-foreground ml-auto">
            {report.kabupaten}
          </span>
        </div>

        {/* Row 3 — description + thumbnail */}
        <div className="flex items-start gap-3">
          <p className="text-sm text-foreground/80 line-clamp-2 flex-1">
            {report.description}
          </p>
          {thumbnail ? (
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border/60 bg-background">
              <img
                src={thumbnail}
                alt={`Bukti ${report.ticketNumber}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="h-12 w-12 shrink-0 flex items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground">
              <ImageOff className="h-4 w-4" aria-hidden />
            </div>
          )}
        </div>

        {/* Row 4 — created / reporter / action */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
          <span className="text-xs text-muted-foreground">
            {timeAgo(report.createdAt)}
          </span>
          {report.isAnonymous ? (
            <Badge variant="secondary" className="text-muted-foreground">
              <UserRound className="h-3 w-3 mr-1" aria-hidden />
              Anonim
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">
              · {report.reporterName}
            </span>
          )}
          {report.assignedBidangName ? (
            <span className="text-xs text-muted-foreground">
              · {report.assignedBidangName}
            </span>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="default"
            className="ml-auto bg-jabar-gold text-background hover:bg-jabar-gold/90 font-bold"
            onClick={onReview}
            aria-label={`Tinjau laporan ${report.ticketNumber}`}
          >
            Tinjau
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </article>
    </GlassCard>
  );
}
