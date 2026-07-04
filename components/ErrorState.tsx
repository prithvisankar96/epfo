import type { PFErrorCode } from '@/lib/providers/errors';
import { en } from '@/lib/strings';

// One distinct screen per PFErrorCode (§4 error taxonomy). Copy lives in
// lib/strings.ts. The EXEMPTED_TRUST variant is deliberately informative,
// not apologetic — it is not a failure of the app.

const ICONS: Record<PFErrorCode, string> = {
  INVALID_UAN: '🔍',
  UAN_INACTIVE: '🔒',
  MOBILE_MISMATCH: '📱',
  OTP_INVALID: '🔢',
  OTP_EXPIRED: '⏰',
  OTP_MAX_ATTEMPTS: '🛑',
  EXEMPTED_TRUST: '🏢',
  EPFO_UNAVAILABLE: '🛠️',
  PROVIDER_UNAVAILABLE: '📡',
  RATE_LIMITED: '⏳',
  UNKNOWN: '❓',
};

export default function ErrorState({
  code,
  onAction,
}: {
  code: PFErrorCode;
  onAction: () => void;
}) {
  const copy = en.errors[code];
  return (
    <div
      className="mx-auto max-w-md space-y-4 rounded-xl border border-neutral-200 bg-white p-6 text-center"
      data-testid={`error-${code}`}
      role="alert"
    >
      <div aria-hidden className="text-4xl">
        {ICONS[code]}
      </div>
      <h2 className="text-xl font-semibold text-neutral-900">{copy.title}</h2>
      <p className="text-sm leading-relaxed text-neutral-600">{copy.body}</p>
      {'linkHref' in copy && copy.linkHref && (
        <p>
          <a
            href={copy.linkHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-brand-700 underline"
          >
            {copy.linkText}
          </a>
        </p>
      )}
      <button
        type="button"
        onClick={onAction}
        className="w-full rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white transition hover:bg-brand-700"
        data-testid="error-action"
      >
        {copy.action}
      </button>
    </div>
  );
}
