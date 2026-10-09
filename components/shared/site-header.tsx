"use client";

import * as React from "react";
import { Sun, Moon, LogOut, ShieldCheck, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoSatpolpp } from "@/components/shared/logo-satpolpp";
import { RoleBadge } from "@/components/shared/role-badge";
import { GoldShimmerText } from "@/components/shared/gold-shimmer-text";
import { ChangePasswordDialog } from "@/components/shared/change-password-dialog";
import { useAppStore } from "@/store/app-store";
import { PIMPINAN_ROLES } from "@/lib/constants";
import { apiFetch } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * SiteHeader — sticky top, glass background.
 *
 * Left: SatpolPP horizontal logo (aspect 182×44, NOT rounded) +
 *       "Yeuh Satpol!" name with gold tagline subtitle.
 * Right (desktop): role/bidang/Keluar for staff, "Masuk Operator/Pimpinan"
 *                  for masyarakat, plus theme toggle.
 * Right (mobile): logo + theme toggle only — nav lives in <BottomNav />.
 */
function isStaffRole(role: string | undefined): boolean {
  if (!role) return false;
  return role === "OPERATOR" || role.startsWith("PIMPINAN");
}

export function SiteHeader() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const setView = useAppStore((s) => s.setView);
  const setArea = useAppStore((s) => s.setArea);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);

  const [busy, setBusy] = React.useState(false);
  const [pwdOpen, setPwdOpen] = React.useState(false);

  const staff = isStaffRole(user?.role);

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setArea("masyarakat");
      toast({ title: "Berhasil keluar", description: "Sesi anda telah ditutup." });
    } catch (err) {
      toast({
        title: "Gagal keluar",
        description: err instanceof Error ? err.message : "Coba lagi nanti.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <header
      role="banner"
      className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        {/* Left: logo + name */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setView("home");
          }}
          className="flex items-center gap-3 min-w-0"
          aria-label="Yeuh Satpol! — Beranda"
        >
          <LogoSatpolpp />
          <div className="hidden sm:flex flex-col leading-tight min-w-0">
            <GoldShimmerText as="span" className="text-lg">
              Yeuh Satpol!
            </GoldShimmerText>
            <span className="text-[11px] text-muted-foreground truncate">
              Pengaduan Trantibumlinmas Jabar
            </span>
          </div>
        </a>

        {/* Right: desktop-only area switcher + theme toggle */}
        <div className="flex items-center gap-2">
          {staff ? (
            <>
              {/* Mobile: icon-only Ganti Password shortcut */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setPwdOpen(true)}
                className="h-9 w-9 sm:hidden"
                aria-label="Ganti Password"
              >
                <KeyRound className="h-4 w-4 text-jabar-gold" aria-hidden />
                <span className="sr-only">Ganti Password</span>
              </Button>

              <div className="hidden sm:flex items-center gap-2">
                <RoleBadge role={user?.role} />
                {user?.bidangName ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-jabar-gold" aria-hidden />
                    <span className="max-w-[180px] truncate">
                      {user.bidangName}
                    </span>
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPwdOpen(true)}
                  className="gap-1.5"
                >
                  <KeyRound className="h-3.5 w-3.5 text-jabar-gold" aria-hidden />
                  Ganti Password
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  disabled={busy}
                  className="gap-1.5"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
                  Keluar
                </Button>
              </div>

              <ChangePasswordDialog
                open={pwdOpen}
                onOpenChange={setPwdOpen}
              />
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setView("login")}
              className="hidden sm:inline-flex gap-1.5 border-jabar-gold/40 text-jabar-gold hover:bg-jabar-gold/10"
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Masuk Operator/Pimpinan
            </Button>
          )}

          {/* Theme toggle — visible on all sizes */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
            aria-pressed={theme === "light"}
            className={cn("h-9 w-9")}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 text-jabar-gold" aria-hidden />
            ) : (
              <Moon className="h-4 w-4 text-jabar-gold" aria-hidden />
            )}
            <span className="sr-only">Ganti tema</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
