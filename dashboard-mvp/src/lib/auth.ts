import { cookies } from "next/headers";

export const AUTH_COOKIE_NAME = "interpi_dashboard_session";

const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

type AuthEnv = {
  username: string;
  password: string;
  secret: string;
};

export type AuthSession = {
  username: string;
  exp: number;
};

function readAuthEnv(): AuthEnv {
  const username = process.env.AUTH_LOGIN_USERNAME?.trim();
  const password = process.env.AUTH_LOGIN_PASSWORD?.trim();
  const secret = process.env.AUTH_SESSION_SECRET?.trim();

  if (!username || !password || !secret) {
    throw new Error("As variáveis de autenticação do painel não foram configuradas.");
  }

  return { username, password, secret };
}

function secureEqual(a: string, b: string) {
  const maxLen = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;

  for (let i = 0; i < maxLen; i += 1) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }

  return mismatch === 0;
}

async function hmacSha256Hex(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizeNextPath(path: string | null | undefined) {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/login")) {
    return "/";
  }

  return path;
}

export async function isValidLogin(username: string, password: string) {
  const env = readAuthEnv();
  return secureEqual(username.trim(), env.username) && secureEqual(password, env.password);
}

export async function createSessionToken(username: string) {
  const { secret } = readAuthEnv();
  const payload = encodeURIComponent(
    JSON.stringify({
      username,
      exp: Date.now() + SESSION_TTL_MS,
    } satisfies AuthSession),
  );
  const signature = await hmacSha256Hex(payload, secret);
  return `${payload}.${signature}`;
}

export async function verifySessionToken(token: string | null | undefined) {
  if (!token) return null;

  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0) return null;

  const payload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);

  try {
    const { secret, username } = readAuthEnv();
    const expectedSignature = await hmacSha256Hex(payload, secret);
    if (!secureEqual(signature, expectedSignature)) return null;

    const parsed = JSON.parse(decodeURIComponent(payload)) as Partial<AuthSession>;
    if (typeof parsed.username !== "string" || typeof parsed.exp !== "number") return null;
    if (!secureEqual(parsed.username, username) || parsed.exp <= Date.now()) return null;

    return parsed as AuthSession;
  } catch {
    return null;
  }
}

export async function getSessionFromCookies() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);
}

export function buildSessionCookie(token: string) {
  return {
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(Date.now() + SESSION_TTL_MS),
  };
}

export function buildExpiredSessionCookie() {
  return {
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  };
}
