import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";

export async function GET() {
  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      DATABASE_URL: process.env.DATABASE_URL
        ? { defined: true, prefix: process.env.DATABASE_URL.slice(0, 25), startsLibsql: process.env.DATABASE_URL.startsWith("libsql://") }
        : { defined: false },
      DATABASE_AUTH_TOKEN: process.env.DATABASE_AUTH_TOKEN
        ? { defined: true, length: process.env.DATABASE_AUTH_TOKEN.length }
        : { defined: false },
    },
    tests: {} as Record<string, unknown>,
  };

  const url = process.env.DATABASE_URL as string;
  const token = process.env.DATABASE_AUTH_TOKEN ?? undefined;

  // Test 1: raw libsql (known OK)
  try {
    const libsql = createClient({ url, authToken: token });
    const res = await libsql.execute("SELECT 1 as test");
    result.tests.rawLibsql = { ok: true, result: JSON.stringify(res.rows) };
  } catch (e) {
    result.tests.rawLibsql = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // Test 2: Prlesia + adapter, dibuat LANGSUNG di sini (bypass db.ts)
  try {
    const { PrismaClient } = await import("@prisma/client");
    const { PrismaLibSQL } = await import("@prisma/adapter-libsql");
    const libsql = createClient({ url, authToken: token });
    const adapter = new PrismaLibSQL(libsql);
    const prisma = new PrismaClient({ adapter, log: ["error", "warn"] });
    const count = await prisma.user.count();
    result.tests.prismaInlineAdapter = { ok: true, userCount: count };
    await prisma.$disconnect();
  } catch (e) {
    result.tests.prismaInlineAdapter = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // Test 3: Prlesia via db.ts (jalur asli aplikasi)
  try {
    const { db } = await import("@/lib/db");
    const count = await db.user.count();
    result.tests.prismaViaDb = { ok: true, userCount: count };
  } catch (e) {
    result.tests.prismaViaDb = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  return new NextResponse(JSON.stringify(result, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
