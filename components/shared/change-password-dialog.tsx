"use client";

import * as React from "react";
import { KeyRound, Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";

/**
 * ChangePasswordDialog — staff self-service password change.
 * Submits POST /api/auth/change-password.
 * On 401 with "Password lama salah" highlights the current-password field.
 * On 401 with session-expiry message: setUser(null) + setView("login").
 */
export interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const EMPTY: FormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: ChangePasswordDialogProps) {
  const { toast } = useToast();
  const setUser = useAppStore((s) => s.setUser);
  const setView = useAppStore((s) => s.setView);

  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = React.useState(false);
  const [fieldError, setFieldError] = React.useState<string | null>(null);

  // Reset on close
  React.useEffect(() => {
    if (!open) {
      setForm(EMPTY);
      setFieldError(null);
      setSubmitting(false);
    }
  }, [open]);

  const update = (key: keyof FormState, val: string) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (key === "currentPassword" && fieldError) setFieldError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setFieldError(null);

    if (form.newPassword.length < 8) {
      setFieldError("newPassword");
      toast({
        title: "Password baru minimal 8 karakter",
        variant: "destructive",
      });
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setFieldError("confirmPassword");
      toast({
        title: "Konfirmasi password tidak cocok",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      toast({
        title: "Password berhasil diubah",
        description: "Silakan login kembali dengan password baru.",
      });
      onOpenChange(false);
    } catch (err) {
      const apiErr = err as ApiError;
      const msg = String(apiErr?.message ?? "").toLowerCase();

      if (apiErr?.status === 401) {
        if (msg.includes("lama") || msg.includes("current") || msg.includes("salah")) {
          setFieldError("currentPassword");
          toast({
            title: "Password lama salah",
            variant: "destructive",
          });
        } else {
          // Session expired
          toast({
            title: "Sesi berakhir",
            description: "Silakan login kembali.",
            variant: "destructive",
          });
          setUser(null);
          setView("login");
          onOpenChange(false);
        }
      } else {
        toast({
          title: "Gagal mengubah password",
          description: apiErr?.message ?? "Terjadi kesalahan",
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <KeyRound className="size-5 text-jabar-gold" aria-hidden />
            Ganti Password
          </DialogTitle>
          <DialogDescription>
            Untuk keamanan akun, gunakan password yang kuat (min. 8 karakter).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="chpwd-current">Password Lama</Label>
            <Input
              id="chpwd-current"
              type="password"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={(e) => update("currentPassword", e.target.value)}
              required
              aria-invalid={fieldError === "currentPassword"}
              disabled={submitting}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="chpwd-new">Password Baru</Label>
            <Input
              id="chpwd-new"
              type="password"
              autoComplete="new-password"
              value={form.newPassword}
              onChange={(e) => update("newPassword", e.target.value)}
              required
              minLength={8}
              aria-invalid={fieldError === "newPassword"}
              disabled={submitting}
            />
            <p className="text-[11px] text-muted-foreground">
              Minimal 8 karakter.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="chpwd-confirm">Konfirmasi Password Baru</Label>
            <Input
              id="chpwd-confirm"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => update("confirmPassword", e.target.value)}
              required
              minLength={8}
              aria-invalid={fieldError === "confirmPassword"}
              disabled={submitting}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              className="bg-jabar-gold text-background hover:bg-jabar-gold/90"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Menyimpan…
                </>
              ) : (
                <>
                  <KeyRound className="size-4" aria-hidden />
                  Simpan Password
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
