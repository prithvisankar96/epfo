import { NextResponse } from 'next/server';
import { getProvider } from '@/lib/providers';
import { toPFError } from '@/lib/providers/errors';
import {
  MAX_OTP_ATTEMPTS,
  destroySession,
  getSession,
  recordOtpAttempt,
  updateSession,
} from '@/lib/session';
import { completeBodySchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

// POST /api/pf/complete  { transactionId, otp }  →  { data: PFAccountData }
//
// The transactionId must match the one stored in the caller's session at
// initiate time — a client can't complete someone else's transaction.
// After 3 failed OTP attempts the whole session is reset (§3.4).

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

  const parsed = completeBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'OTP_INVALID', retryable: true } },
      { status: 400 }
    );
  }

  const session = getSession();
  if (!session || session.data.transactionId !== parsed.data.transactionId) {
    return NextResponse.json(
      { error: { code: 'OTP_EXPIRED', retryable: false } },
      { status: 400 }
    );
  }

  if (!recordOtpAttempt(session.id)) {
    destroySession();
    return NextResponse.json(
      { error: { code: 'OTP_MAX_ATTEMPTS', retryable: false } },
      { status: 429 }
    );
  }

  try {
    const provider = getProvider();
    const data = await provider.completeFetch({
      transactionId: parsed.data.transactionId,
      otp: parsed.data.otp,
    });

    updateSession(session.id, { data });
    return NextResponse.json({ data });
  } catch (err) {
    const pfErr = toPFError(err);
    console.warn(
      JSON.stringify({ at: 'api.complete', errorCode: pfErr.code })
    );

    if (pfErr.code === 'OTP_INVALID') {
      const attemptsLeft = MAX_OTP_ATTEMPTS - session.data.otpAttempts;
      if (attemptsLeft <= 0) {
        destroySession();
        return NextResponse.json(
          { error: { code: 'OTP_MAX_ATTEMPTS', retryable: false } },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: { code: 'OTP_INVALID', retryable: true, attemptsLeft } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: pfErr.code, retryable: pfErr.retryable } },
      { status: 502 }
    );
  }
}
