'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ConsentCheckbox from '@/components/ConsentCheckbox';
import ErrorState from '@/components/ErrorState';
import OTPInput from '@/components/OTPInput';
import Stepper, { type StepId } from '@/components/Stepper';
import type { PFErrorCode } from '@/lib/providers/errors';
import { en } from '@/lib/strings';

// Single client flow: details → consent → OTP → loading → /result.
// PF identifiers live only in component state (never localStorage/
// sessionStorage, never the URL) and are posted to our own API routes.

const RESEND_COOLDOWN_S = 60;
const FETCH_TIMEOUT_MS = 45_000;

type Phase = StepId | 'loading' | 'error';

interface ApiError {
  code: PFErrorCode;
  attemptsLeft?: number;
}

async function postJson(
  path: string,
  body: unknown
): Promise<{ ok: true; json: any } | { ok: false; error: ApiError }> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json && !json.error) return { ok: true, json };
    return {
      ok: false,
      error: {
        code: (json?.error?.code as PFErrorCode) ?? 'UNKNOWN',
        attemptsLeft: json?.error?.attemptsLeft,
      },
    };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    return {
      ok: false,
      error: { code: timedOut ? 'EPFO_UNAVAILABLE' : 'PROVIDER_UNAVAILABLE' },
    };
  }
}

export default function CheckPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('details');
  const [errorCode, setErrorCode] = useState<PFErrorCode>('UNKNOWN');

  const [uan, setUan] = useState('');
  const [mobile, setMobile] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    uan?: string;
    mobile?: string;
  }>({});

  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [transactionId, setTransactionId] = useState('');
  const [otpSentTo, setOtpSentTo] = useState('');
  const [otp, setOtp] = useState('');
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  const [loadingStage, setLoadingStage] = useState(0);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resend cooldown ticker
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Staged loading messages
  useEffect(() => {
    if (phase !== 'loading') {
      if (stageTimer.current) clearInterval(stageTimer.current);
      stageTimer.current = null;
      return;
    }
    setLoadingStage(0);
    stageTimer.current = setInterval(() => {
      setLoadingStage((s) => Math.min(s + 1, en.loading.stages.length - 1));
    }, 2500);
    return () => {
      if (stageTimer.current) clearInterval(stageTimer.current);
    };
  }, [phase]);

  const fail = useCallback((code: PFErrorCode) => {
    setErrorCode(code);
    setPhase('error');
  }, []);

  const resetAll = useCallback(() => {
    setUan('');
    setMobile('');
    setConsented(false);
    setTransactionId('');
    setOtp('');
    setOtpMessage(null);
    setResendIn(0);
    setFieldErrors({});
    setPhase('details');
  }, []);

  // --- Step 1: details ------------------------------------------------
  const submitDetails = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof fieldErrors = {};
    if (!/^\d{12}$/.test(uan)) errors.uan = en.input.uanError;
    if (!/^[6-9]\d{9}$/.test(mobile)) errors.mobile = en.input.mobileError;
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) setPhase('consent');
  };

  // --- Step 2: consent → initiate --------------------------------------
  const sendOtp = async () => {
    if (!consented || submitting) return;
    setSubmitting(true);
    const result = await postJson('/api/pf/initiate', {
      uan,
      mobile,
      consentAccepted: true,
    });
    setSubmitting(false);
    if (!result.ok) {
      fail(result.error.code);
      return;
    }
    setTransactionId(result.json.transactionId);
    setOtpSentTo(result.json.otpSentTo);
    setOtp('');
    setOtpMessage(null);
    setResendIn(RESEND_COOLDOWN_S);
    setPhase('otp');
  };

  // --- Step 3: OTP → complete ------------------------------------------
  const verifyOtp = async () => {
    if (otp.length !== 6 || submitting) return;
    setSubmitting(true);
    setPhase('loading');
    const result = await postJson('/api/pf/complete', { transactionId, otp });
    setSubmitting(false);
    if (result.ok) {
      router.push('/result');
      return;
    }
    const { code, attemptsLeft } = result.error;
    if (code === 'OTP_INVALID') {
      setOtp('');
      setOtpMessage(
        `${en.otp.invalid}${
          attemptsLeft !== undefined
            ? ` (${en.otp.attemptsLeft(attemptsLeft)})`
            : ''
        }`
      );
      setPhase('otp');
      return;
    }
    fail(code);
  };

  const onErrorAction = () => {
    switch (errorCode) {
      case 'MOBILE_MISMATCH':
        // Keep the UAN, let them fix the number.
        setMobile('');
        setConsented(false);
        setFieldErrors({});
        setPhase('details');
        break;
      default:
        resetAll();
    }
  };

  // ----------------------------------------------------------------------
  if (phase === 'error') {
    return <ErrorState code={errorCode} onAction={onErrorAction} />;
  }

  if (phase === 'loading') {
    return (
      <div
        className="mx-auto max-w-md space-y-6 pt-8 text-center"
        data-testid="loading-screen"
        aria-live="polite"
      >
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
        <p className="font-medium text-neutral-700">
          {en.loading.stages[loadingStage]}
        </p>
        <div className="space-y-3" aria-hidden>
          <div className="h-24 animate-pulse rounded-xl bg-neutral-200" />
          <div className="grid grid-cols-3 gap-3">
            <div className="h-16 animate-pulse rounded-xl bg-neutral-200" />
            <div className="h-16 animate-pulse rounded-xl bg-neutral-200" />
            <div className="h-16 animate-pulse rounded-xl bg-neutral-200" />
          </div>
          <div className="h-32 animate-pulse rounded-xl bg-neutral-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <Stepper current={phase} />

      {phase === 'details' && (
        <form onSubmit={submitDetails} className="space-y-5" noValidate>
          <h1 className="text-xl font-semibold text-neutral-900">
            {en.input.title}
          </h1>
          <div>
            <label
              htmlFor="uan"
              className="mb-1 block text-sm font-medium text-neutral-700"
            >
              {en.input.uanLabel}
            </label>
            <input
              id="uan"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={12}
              value={uan}
              onChange={(e) => setUan(e.target.value.replace(/\D/g, ''))}
              placeholder={en.input.uanPlaceholder}
              data-testid="uan-input"
              className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-lg tracking-wider focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="mt-1 text-xs text-neutral-500">
              {en.input.uanHelper}
            </p>
            {fieldErrors.uan && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {fieldErrors.uan}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="mobile"
              className="mb-1 block text-sm font-medium text-neutral-700"
            >
              {en.input.mobileLabel}
            </label>
            <div className="flex items-stretch">
              <span className="flex items-center rounded-l-lg border border-r-0 border-neutral-300 bg-neutral-100 px-3 text-neutral-600">
                +91
              </span>
              <input
                id="mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                placeholder={en.input.mobilePlaceholder}
                data-testid="mobile-input"
                className="w-full rounded-r-lg border border-neutral-300 px-4 py-3 text-lg tracking-wider focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              {en.input.mobileHelper}
            </p>
            {fieldErrors.mobile && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {fieldErrors.mobile}
              </p>
            )}
          </div>
          <button
            type="submit"
            data-testid="details-continue"
            className="w-full rounded-xl bg-brand-600 px-6 py-3.5 font-semibold text-white transition hover:bg-brand-700"
          >
            {en.input.continue}
          </button>
        </form>
      )}

      {phase === 'consent' && (
        <div className="space-y-5">
          <h1 className="text-xl font-semibold text-neutral-900">
            {en.consent.title}
          </h1>
          <ConsentCheckbox checked={consented} onChange={setConsented} />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPhase('details')}
              className="rounded-xl border border-neutral-300 px-5 py-3 font-medium text-neutral-700 transition hover:bg-neutral-100"
            >
              {en.consent.back}
            </button>
            <button
              type="button"
              onClick={sendOtp}
              disabled={!consented || submitting}
              data-testid="send-otp"
              className="flex-1 rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {submitting ? 'Sending…' : en.consent.sendOtp}
            </button>
          </div>
        </div>
      )}

      {phase === 'otp' && (
        <div className="space-y-5">
          <div className="text-center">
            <h1 className="text-xl font-semibold text-neutral-900">
              {en.otp.title}
            </h1>
            <p className="mt-1 text-sm text-neutral-600" data-testid="otp-sent-to">
              {en.otp.sentTo(otpSentTo)}
            </p>
            <p className="text-xs text-neutral-500">{en.otp.helper}</p>
          </div>
          <OTPInput value={otp} onChange={setOtp} disabled={submitting} />
          {otpMessage && (
            <p
              className="text-center text-sm text-red-600"
              role="alert"
              data-testid="otp-message"
            >
              {otpMessage}
            </p>
          )}
          <button
            type="button"
            onClick={verifyOtp}
            disabled={otp.length !== 6 || submitting}
            data-testid="verify-otp"
            className="w-full rounded-xl bg-brand-600 px-6 py-3.5 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {en.otp.verify}
          </button>
          <p className="text-center text-sm">
            {resendIn > 0 ? (
              <span className="text-neutral-400">
                {en.otp.resendIn(resendIn)}
              </span>
            ) : (
              <button
                type="button"
                onClick={sendOtp}
                disabled={submitting}
                data-testid="resend-otp"
                className="font-medium text-brand-700 underline"
              >
                {en.otp.resend}
              </button>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
