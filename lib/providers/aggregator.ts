import { PFError, isPFError, type PFErrorCode } from './errors';
import type {
  CompleteRequest,
  Contribution,
  InitiateRequest,
  InitiateResult,
  MemberAccount,
  PFAccountData,
  PFProvider,
  ProviderHealth,
} from './types';

// AggregatorProvider — real EPFO passbook fetch via a verification-API
// aggregator. [OPEN → chosen: Surepass] Surepass was picked for its
// documented two-step EPFO passbook flow (generate-otp / submit-otp) and
// public sandbox. The request/response shapes below follow Surepass's
// EPF passbook API; if the vendor changes, only this file changes.
//
// Configuration (server-side env only — never NEXT_PUBLIC_):
//   PF_PROVIDER_BASE_URL  e.g. https://sandbox.surepass.app/api/v1
//   PF_PROVIDER_API_KEY   bearer token
//
// Hard rules implemented here:
//   * 15s timeout on every call
//   * exactly 1 retry on 5xx — but NEVER for OTP submission (a retry could
//     double-consume the OTP attempt on the EPFO side)
//   * all vendor errors mapped into the PFErrorCode taxonomy (table below)
//   * amounts normalized to integer INR; months normalized to "YYYY-MM"
//   * logs carry latency/status/error-code metadata only — never UAN,
//     mobile, OTP, or response bodies

const TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Vendor error → taxonomy mapping table
// ---------------------------------------------------------------------------
// Surepass signals errors via HTTP status + a message/status_code field.
// Matching is done on normalized message text because the vendor does not
// publish stable machine codes for every case.
//
//   HTTP 422 "invalid uan" / "uan not found"          → INVALID_UAN
//   HTTP 422 "uan not activated" / "inactive"         → UAN_INACTIVE
//   HTTP 422 "mobile not linked" / "mobile mismatch"  → MOBILE_MISMATCH
//   HTTP 422 "invalid otp" / "incorrect otp"          → OTP_INVALID
//   HTTP 422 "otp expired"                            → OTP_EXPIRED
//   HTTP 422 "max attempts" / "attempts exceeded"     → OTP_MAX_ATTEMPTS
//   HTTP 422 "exempted" / "trust"                     → EXEMPTED_TRUST
//   HTTP 503 / "epfo" + ("down"|"unavailable"|…)      → EPFO_UNAVAILABLE
//   HTTP 429                                          → RATE_LIMITED
//   HTTP 5xx (other), network error, timeout          → PROVIDER_UNAVAILABLE
//   anything else                                     → UNKNOWN
// ---------------------------------------------------------------------------
const MESSAGE_MAP: Array<[RegExp, PFErrorCode, boolean]> = [
  [/uan.*(not found|invalid)|invalid.*uan|no record/i, 'INVALID_UAN', false],
  [/not activated|inactive uan|uan.*inactive/i, 'UAN_INACTIVE', false],
  [/mobile.*(not linked|mismatch|not registered)/i, 'MOBILE_MISMATCH', false],
  [/otp.*expired|expired.*otp/i, 'OTP_EXPIRED', true],
  [/(max|maximum|exceeded).*attempt|attempt.*exceed/i, 'OTP_MAX_ATTEMPTS', false],
  [/invalid otp|incorrect otp|wrong otp|otp.*invalid/i, 'OTP_INVALID', true],
  [/exempt|trust/i, 'EXEMPTED_TRUST', false],
  [/epfo.*(down|unavailable|not responding|degraded|maintenance)/i, 'EPFO_UNAVAILABLE', true],
];

export function mapVendorError(status: number, message: string): PFError {
  for (const [pattern, code, retryable] of MESSAGE_MAP) {
    if (pattern.test(message)) return new PFError(code, retryable);
  }
  if (status === 429) return new PFError('RATE_LIMITED', true);
  if (status === 503) return new PFError('EPFO_UNAVAILABLE', true);
  if (status >= 500) return new PFError('PROVIDER_UNAVAILABLE', true);
  return new PFError('UNKNOWN', false);
}

/** "12345.67" | 12345.67 | "1,23,456" → 123457 (integer INR). */
export function normalizeAmount(raw: unknown): number {
  if (typeof raw === 'number') return Math.round(raw);
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/[₹,\s]/g, '');
    const n = Number(cleaned);
    if (!Number.isNaN(n)) return Math.round(n);
  }
  return 0;
}

const MONTH_NAMES: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/** "May-2026" | "05/2026" | "2026-05" | "MAY 2026" → "2026-05". */
export function normalizeMonth(raw: string): string {
  const s = raw.trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-/](\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, '0')}`;
  m = s.match(/^([A-Za-z]{3,9})[\s-]+(\d{4})$/);
  if (m) {
    const mm = MONTH_NAMES[m[1].slice(0, 3).toLowerCase()];
    if (mm) return `${m[2]}-${mm}`;
  }
  m = s.match(/^(\d{4})[\s-]+([A-Za-z]{3,9})$/);
  if (m) {
    const mm = MONTH_NAMES[m[2].slice(0, 3).toLowerCase()];
    if (mm) return `${m[1]}-${mm}`;
  }
  return s;
}

function maskMobile(mobile: string): string {
  return `+91 ${mobile.slice(0, 2)}XXXXXX${mobile.slice(8)}`;
}

interface VendorCallOptions {
  path: string;
  body: Record<string, unknown>;
  /** OTP submission must never be retried. */
  retryOn5xx: boolean;
}

export class AggregatorProvider implements PFProvider {
  readonly name = 'aggregator';

  private get baseUrl(): string {
    const url = process.env.PF_PROVIDER_BASE_URL;
    if (!url) throw new PFError('PROVIDER_UNAVAILABLE', false);
    return url.replace(/\/$/, '');
  }

  private get apiKey(): string {
    const key = process.env.PF_PROVIDER_API_KEY;
    if (!key) throw new PFError('PROVIDER_UNAVAILABLE', false);
    return key;
  }

  private async call(opts: VendorCallOptions): Promise<any> {
    const attempts = opts.retryOn5xx ? 2 : 1;
    let lastError: PFError = new PFError('PROVIDER_UNAVAILABLE', true);

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const started = Date.now();
      try {
        const res = await fetch(`${this.baseUrl}${opts.path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(opts.body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
          cache: 'no-store',
        });

        const latency = Date.now() - started;
        let json: any = null;
        try {
          json = await res.json();
        } catch {
          // non-JSON body — treated as vendor failure below
        }

        if (res.ok && json?.success !== false) {
          // Metadata-only log: no identifiers, no bodies.
          console.info(
            JSON.stringify({
              at: 'aggregator.call',
              path: opts.path,
              status: res.status,
              latencyMs: latency,
            })
          );
          return json;
        }

        const message: string =
          json?.message ?? json?.error ?? json?.detail ?? '';
        const mapped = mapVendorError(res.status, String(message));
        console.warn(
          JSON.stringify({
            at: 'aggregator.call',
            path: opts.path,
            status: res.status,
            latencyMs: latency,
            errorCode: mapped.code,
          })
        );
        if (res.status >= 500 && opts.retryOn5xx && attempt < attempts) {
          lastError = mapped;
          continue; // single retry on 5xx
        }
        throw mapped;
      } catch (err) {
        if (isPFError(err)) throw err;
        const latency = Date.now() - started;
        const timedOut = err instanceof Error && err.name === 'TimeoutError';
        console.warn(
          JSON.stringify({
            at: 'aggregator.call',
            path: opts.path,
            status: 0,
            latencyMs: latency,
            errorCode: 'PROVIDER_UNAVAILABLE',
            timedOut,
          })
        );
        lastError = new PFError('PROVIDER_UNAVAILABLE', true);
        if (opts.retryOn5xx && attempt < attempts) continue;
        throw lastError;
      }
    }
    throw lastError;
  }

  async initiateFetch(req: InitiateRequest): Promise<InitiateResult> {
    const json = await this.call({
      path: '/epfo/generate-otp',
      body: { uan: req.uan, mobile: req.mobile },
      retryOn5xx: true,
    });
    const clientId: string | undefined = json?.data?.client_id;
    if (!clientId) throw new PFError('UNKNOWN', true);
    return {
      transactionId: clientId,
      otpSentTo: maskMobile(req.mobile),
      // Vendor does not return an expiry; EPFO OTPs are valid ~10 minutes.
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  }

  async completeFetch(req: CompleteRequest): Promise<PFAccountData> {
    const json = await this.call({
      path: '/epfo/submit-otp',
      body: { client_id: req.transactionId, otp: req.otp },
      retryOn5xx: false, // NEVER retry OTP submission
    });
    return this.normalize(json?.data);
  }

  /** Map the vendor passbook payload into PFAccountData. */
  private normalize(data: any): PFAccountData {
    if (!data || !Array.isArray(data.companies ?? data.accounts)) {
      throw new PFError('UNKNOWN', false);
    }
    const rawAccounts: any[] = data.companies ?? data.accounts;

    const accounts: MemberAccount[] = rawAccounts.map((acc) => {
      const rawContribs: any[] = acc.passbook ?? acc.transactions ?? [];
      const contributions: Contribution[] = rawContribs
        .map((t) => ({
          month: normalizeMonth(String(t.month ?? t.wage_month ?? '')),
          employeeAmount: normalizeAmount(t.employee_share ?? t.employee),
          employerAmount: normalizeAmount(t.employer_share ?? t.employer),
          pensionAmount: normalizeAmount(t.pension_share ?? t.pension),
        }))
        .filter((c) => /^\d{4}-\d{2}$/.test(c.month))
        .sort((a, b) => (a.month < b.month ? 1 : -1))
        .slice(0, 12); // most recent first, cap 12

      const employeeShare = normalizeAmount(
        acc.employee_share_total ?? acc.employee_balance
      );
      const employerShare = normalizeAmount(
        acc.employer_share_total ?? acc.employer_balance
      );
      const pensionShare = normalizeAmount(
        acc.pension_share_total ?? acc.pension_balance
      );

      return {
        memberId: String(acc.member_id ?? acc.member_id_number ?? ''),
        establishmentName: String(
          acc.company_name ?? acc.establishment_name ?? 'Unknown employer'
        ),
        balance: {
          employeeShare,
          employerShare,
          pensionShare,
          total: employeeShare + employerShare + pensionShare,
        },
        contributions,
        lastContributionMonth: contributions[0]?.month ?? '',
        isActive: Boolean(acc.is_active ?? acc.active ?? true),
      };
    });

    return {
      uan: String(data.uan ?? ''),
      memberName: String(data.name ?? data.member_name ?? ''),
      accounts,
      fetchedAt: new Date().toISOString(),
      provider: this.name,
    };
  }

  async healthCheck(): Promise<ProviderHealth> {
    const checkedAt = new Date().toISOString();
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5_000),
        cache: 'no-store',
      });
      return { provider: this.name, ok: res.ok, checkedAt };
    } catch {
      return {
        provider: this.name,
        ok: false,
        checkedAt,
        detail: 'unreachable',
      };
    }
  }
}
