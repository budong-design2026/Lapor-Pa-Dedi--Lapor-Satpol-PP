"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  LogIn,
  Mail,
  KeyRound,
  Loader2,
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  UserCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { GoldShimmerText } from "@/components/shared/gold-shimmer-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore, type SessionUser } from "@/store/app-store";
import { apiFetch, ApiError } from "@/lib/api-client";

export function LoginView() {
  const setView = useAppStore((s) => s.setView);
  const setUser = useAppStore((s) => s.setUser);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState({ email: false, password: false });

  const emailValid = /.+@.+\..+/.test(email.trim());
  const passwordValid = password.length >= 6;
  const formValid = emailValid && passwordValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!formValid) {
      toast.error("Email dan password tidak valid");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ user: SessionUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      setUser(res.user);
      toast.success(`Selamat datang, ${res.user.name}!`);
      // Store auto-routes area+view based on role
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        const msg = "Email atau password salah";
        setError(msg);
        toast.error(msg);
      } else if (err instanceof ApiError && err.status === 400) {
        const msg = "Email dan password wajib diisi";
        setError(msg);
        toast.error(msg);
      } else {
        const msg = err instanceof ApiError ? err.message : "Gagal masuk";
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="pb-6 flex justify-center"
    >
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-jabar-gold/15 text-jabar-gold">
            <ShieldCheck className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            <GoldShimmerText as="span">Masuk Petugas</GoldShimmerText>
          </h1>
          <p className="text-sm text-muted-foreground">
            Khusus Operator &amp; Pimpinan Satpol PP Jabar.
          </p>
        </div>

        <GlassCard className="p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm">
                Email
              </Label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  placeholder="nama@jabar.go.id"
                  autoComplete="email"
                  className="pl-9"
                  aria-invalid={touched.email && !emailValid}
                  required
                />
              </div>
              {touched.email && !emailValid ? (
                <p className="text-xs text-destructive" role="alert">
                  Format email tidak valid
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm">
                Password
              </Label>
              <div className="relative">
                <KeyRound
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pl-9"
                  aria-invalid={touched.password && !passwordValid}
                  required
                />
              </div>
              {touched.password && !passwordValid ? (
                <p className="text-xs text-destructive" role="alert">
                  Password minimal 6 karakter
                </p>
              ) : null}
            </div>

            {error ? (
              <div
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-sm text-destructive flex items-start gap-2"
              >
                <AlertTriangle
                  className="h-4 w-4 shrink-0 mt-0.5"
                  aria-hidden
                />
                <span>{error}</span>
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-jabar-gold text-background hover:bg-jabar-gold/90 font-bold"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <LogIn className="h-4 w-4" aria-hidden />
              )}
              {loading ? "Memproses…" : "Masuk"}
            </Button>
          </form>

        </GlassCard>

        <div className="flex flex-col sm:flex-row gap-2 justify-center text-xs text-muted-foreground">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setView("home")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Kembali ke Beranda
          </Button>
          <span className="hidden sm:inline-flex items-center text-border/60">
            |
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setView("lapor")}
            className="text-muted-foreground hover:text-foreground"
          >
            <UserCircle2 className="h-3.5 w-3.5" aria-hidden />
            Saya warga, ingin lapor
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
