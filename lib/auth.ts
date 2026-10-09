// lib/auth.ts — Custom JWT auth (crypto.scrypt hashing, HS256 JWT, httpOnly cookie)
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "crypto";
import { cookies } from "next/headers";

const SECRET = process.env.NEXTAUTH_SECRET || (process.env.NODE_ENV === "production"
  ? (() => { throw new Error("NEXTAUTH_SECRET environment variable is required in production."); })()
  : "yeuh-satpol-dev-secret-change-me");
const COOKIE_NAME = "yeuh_session";
const SESSION_TTL = 60 * 60 * 24 * 7;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const hashBuf = Buffer.from(hash, "hex");
    const testBuf = scryptSync(password, salt, 64);
    if (hashBuf.length !== testBuf.length) return false;
    return timingSafeEqual(hashBuf, testBuf);
  } catch { return false; }
}

export interface JwtPayload {
  sub: string; email: string; role: string; bidangId?: string | null; name: string; iat: number; exp: number;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

export function signToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = { ...payload, iat: now, exp: now + SESSION_TTL };
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(fullPayload));
  const data = `${header}.${body}`;
  const sig = createHmac("sha256", SECRET).update(data).digest();
  return `${data}.${base64url(sig)}`;
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const [header, body, sig] = token.split(".");
    if (!header || !body || !sig) return null;
    const data = `${header}.${body}`;
    const expectedSig = createHmac("sha256", SECRET).update(data).digest();
    const sigBuf = base64urlDecode(sig);
    if (expectedSig.length !== sigBuf.length) return null;
    if (!timingSafeEqual(expectedSig, sigBuf)) return null;
    const payload = JSON.parse(base64urlDecode(body).toString()) as JwtPayload;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

export async function setSessionCookie(token: string): Promise<void> {
  const c = await cookies();
  c.set(COOKIE_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_TTL });
}
export async function clearSessionCookie(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}
export async function getSessionToken(): Promise<string | undefined> {
  const c = await cookies();
  return c.get(COOKIE_NAME)?.value;
}
export async function getCurrentUser() {
  const token = await getSessionToken();
  if (!token) return null;
  return verifyToken(token);
}
