import { NextResponse } from 'next/server';
import { logConsent } from '@/lib/consent';
import { getProvider } from '@/lib/providers';
import { toPFError } from '@/lib/providers/errors';
import { checkRateLimit, clientIp } from '@/lib/ratelimit';
import { createSession, updateSession } from '@/lib/session';
import { initiateBodySchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

// POST /api/pf/initiate  { uan, mobile, consentAccepted }
//   → { transactionId, otpSentTo, expiresAt }
//
// Order matters: validate → rate limit → log consent → call provider.
// The consent log entry MUST be persisted before any provider call (§4).

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'UNKNOWN', message: 'Invalid JSON body' } },
      { status: 400 }
    );
  }

  // Server-side re-validation — never trust client validation.
  const parsed = initiateBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'UNKNOWN', message: 'Invalid request' } },
      { status: 400 }
    );
  }

  const ip = clientIp(req);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', retryable: true } },
      { status: 429 }
    );
  }

  const { uan, mobile } = parsed.data;

  try {
    // Consent first — if this write fails, the fetch must not proceed.
    const consent = await logConsent({ uan, mobile, ip });

    const session = createSession();
    const provider = getProvider();
    const result = await provider.initiateFetch({
      uan,
      mobile,
      consentId: consent.consentId,
    });

    updateSession(session.id, {
      transactionId: result.transactionId,
      otpExpiresAt: result.expiresAt,
      otpSentTo: result.otpSentTo,
    });

    return NextResponse.json({
      transactionId: result.transactionId,
      otpSentTo: result.otpSentTo,
      expiresAt: result.expiresAt,
    });
  } catch (err) {
    const pfErr = toPFError(err);
    // Metadata-only logging — never the UAN, mobile, or OTP.
    console.warn(
      JSON.stringify({ at: 'api.initiate', errorCode: pfErr.code })
    );
    return NextResponse.json(
      { error: { code: pfErr.code, retryable: pfErr.retryable } },
      { status: pfErr.code === 'RATE_LIMITED' ? 429 : 502 }
    );
  }
}
