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
      className="mx-auto max-w-md space-y-4 rounded-3xl bg-canvas p-6 text-center sm:p-8"
      data-testid={`error-${code}`}
      role="alert"
    >
      <div
        aria-hidden
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-canvas-soft text-3xl"
      >
        {ICONS[code]}
      </div>
      <h2 className="text-2xl font-black tracking-tight text-ink">
        {copy.title}
      </h2>
      <p className="text-sm leading-relaxed text-bodytext">{copy.body}</p>
      {'linkHref' in copy && copy.linkHref && (
        <p>
          <a
            href={copy.linkHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-ink underline"
          >
            {copy.linkText}
          </a>
        </p>
      )}
      <button
        type="button"
        onClick={onAction}
        className="w-full rounded-3xl bg-primary px-6 py-3 font-semibold text-ink transition hover:bg-primary-active"
        data-testid="error-action"
      >
        {copy.action}
      </button>
    </div>
  );
}
