"use client";

import * as React from "react";
import { KeyRound, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";

/**
 * ChangePasswordDialog — modal form for the logged-in staff user to change
 * their own password. Posts to `/api/auth/change-password` (auth required).
 *
 * Validation:
 * - newPassword: min 8 char (matches backend rule).
 * - confirmPassword: must equal newPassword.
 *
 * Server-error mapping:
 * - 401 "Sesi berakhir" → setUser(null) + setView('login') + close dialog.
 * - 401 "Password lama salah" → highlight the "Password Lama" field inline.
 * - 400 "minimal 8 karakter" → highlight the "Password Baru" field inline.
 * - Other → toast.error(err.message) + inline server error banner.
 *
 * Styling: `glass-card` class on DialogContent (midnight navy glassmorphism).
 * Submit button: gold (`bg-jabar-gold text-background`). Cancel: ghost.
 */
interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MIN_PASSWORD_LENGTH = 8;

interface FieldErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: ChangePasswordDialogProps) {
  const setUser = useAppStore((s) => s.setUser);
  const setView = useAppStore((s) => s.setView);

  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [busy, setBusy] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  // Reset all state whenever the dialog closes (clears fields & errors
  // so the next open is fresh — also avoids leaking the typed password).
  React.useEffect(() => {
    if (!open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setErrors({});
      setServerError(null);
      setBusy(false);
    }
  }, [open]);

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (!currentPassword) e.currentPassword = "Password lama wajib diisi";
    if (newPassword.length < MIN_PASSWORD_LENGTH)
      e.newPassword = `Password baru minimal ${MIN_PASSWORD_LENGTH} karakter`;
    if (!confirmPassword) e.confirmPassword = "Konfirmasi password wajib diisi";
    else if (confirmPassword !== newPassword)
      e.confirmPassword = "Konfirmasi tidak cocok dengan password baru";
    return e;
  }

  // Re-validate a single field on blur so the user gets immediate feedback
  // after they leave the input.
  function onFieldBlur(name: keyof FieldErrors) {
    const v = validate();
    setErrors((prev) => ({ ...prev, [name]: v[name] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setServerError(null);

    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) return;

    setBusy(true);
    try {
      await apiFetch<{ ok: boolean; message?: string }>(
        "/api/auth/change-password",
        {
          method: "POST",
          body: JSON.stringify({ currentPassword, newPassword }),
        }
      );
      toast.success("Password berhasil diubah");
      onOpenChange(false);
    } catch (err) {
      const apiErr = err as ApiError;
      const msg = apiErr?.message ?? "Gagal mengubah password";

      // 401 "Sesi berakhir, silakan masuk lagi" → force logout + login view.
      if (apiErr?.status === 401 && /sesi berakhir/i.test(msg)) {
        toast.error("Sesi berakhir, silakan masuk lagi");
        setUser(null);
        setView("login");
        onOpenChange(false);
        return;
      }

      // 401 "Password lama salah" → highlight the Password Lama field.
      if (apiErr?.status === 401 && /password lama/i.test(msg)) {
        setErrors((prev) => ({ ...prev, currentPassword: msg }));
        setServerError(msg);
        toast.error(msg);
        return;
      }

      // 400 "Password baru minimal 8 karakter" → highlight Password Baru field.
      if (apiErr?.status === 400 && /minimal 8 karakter/i.test(msg)) {
        setErrors((prev) => ({ ...prev, newPassword: msg }));
      }

      setServerError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="glass-card border-0 sm:max-w-md"
        aria-describedby="cp-desc"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <KeyRound className="h-5 w-5 text-jabar-gold" aria-hidden />
            Ganti Password
          </DialogTitle>
          <DialogDescription id="cp-desc">
            Demi keamanan akun, gunakan password baru minimal{" "}
            {MIN_PASSWORD_LENGTH} karakter.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* ─── Password Lama ─── */}
          <div className="space-y-1.5">
            <Label htmlFor="cp-current">Password Lama</Label>
            <Input
              id="cp-current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              onBlur={() => onFieldBlur("currentPassword")}
              disabled={busy}
              aria-invalid={!!errors.currentPassword}
              aria-describedby={
                errors.currentPassword ? "cp-current-err" : undefined
              }
            />
            {errors.currentPassword ? (
              <p
                id="cp-current-err"
                className="text-xs text-destructive"
                role="alert"
              >
                {errors.currentPassword}
              </p>
            ) : null}
          </div>

          {/* ─── Password Baru ─── */}
          <div className="space-y-1.5">
            <Label htmlFor="cp-new">Password Baru</Label>
            <Input
              id="cp-new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onBlur={() => onFieldBlur("newPassword")}
              disabled={busy}
              aria-invalid={!!errors.newPassword}
              aria-describedby={errors.newPassword ? "cp-new-err" : undefined}
            />
            {errors.newPassword ? (
              <p
                id="cp-new-err"
                className="text-xs text-destructive"
                role="alert"
              >
                {errors.newPassword}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Minimal {MIN_PASSWORD_LENGTH} karakter.
              </p>
            )}
          </div>

          {/* ─── Konfirmasi Password Baru ─── */}
          <div className="space-y-1.5">
            <Label htmlFor="cp-confirm">Konfirmasi Password Baru</Label>
            <Input
              id="cp-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => onFieldBlur("confirmPassword")}
              disabled={busy}
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={
                errors.confirmPassword ? "cp-confirm-err" : undefined
              }
            />
            {errors.confirmPassword ? (
              <p
                id="cp-confirm-err"
                className="text-xs text-destructive"
                role="alert"
              >
                {errors.confirmPassword}
              </p>
            ) : null}
          </div>

          {serverError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive"
            >
              <AlertCircle
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
                aria-hidden
              />
              <span>{serverError}</span>
            </div>
          ) : null}

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="gap-1.5 bg-jabar-gold text-background hover:bg-jabar-gold/90"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <KeyRound className="h-4 w-4" aria-hidden />
              )}
              {busy ? "Menyimpan…" : "Ganti Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
