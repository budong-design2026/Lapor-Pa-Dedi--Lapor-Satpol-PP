"use client";

import * as React from "react";
import { Sun, Moon, LogOut, KeyRound, LogIn } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  APP_SHORT,
  TAGLINE,
  PIMPINAN_ROLES,
} from "@/lib/constants";
import { LogoSatpolpp } from "@/components/shared/logo-satpolpp";
import { GoldShimmerText } from "@/components/shared/gold-shimmer-text";
import { RoleBadge } from "@/components/shared/role-badge";
import { ChangePasswordDialog } from "@/components/shared/change-password-dialog";

/**
 * SiteHeader — sticky top-0 z-50, glass bg.
 * Left: logo + APP_SHORT (gold-shimmer) + tagline.
 * Right: staff controls (RoleBadge + bidang + Ganti Password + Keluar)
 *        OR masyarakat "Masuk Operator/Pimpinan" button + theme toggle.
 * Mobile: logo + theme + (menu button optional, omitted for now).
 */
function isStaffRole(role?: string | null) {
  if (!role) return false;
  return role === "OPERATOR" || PIMPINAN_ROLES.includes(role);
}

export function SiteHeader() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const setView = useAppStore((s) => s.setView);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const { toast } = useToast();

  const [chpwdOpen, setChpwdOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      toast({
        title: "Berhasil keluar",
        description: "Sesi telah diakhiri.",
      });
    } catch (err) {
      const apiErr = err as ApiError;
      // Even if logout API fails, clear local session.
      setUser(null);
      toast({
        title: "Sesi dihapus lokal",
        description: apiErr?.message ?? "Logout API gagal.",
        variant: "destructive",
      });
    } finally {
      setLoggingOut(false);
    }
  };

  const isStaff = isStaffRole(user?.role);

  return (
    <header
      className="sticky top-0 z-50 glass-card border-b border-white/10 rounded-none"
      role="banner"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 sm:h-16 items-center justify-between gap-3">
          {/* Left: logo + title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <LogoSatpolpp height={36} />
            <div className="min-w-0 flex flex-col">
              <div className="flex items-center gap-2">
                <GoldShimmerText as="span" className="text-base sm:text-lg">
                  {APP_SHORT}
                </GoldShimmerText>
              </div>
              <p className="hidden sm:block text-[10px] text-muted-foreground leading-tight truncate max-w-[40ch]">
                {TAGLINE}
              </p>
            </div>
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {isStaff && user ? (
              <>
                <div className="hidden md:flex flex-col items-end leading-tight">
                  <RoleBadge role={user.role} />
                  {user.bidangName ? (
                    <span className="text-[10px] text-muted-foreground">
                      {user.bidangName}
                    </span>
                  ) : null}
                  <span className="text-[10px] text-muted-foreground/70">
                    {user.email}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setChpwdOpen(true)}
                  className="hidden sm:inline-flex"
                  aria-label="Ganti password"
                >
                  <KeyRound className="size-4" aria-hidden />
                  <span className="hidden lg:inline">Ganti Password</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  aria-label="Keluar"
                >
                  <LogOut className="size-4" aria-hidden />
                  <span className="hidden lg:inline">
                    {loggingOut ? "Keluar…" : "Keluar"}
                  </span>
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setView("login")}
                aria-label="Masuk sebagai operator atau pimpinan"
              >
                <LogIn className="size-4" aria-hidden />
                <span className="hidden sm:inline">Masuk Operator/Pimpinan</span>
                <span className="sm:hidden">Masuk</span>
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Aktifkan mode terang"
                  : "Aktifkan mode gelap"
              }
              title={theme === "dark" ? "Mode terang" : "Mode gelap"}
              className="text-foreground hover:text-jabar-gold"
            >
              {theme === "dark" ? (
                <Sun className="size-4" aria-hidden />
              ) : (
                <Moon className="size-4" aria-hidden />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile-only sub-header: show staff info compactly */}
      {isStaff && user ? (
        <div className="sm:hidden border-t border-white/5 px-4 py-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <RoleBadge role={user.role} />
              <span className="text-[10px] text-muted-foreground truncate">
                {user.bidangName ?? user.email}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setChpwdOpen(true)}
              className="h-7 px-2 text-xs"
              aria-label="Ganti password"
            >
              <KeyRound className="size-3.5" aria-hidden />
              Password
            </Button>
          </div>
        </div>
      ) : null}

      <ChangePasswordDialog open={chpwdOpen} onOpenChange={setChpwdOpen} />

      <span className="sr-only">Header aplikasi {APP_SHORT}</span>
    </header>
  );
}
