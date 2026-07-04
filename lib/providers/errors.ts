// Error taxonomy [DECIDED]. Providers must throw only these typed errors.
// The UI maps each code to a specific screen (components/ErrorState.tsx).

export type PFErrorCode =
  | 'INVALID_UAN' // UAN not found in EPFO records
  | 'UAN_INACTIVE' // UAN exists but not activated
  | 'MOBILE_MISMATCH' // mobile not linked to this UAN
  | 'OTP_INVALID' // wrong OTP
  | 'OTP_EXPIRED'
  | 'OTP_MAX_ATTEMPTS'
  | 'EXEMPTED_TRUST' // PF managed by company trust, not on EPFO portal
  | 'EPFO_UNAVAILABLE' // EPFO systems down/degraded (post-3.0 migration is flaky)
  | 'PROVIDER_UNAVAILABLE' // aggregator itself down
  | 'RATE_LIMITED'
  | 'UNKNOWN';

export class PFError extends Error {
  constructor(
    public code: PFErrorCode,
    public retryable: boolean,
    message?: string
  ) {
    super(message ?? code);
    this.name = 'PFError';
  }
}

export function isPFError(err: unknown): err is PFError {
  return err instanceof PFError;
}

/** Coerce any thrown value into a PFError so nothing escapes the taxonomy. */
export function toPFError(err: unknown): PFError {
  if (isPFError(err)) return err;
  return new PFError('UNKNOWN', true);
}
