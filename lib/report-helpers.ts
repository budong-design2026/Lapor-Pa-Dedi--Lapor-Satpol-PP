// lib/report-helpers.ts — ticket gen, SLA, timeAgo, JSON array helpers
import { RISK_LEVELS } from "./constants";

export function generateTicketNumber(): string {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `YP-${ymd}-${rand}`;
}

export function calculateSlaDeadline(riskLevel: string, from: Date = new Date()): Date {
  const cfg = RISK_LEVELS[riskLevel as keyof typeof RISK_LEVELS];
  if (!cfg) return new Date(from.getTime() + 72 * 60 * 60 * 1000);
  return new Date(from.getTime() + cfg.slaHours * 60 * 60 * 1000);
}

export function parseArray<T = string>(json: string | null | undefined): T[] {
  if (!json) return [];
  try { const v = JSON.parse(json); return Array.isArray(v) ? (v as T[]) : []; } catch { return []; }
}
export function stringifyArray(arr: string[]): string { return JSON.stringify(arr ?? []); }

export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec} detik lalu`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} hari lalu`;
  return `${Math.floor(day / 30)} bulan lalu`;
}

export function slaTimeRemaining(deadline: Date | string | null | undefined): { ms: number; label: string; overdue: boolean; } {
  if (!deadline) return { ms: 0, label: "-", overdue: false };
  const d = typeof deadline === "string" ? new Date(deadline) : deadline;
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return { ms, label: "Overdue", overdue: true };
  const hr = Math.floor(ms / (60 * 60 * 1000));
  const min = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hr > 0) return { ms, label: `${hr}j ${min}m`, overdue: false };
  return { ms, label: `${min}m`, overdue: false };
}
