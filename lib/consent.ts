import { createHash, randomUUID } from 'crypto';
import { appendFile, mkdir } from 'fs/promises';
import path from 'path';

// Consent logging (§6.5, DPDP Act requirement). The entry stores a SHA-256
// hash of the UAN — never the UAN itself — plus masked mobile, consent text
// version, timestamp, and IP. Written as append-only JSON lines.
//
// [OPEN → chosen: local JSONL file] Simplest for v1. On Vercel the
// filesystem is ephemeral, so production must point CONSENT_LOG_PATH at a
// mounted volume or swap writeConsentLog's sink for a hosted append-only
// log — see README.

/** Bump whenever the consent copy in lib/strings.ts changes. */
export const CONSENT_TEXT_VERSION = '2026-07-v1';

export interface ConsentLogEntry {
  consentId: string;
  timestamp: string;
  uanHash: string; // SHA-256 of UAN — the raw UAN is never stored
  mobileMasked: string; // e.g. "98XXXXXX21"
  consentTextVersion: string;
  ip: string;
}

function logPath(): string {
  if (process.env.CONSENT_LOG_PATH) return process.env.CONSENT_LOG_PATH;
  // On Vercel the deployment filesystem is read-only — only /tmp is
  // writable. That keeps the demo working, but /tmp does not survive
  // redeploys or instance recycling: production must set CONSENT_LOG_PATH
  // to a durable sink (see README).
  if (process.env.VERCEL) return '/tmp/pf-pulse-consent-log.jsonl';
  return path.join(process.cwd(), 'data', 'consent-log.jsonl');
}

export function hashUan(uan: string): string {
  return createHash('sha256').update(uan).digest('hex');
}

export function maskMobileForLog(mobile: string): string {
  return `${mobile.slice(0, 2)}XXXXXX${mobile.slice(8)}`;
}

/**
 * Persist the consent event. MUST be awaited before any provider call —
 * if the log write fails, the fetch must not proceed.
 */
export async function logConsent(params: {
  uan: string;
  mobile: string;
  ip: string;
}): Promise<ConsentLogEntry> {
  const entry: ConsentLogEntry = {
    consentId: randomUUID(),
    timestamp: new Date().toISOString(),
    uanHash: hashUan(params.uan),
    mobileMasked: maskMobileForLog(params.mobile),
    consentTextVersion: CONSENT_TEXT_VERSION,
    ip: params.ip,
  };
  const file = logPath();
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, JSON.stringify(entry) + '\n', 'utf8');
  return entry;
}
