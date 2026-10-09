import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Yeuh Pa Dedi, yeuh SatpolPP Jabar, aya pelanggaran !!!",
  description:
    "Aplikasi Pengaduan Trantibumlinmas Masyarakat Jawa Barat. Lapor pelanggaran, lacak status, transparansi publik. Satpol PP Provinsi Jawa Barat.",
  keywords: [
    "Satpol PP Jabar",
    "Pengaduan Masyarakat",
    "Trantibumlinmas",
    "Jawa Barat",
    "Yeuh Pa Dedi",
    "Budong_production2026",
  ],
  authors: [{ name: "Satpol PP Provinsi Jawa Barat" }],
  applicationName: "Yeuh Satpol!",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/logo-satpolpp.png", sizes: "108x138", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "Yeuh Pa Dedi, yeuh SatpolPP Jabar, aya pelanggaran !!!",
    description:
      "Aplikasi Pengaduan Trantibumlinmas Masyarakat Jawa Barat — Lapor pelanggaran, lacak status, transparansi publik.",
    siteName: "Yeuh Satpol!",
    type: "website",
    locale: "id_ID",
  },
  twitter: {
    card: "summary_large_image",
    title: "Yeuh Satpol! — Pengaduan Trantibumlinmas Jabar",
    description: "Aplikasi pengaduan masyarakat Satpol PP Provinsi Jawa Barat.",
  },
};

export const viewport: Viewport = {
  themeColor: "#060912",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Yeuh Satpol!" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="top-center" richColors />
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); }); }`,
          }}
        />
      </body>
    </html>
  );
}
