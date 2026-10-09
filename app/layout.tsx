import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Yeuh Pa Dedi, yeuh SatpolPP Jabar, aya pelanggaran !!!",
  description: "Aplikasi Pengaduan Trantibumlinmas Masyarakat Jawa Barat. Satpol PP Provinsi Jawa Barat.",
  applicationName: "Yeuh Satpol!",
  manifest: "/manifest.json",
  icons: { icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }] },
};

export const viewport: Viewport = { themeColor: "#060912", width: "device-width", initialScale: 1, maximumScale: 5 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Yeuh Satpol!" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}>
        {children}
        <Toaster />
        <SonnerToaster position="top-center" richColors />
        <script dangerouslySetInnerHTML={{ __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); }); }` }} />
      </body>
    </html>
  );
}
