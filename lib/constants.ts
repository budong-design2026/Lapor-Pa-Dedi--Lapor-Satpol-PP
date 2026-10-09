// lib/constants.ts — Yeuh Satpol! reference data

// 17 Ketertiban (dari Katalog Perda Jabar) + kategori khusus pengaduan
export interface Category {
  code: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  perdaRef?: string;
}

export const CATEGORIES: Category[] = [
  {
    code: "TATA_RUANG",
    name: "Tertib Tata Ruang",
    description: "Penataan ruang, zonasi, penggunaan lahan",
    icon: "Map",
    perdaRef: "Perda No. 13/2018",
  },
  {
    code: "JALAN",
    name: "Tertib Jalan",
    description: "Penggunaan badan jalan, trotoar, tata tertib lalu lintas",
    icon: "Route",
    perdaRef: "Perda No. 13/2018",
  },
  {
    code: "PERHUBUNGAN",
    name: "Tertib Perhubungan",
    description: "Terminal, angkutan, stasiun, pelabuhan",
    icon: "Bus",
    perdaRef: "Perda No. 13/2018",
  },
  {
    code: "SUNGAI",
    name: "Tertib Sungai, Irigasi, Situ & Pinggir Pantai",
    description: "Bantaran sungai, situ, kawasan pantai",
    icon: "Waves",
    perdaRef: "Perda No. 13/2018",
  },
  {
    code: "LINGKUNGAN",
    name: "Tertib Lingkungan",
    description: "Sampah, polusi, limbah, kebisingan",
    icon: "Leaf",
    perdaRef: "Perda No. 13/2018",
  },
  {
    code: "TEMPAT_USAHA",
    name: "Tertib Tempat Usaha",
    description: "Kios, lapak, PKL, pasar",
    icon: "Store",
    perdaRef: "Perda No. 13/2018",
  },
  {
    code: "BANGUNAN",
    name: "Tertib Bangunan",
    description: "IMB, struktur, tata bangunan",
    icon: "Building2",
    perdaRef: "Perda No. 13/2018",
  },
  {
    code: "SOSIAL",
    name: "Tertib Sosial",
    description: "Gelandangan, pengemis, PMKS",
    icon: "Users",
    perdaRef: "Perda No. 13/2018",
  },
  {
    code: "KESEHATAN",
    name: "Tertib Kesehatan",
    description: "Tempat umum, sanitasi, kesehatan masyarakat",
    icon: "HeartPulse",
    perdaRef: "Perda No. 13/2018",
  },
  {
    code: "BENCANA",
    name: "Tertib Keadaan Bencana",
    description: "Mitigasi, tanggap bencana, darurat",
    icon: "AlertTriangle",
    perdaRef: "Perda No. 13/2018",
  },
  {
    code: "KAWASAN_STRATEGIS",
    name: "Tertib Kawasan Strategis Provinsi",
    description: "Kawasan strategis provinsi Jabar",
    icon: "ShieldCheck",
    perdaRef: "Perda No. 13/2018",
  },
  {
    code: "KEHUTANAN",
    name: "Tertib Kehutanan",
    description: "Kawasan hutan, pembalakan liar",
    icon: "TreePine",
    perdaRef: "Perda No. 13/2018",
  },
  {
    code: "PERIKANAN",
    name: "Tertib Pengelolaan Perikanan",
    description: "Pesisir, perikanan tangkap, budidaya",
    icon: "Fish",
    perdaRef: "Perda No. 13/2018",
  },
  {
    code: "ESDM",
    name: "Tertib Energi & Sumber Daya Mineral",
    description: "Pertambangan, mineral, energi",
    icon: "Zap",
    perdaRef: "Perda No. 13/2018",
  },
  {
    code: "ASET",
    name: "Tertib Aset",
    description: "Aset daerah, barang milik daerah",
    icon: "Landmark",
    perdaRef: "Perda No. 13/2018",
  },
  {
    code: "ASN",
    name: "Tertib Aparatur Sipil Negara (ASN)",
    description: "Disiplin ASN, absensi, netralitas",
    icon: "Briefcase",
    perdaRef: "Perda No. 13/2018",
  },
  {
    code: "PERIZINAN",
    name: "Tertib Perizinan",
    description: "Perizinan usaha, izin keramaian",
    icon: "FileText",
    perdaRef: "Perda No. 13/2018",
  },
  {
    code: "LAINNYA",
    name: "Lainnya / Pengaduan Khusus",
    description: "Pengaduan masyarakat di luar 17 Ketertiban",
    icon: "MessageCircle",
  },
];

export const getCategory = (code: string) => CATEGORIES.find((c) => c.code === code);

// 27 Kabupaten/Kota Jawa Barat
export const KABUPATEN_KOTA: string[] = [
  "Kota Bandung",
  "Kota Bekasi",
  "Kota Bogor",
  "Kota Cimahi",
  "Kota Cirebon",
  "Kota Depok",
  "Kota Sukabumi",
  "Kota Tasikmalaya",
  "Kota Banjar",
  "Kab. Bandung",
  "Kab. Bandung Barat",
  "Kab. Bekasi",
  "Kab. Bogor",
  "Kab. Cianjur",
  "Kab. Cirebon",
  "Kab. Garut",
  "Kab. Indramayu",
  "Kab. Karawang",
  "Kab. Kuningan",
  "Kab. Majalengka",
  "Kab. Pangandaran",
  "Kab. Purwakarta",
  "Kab. Subang",
  "Kab. Sukabumi",
  "Kab. Sumedang",
  "Kab. Tasikmalaya",
  "Kab. Ciamis",
];

// Struktur Bidang Satpol PP Jabar (sebenarnya)
export interface BidangInfo {
  code: string;
  name: string;
  description: string;
  handles: string[]; // category codes this bidang handles
}

export const BIDANG_LIST: BidangInfo[] = [
  {
    code: "SEKRETARIAT",
    name: "Sekretariat",
    description: "Administrasi, kepegawaian, perencanaan, umum & keuangan",
    handles: ["ASN", "ASET", "PERIZINAN", "LAINNYA"],
  },
  {
    code: "PENEGAKAN_PERDA",
    name: "Bidang Penegakan Perda dan Perkada",
    description: "Penegakan Peraturan Daerah dan Peraturan Kepala Daerah",
    handles: ["JALAN", "TEMPAT_USAHA", "PERIZINAN", "BANGUNAN", "TATA_RUANG"],
  },
  {
    code: "TRANTIBUM",
    name: "Bidang Trantibum",
    description: "Ketenteraman, Ketertiban Umum — bangunan, pesisir, jalan",
    handles: ["BANGUNAN", "SUNGAI", "JALAN", "TATA_RUANG", "BENCANA"],
  },
  {
    code: "PEMBINAAN_MASYARAKAT",
    name: "Bidang Pembinaan Masyarakat dan Aparatur",
    description: "Penyuluhan, pembinaan masyarakat & aparatur",
    handles: ["SOSIAL", "KESEHATAN", "ASN", "LINGKUNGAN"],
  },
  {
    code: "PERLINDUNGAN_MASYARAKAT",
    name: "Bidang Perlindungan Masyarakat",
    description: "Pelindungan masyarakat, tanggap bencana, linmas",
    handles: ["BENCANA", "SOSIAL", "KESEHATAN", "KAWASAN_STRATEGIS"],
  },
];

export const getBidang = (code: string) => BIDANG_LIST.find((b) => b.code === code);

// Risk levels & SLA (in hours)
export const RISK_LEVELS = {
  CRITICAL: { label: "Critical", slaHours: 1, color: "#ef4444", emoji: "🔴" },
  HIGH: { label: "High", slaHours: 4, color: "#f97316", emoji: "🟠" },
  MEDIUM: { label: "Medium", slaHours: 24, color: "#eab308", emoji: "🟡" },
  LOW: { label: "Low", slaHours: 72, color: "#22c55e", emoji: "🟢" },
} as const;

export type RiskLevelKey = keyof typeof RISK_LEVELS;

// Report statuses
export const REPORT_STATUSES = {
  DITERIMA: { label: "Diterima", color: "#3b82f6", step: 0 },
  DIVERIFIKASI: { label: "Diverifikasi", color: "#a855f7", step: 1 },
  DIPROSES: { label: "Diproses", color: "#f9a825", step: 2 },
  SELESAI: { label: "Selesai", color: "#22c55e", step: 3 },
  DITOLAK: { label: "Ditolak", color: "#ef4444", step: -1 },
} as const;

export type ReportStatusKey = keyof typeof REPORT_STATUSES;

// User roles
export const ROLES = {
  MASYARAKAT: "MASYARAKAT",
  OPERATOR: "OPERATOR",
  PIMPINAN_KASATPOL: "PIMPINAN_KASATPOL",
  PIMPINAN_KABID: "PIMPINAN_KABID",
  PIMPINAN_SEKRETARIS: "PIMPINAN_SEKRETARIS",
} as const;

export type RoleKey = keyof typeof ROLES;

export const ROLE_LABELS: Record<string, string> = {
  MASYARAKAT: "Masyarakat",
  OPERATOR: "Operator",
  PIMPINAN_KASATPOL: "Kasatpol PP",
  PIMPINAN_KABID: "Kepala Bidang",
  PIMPINAN_SEKRETARIS: "Sekretaris",
};

export const PIMPINAN_ROLES = [
  "PIMPINAN_KASATPOL",
  "PIMPINAN_KABID",
  "PIMPINAN_SEKRETARIS",
];

// Trademark
export const TRADEMARK = "⚡ Budong_production2026";
export const APP_NAME = "Yeuh Pa Dedi, yeuh SatpolPP Jabar, aya pelanggaran !!!";
export const APP_SHORT = "Yeuh Satpol!";
export const TAGLINE = "Aplikasi Pengaduan Trantibumlinmas Masyarakat Jawa Barat";
// Tugas resmi Satpol PP Prov. Jabar (sesuai Perda No. 13/2018 jo. No. 5/2021)
export const SATPOL_TASKS =
  "Penegakan Perda dan Perkada, Penyelenggaraan Trantibum, dan Perlindungan Masyarakat";
export const LEGAL_BASIS = "Perda No. 13 Tahun 2018 jo. Perda No. 5 Tahun 2021";

// File upload limits (dilonggarkan: 3 foto × 2MB — warga HP gampang upload)
export const MAX_PHOTOS = 3;
export const MAX_PHOTO_SIZE_MB = 2;
export const MAX_VIDEO_SIZE_MB = 5;
