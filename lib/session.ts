import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import type { PFAccountData } from './providers/types';

// Session layer (§6.2): PF data lives server-side in memory, keyed by an
// opaque session id carried in a signed, httpOnly cookie. TTL ≤ 30 minutes;
// destroyed on "Check another UAN". Nothing PF-related ever reaches
// localStorage/sessionStorage or the URL.
//
// v1 note: the in-memory store assumes a single server instance (fine for
// dev, tests, and a single Vercel region with low traffic — see README for
// the multi-instance caveat and the Redis upgrade path).

const COOKIE_NAME = 'pfp_session';
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes, hard cap per spec
const MAX_OTP_ATTEMPTS = 3;

export interface SessionData {
  createdAt: number;
  expiresAt: number;
  /** Provider transaction reference between initiate and complete. */
  transactionId?: string;
  otpAttempts: number;
  otpExpiresAt?: string;
  otpSentTo?: string;
  /** Fetched PF data, held only for the session TTL. */
  data?: PFAccountData;
}

// Survive Next.js dev-server HMR by anchoring the store on globalThis.
const globalStore = globalThis as unknown as {
  __pfSessions?: Map<string, SessionData>;
};
const store: Map<string, SessionData> =
  globalStore.__pfSessions ?? (globalStore.__pfSessions = new Map());

function secret(): string {
  return process.env.SESSION_SECRET ?? 'pf-pulse-dev-secret-do-not-use-in-prod';
}

function sign(id: string): string {
  return createHmac('sha256', secret()).update(id).digest('base64url');
}

function verify(value: string): string | null {
  const dot = value.lastIndexOf('.');
  if (dot < 0) return null;
  const id = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(id);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return id;
}

function sweepExpired(): void {
  const now = Date.now();
  for (const [id, s] of store) {
    if (s.expiresAt <= now) store.delete(id);
  }
}

/** Get the current session, or null if absent/expired/tampered. */
export function getSession(): { id: string; data: SessionData } | null {
  sweepExpired();
  const raw = cookies().get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const id = verify(raw);
  if (!id) return null;
  const data = store.get(id);
  if (!data || data.expiresAt <= Date.now()) {
    store.delete(id);
    return null;
  }
  return { id, data };
}

/** Create a fresh session (destroying any existing one) and set the cookie. */
export function createSession(): { id: string; data: SessionData } {
  destroySession();
  const id = randomBytes(24).toString('base64url');
  const data: SessionData = {
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
    otpAttempts: 0,
  };
  store.set(id, data);
  cookies().set(COOKIE_NAME, `${id}.${sign(id)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
  return { id, data };
}

export function updateSession(id: string, patch: Partial<SessionData>): void {
  const existing = store.get(id);
  if (!existing) return;
  store.set(id, { ...existing, ...patch });
}

/** Destroy session state and clear the cookie ("Check another UAN"). */
export function destroySession(): void {
  const raw = cookies().get(COOKIE_NAME)?.value;
  if (raw) {
    const id = verify(raw);
    if (id) store.delete(id);
  }
  cookies().delete(COOKIE_NAME);
}

/** Record an OTP attempt; returns false once the max (3) is exceeded. */
export function recordOtpAttempt(id: string): boolean {
  const s = store.get(id);
  if (!s) return false;
  s.otpAttempts += 1;
  return s.otpAttempts <= MAX_OTP_ATTEMPTS;
}

export { MAX_OTP_ATTEMPTS };
