import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  // Read env at creation time (which is QUERY time, not module-load time)
  // — avoids Vercel cold-start env injection timing issues.
  const url = process.env.DATABASE_URL;
  const token = process.env.DATABASE_AUTH_TOKEN;
  const log = ["error", "warn"] as const;

  if (!url) {
    throw new Error(
      "[db.ts] DATABASE_URL env var is not set. " +
        "Set it in Vercel → Settings → Environment Variables (value = your Turso libsql:// URL, environment = Production)."
    );
  }

  // Turso / libSQL (production on Vercel) — use driver adapter to bypass
  // the Rust query engine (which can't read Vercel serverless env vars).
  if (
    url.startsWith("libsql://") ||
    url.startsWith("wss://") ||
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    const libsql = createClient({ url, authToken: token ?? undefined });
    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter, log: [...log] });
  }

  // Local development — SQLite file
  if (url.startsWith("file:")) {
    return new PrismaClient({ log: [...log] });
  }

  throw new Error(
    `[db.ts] DATABASE_URL has unexpected format: "${url.slice(0, 30)}...". Expected libsql://... or file:...`
  );
}

/**
 * Lazy PrismaClient — created on first property access (i.e. first query),
 * NOT at module load. This ensures process.env is fully populated on Vercel
 * serverless cold starts before we read DATABASE_URL.
 */
function getDb(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// Proxy that lazily resolves the real PrismaClient on first access.
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getDb();
    const value = Reflect.get(client, prop);
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
}) as PrismaClient;
