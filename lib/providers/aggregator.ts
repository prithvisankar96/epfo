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

// AggregatorProvider — real EPFO passbook fetch via Surepass.
//
// Surepass's EPFO passbook flow is three calls (docs: share.apidog.com
// docs-site 750756, "EPFO Passbook"):
//
//   1. POST /income/epfo/passbook/generate-otp   { id_number: <UAN> }
//        → { data: { client_id, otp_sent, masked_mobile_number } }
//      The OTP always goes to the UAN-registered mobile — the vendor does
//      not take a mobile number. We compare the returned masked number
//      against the user-entered one to surface MOBILE_MISMATCH early.
//   2. POST /income/epfo/passbook/submit-otp     { client_id, otp }
//        → { data: { otp_validated } }
//   3. POST /income/epfo/passbook/get-passbook   { client_id }
//        → { data: { pf_uan, full_name, companies: { [memberId]:
//             { company_name, establishment_id, passbook: [
//               { year, month, employee_share, employer_share,
//                 pension_share?, approved_on } ] } } } }
//
// Configuration (server-side env only — never NEXT_PUBLIC_):
//   PF_PROVIDER_BASE_URL  https://kyc-api.surepass.app/api/v1  (production)
//                         https://sandbox.surepass.io/api/v1   (sandbox)
//   PF_PROVIDER_API_KEY   Bearer JWT from the Surepass console
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
// Vendor error → taxonomy mapping
// ---------------------------------------------------------------------------
// Surepass signals errors via HTTP status + a `message_code` (stable-ish
// machine code) + `message` (human text). We match message_code first,
// then fall back to message-text patterns, then to HTTP status.
//
//   message_code "invalid_otp"          → OTP_INVALID
//   message_code "otp_expired"          → OTP_EXPIRED
//   message_code "invalid_client_id"    → OTP_EXPIRED  (stale transaction —
//                                          restart the flow)
//   message_code "record_not_found"     → INVALID_UAN
//   message_code "invalid_input"        → INVALID_UAN  (rejected id_number)
//   message_code "source_down"          → EPFO_UNAVAILABLE
//   message_code "insufficient_credits" → PROVIDER_UNAVAILABLE
//   message_code "unauthorized"         → PROVIDER_UNAVAILABLE
//   text "uan … not found/invalid"      → INVALID_UAN
//   text "not activated/inactive"       → UAN_INACTIVE
//   text "otp … expired"                → OTP_EXPIRED
//   text "max/exceeded … attempts"      → OTP_MAX_ATTEMPTS
//   text "invalid/incorrect otp"        → OTP_INVALID
//   text "exempt/trust"                 → EXEMPTED_TRUST
//   text "epfo … down/unavailable/…"    → EPFO_UNAVAILABLE
//   HTTP 429                            → RATE_LIMITED
//   HTTP 503                            → EPFO_UNAVAILABLE
//   HTTP 5xx (other), network, timeout  → PROVIDER_UNAVAILABLE
//   anything else                       → UNKNOWN
// ---------------------------------------------------------------------------

const MESSAGE_CODE_MAP: Record<string, [PFErrorCode, boolean]> = {
  invalid_otp: ['OTP_INVALID', true],
  otp_expired: ['OTP_EXPIRED', true],
  invalid_client_id: ['OTP_EXPIRED', false],
  record_not_found: ['INVALID_UAN', false],
  invalid_input: ['INVALID_UAN', false],
  source_down: ['EPFO_UNAVAILABLE', true],
  insufficient_credits: ['PROVIDER_UNAVAILABLE', false],
  unauthorized: ['PROVIDER_UNAVAILABLE', false],
};

const MESSAGE_TEXT_MAP: Array<[RegExp, PFErrorCode, boolean]> = [
  [/uan.*(not found|invalid)|invalid.*uan|no record/i, 'INVALID_UAN', false],
  [/not activated|inactive uan|uan.*inactive/i, 'UAN_INACTIVE', false],
  [/mobile.*(not linked|mismatch|not registered)/i, 'MOBILE_MISMATCH', false],
  [/otp.*expired|expired.*otp/i, 'OTP_EXPIRED', true],
  [/(max|maximum|exceeded).*attempt|attempt.*exceed/i, 'OTP_MAX_ATTEMPTS', false],
  [/invalid otp|incorrect otp|wrong otp|otp.*invalid/i, 'OTP_INVALID', true],
  [/exempt|trust/i, 'EXEMPTED_TRUST', false],
  [/epfo.*(down|unavailable|not responding|degraded|maintenance)/i, 'EPFO_UNAVAILABLE', true],
];

export function mapVendorError(
  status: number,
  message: string,
  messageCode?: string
): PFError {
  if (messageCode && MESSAGE_CODE_MAP[messageCode]) {
    const [code, retryable] = MESSAGE_CODE_MAP[messageCode];
    return new PFError(code, retryable);
  }
  for (const [pattern, code, retryable] of MESSAGE_TEXT_MAP) {
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

        const message = String(json?.message ?? json?.error ?? '');
        const messageCode =
          typeof json?.message_code === 'string' ? json.message_code : undefined;
        const mapped = mapVendorError(res.status, message, messageCode);
        console.warn(
          JSON.stringify({
            at: 'aggregator.call',
            path: opts.path,
            status: res.status,
            latencyMs: latency,
            vendorCode: messageCode ?? null,
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
      path: '/income/epfo/passbook/generate-otp',
      body: { id_number: req.uan },
      retryOn5xx: true,
    });

    const clientId: string | undefined = json?.data?.client_id;
    if (!clientId || json?.data?.otp_sent === false) {
      throw new PFError('UNKNOWN', true);
    }

    // Surepass sends the OTP to the UAN-registered mobile regardless of
    // what the user typed. If the registered number's visible tail doesn't
    // match the user's input, fail fast as MOBILE_MISMATCH — otherwise
    // they'd wait for an SMS that went to an old number.
    const masked = String(json?.data?.masked_mobile_number ?? '');
    const visibleTail = masked.match(/(\d{2,4})\s*$/)?.[1];
    if (visibleTail && !req.mobile.endsWith(visibleTail)) {
      throw new PFError('MOBILE_MISMATCH', false);
    }

    return {
      transactionId: clientId,
      otpSentTo: masked ? `+91 ${masked}` : `+91 XXXXXX${req.mobile.slice(8)}`,
      // Vendor does not return an expiry; EPFO OTPs are valid ~10 minutes.
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  }

  async completeFetch(req: CompleteRequest): Promise<PFAccountData> {
    const submit = await this.call({
      path: '/income/epfo/passbook/submit-otp',
      body: { client_id: req.transactionId, otp: req.otp },
      retryOn5xx: false, // NEVER retry OTP submission
    });
    if (submit?.data?.otp_validated === false) {
      throw new PFError('OTP_INVALID', true);
    }

    // Passbook retrieval is an idempotent read — safe to retry.
    const passbook = await this.call({
      path: '/income/epfo/passbook/get-passbook',
      body: { client_id: req.transactionId },
      retryOn5xx: true,
    });
    return this.normalize(passbook?.data);
  }

  /** Map the Surepass passbook payload into PFAccountData. */
  private normalize(data: any): PFAccountData {
    // `companies` is an object keyed by member ID.
    const companies: Record<string, any> | undefined =
      data && typeof data.companies === 'object' && !Array.isArray(data.companies)
        ? data.companies
        : undefined;
    if (!companies) throw new PFError('UNKNOWN', false);

    const accounts: MemberAccount[] = Object.entries(companies).map(
      ([memberId, acc]) => {
        const rawEntries: any[] = Array.isArray(acc?.passbook)
          ? acc.passbook
          : [];

        // Every passbook row (uncapped) feeds the balance; the newest 12
        // feed the contributions list.
        const rows = rawEntries
          .map((t) => ({
            month:
              t.year && t.month
                ? `${t.year}-${String(t.month).padStart(2, '0')}`
                : normalizeMonth(String(t.wage_month ?? t.month ?? '')),
            employeeAmount: normalizeAmount(t.employee_share),
            employerAmount: normalizeAmount(t.employer_share),
            pensionAmount: normalizeAmount(t.pension_share),
          }))
          .filter((c) => /^\d{4}-\d{2}$/.test(c.month))
          .sort((a, b) => (a.month < b.month ? 1 : -1));

        const sum = (f: (c: Contribution) => number) =>
          rows.reduce((acc2, c) => acc2 + f(c), 0);
        const employeeShare = sum((c) => c.employeeAmount);
        const employerShare = sum((c) => c.employerAmount);
        const pensionShare = sum((c) => c.pensionAmount);

        const contributions = rows.slice(0, 12);
        const lastContributionMonth = contributions[0]?.month ?? '';

        // The payload carries no active flag; treat an account as active
        // when its latest contribution is recent (EPFO passbooks lag ~2
        // months behind payroll).
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 4);
        const cutoffMonth = `${cutoff.getFullYear()}-${String(
          cutoff.getMonth() + 1
        ).padStart(2, '0')}`;
        const isActive = lastContributionMonth >= cutoffMonth;

        return {
          memberId: String(acc?.passbook?.[0]?.member_id ?? memberId),
          establishmentName: String(acc?.company_name ?? 'Unknown employer'),
          balance: {
            employeeShare,
            employerShare,
            pensionShare,
            total: employeeShare + employerShare + pensionShare,
          },
          contributions,
          lastContributionMonth,
          isActive,
        };
      }
    );

    if (accounts.length === 0) throw new PFError('UNKNOWN', false);

    return {
      uan: String(data.pf_uan ?? data.uan ?? ''),
      memberName: String(data.full_name ?? data.name ?? ''),
      accounts,
      fetchedAt: new Date().toISOString(),
      provider: this.name,
    };
  }

  async healthCheck(): Promise<ProviderHealth> {
    const checkedAt = new Date().toISOString();
    if (!process.env.PF_PROVIDER_BASE_URL || !process.env.PF_PROVIDER_API_KEY) {
      return {
        provider: this.name,
        ok: false,
        checkedAt,
        detail: 'not configured (PF_PROVIDER_BASE_URL / PF_PROVIDER_API_KEY)',
      };
    }
    // Surepass exposes no dedicated health endpoint; reachability of the
    // API host is the best cheap signal (any HTTP response counts — a 404
    // still proves the host is up; only network failure marks it down).
    try {
      const res = await fetch(this.baseUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5_000),
        cache: 'no-store',
      });
      return {
        provider: this.name,
        ok: true,
        checkedAt,
        detail: `reachable (HTTP ${res.status})`,
      };
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
