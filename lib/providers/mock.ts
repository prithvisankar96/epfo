import { PFError } from './errors';
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

// Deterministic fake provider keyed off the UAN entered. Powers all E2E
// tests and demo mode.
//
// Trigger table (last two digits of UAN):
//   …00  happy path — 2 accounts, 12 contributions each
//   …01  EXEMPTED_TRUST      (thrown at complete, after OTP — mirrors real
//                             life where trust status shows in the passbook)
//   …02  UAN_INACTIVE        (thrown at initiate)
//   …03  EPFO_UNAVAILABLE    (thrown at initiate)
//   …04  MOBILE_MISMATCH     (thrown at initiate)
//   …05  INVALID_UAN         (thrown at initiate)
//   …06  PROVIDER_UNAVAILABLE(thrown at initiate)
//   …07  UNKNOWN             (thrown at initiate)
//   …10  happy path, single account, 2 contributions (chart→table edge case)
//   …11  happy path, single account, zero balance
//   anything else → happy path, 1 account, 12 contributions
//
// OTP behaviour: "123456" succeeds; "000000" → OTP_EXPIRED; anything else
// → OTP_INVALID. Max-attempt lockout is enforced by the session layer.

const HAPPY_OTP = '123456';
const EXPIRED_OTP = '000000';

function delay(): Promise<void> {
  const ms = Number(process.env.MOCK_DELAY_MS ?? '400');
  return new Promise((r) => setTimeout(r, ms));
}

/** Tiny deterministic PRNG so the same UAN always yields the same data. */
function seededRandom(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function uanSeed(uan: string): number {
  let h = 0;
  for (const ch of uan) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h) + 1;
}

/** Last `n` months as "YYYY-MM", most recent first, ending last month. */
function recentMonths(n: number): string[] {
  const months: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 1; i <= n; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push(
      `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`
    );
  }
  return months;
}

function buildContributions(
  rand: () => number,
  count: number
): Contribution[] {
  const base = 1800 + Math.floor(rand() * 4200);
  return recentMonths(count).map((month) => {
    const employeeAmount = base + Math.floor(rand() * 300);
    // Employer 12% splits: 8.33% to EPS (capped at ₹1,250), rest to EPF.
    const pensionAmount = Math.min(1250, Math.round(employeeAmount * 0.6944));
    const employerAmount = employeeAmount - pensionAmount;
    return { month, employeeAmount, employerAmount, pensionAmount };
  });
}

function buildAccount(
  uan: string,
  index: number,
  opts: { contributions: number; zeroBalance?: boolean; active: boolean }
): MemberAccount {
  const rand = seededRandom(uanSeed(uan) + index * 7919);
  const contributions = buildContributions(rand, opts.contributions);
  const yearsOfService = 2 + Math.floor(rand() * 8);
  const scale = opts.zeroBalance ? 0 : yearsOfService * 12;
  const sum = (f: (c: Contribution) => number) =>
    Math.round(
      contributions.reduce((acc, c) => acc + f(c), 0) *
        (scale / Math.max(contributions.length, 1))
    );
  const employeeShare = sum((c) => c.employeeAmount);
  const employerShare = sum((c) => c.employerAmount);
  const pensionShare = sum((c) => c.pensionAmount);

  const establishments = [
    'Meridian Software Private Limited',
    'Cobalt Analytics India LLP',
    'Sundial Retail Ventures Limited',
  ];

  return {
    memberId: `MHBAN${String(uanSeed(uan) % 90000 + 10000)}000${index}`,
    establishmentName: establishments[index % establishments.length],
    balance: {
      employeeShare,
      employerShare,
      pensionShare,
      total: employeeShare + employerShare + pensionShare,
    },
    contributions: opts.zeroBalance ? [] : contributions,
    lastContributionMonth: contributions[0]?.month ?? '',
    isActive: opts.active,
  };
}

function memberNameFor(uan: string): string {
  const names = [
    'Ananya Krishnan',
    'Rahul Deshpande',
    'Priya Venkatesan',
    'Arjun Mehta',
    'Kavitha Nair',
  ];
  return names[uanSeed(uan) % names.length];
}

interface MockTxnPayload {
  uan: string;
  mobile: string;
  exp: number;
}

// The transaction id is a self-contained token so completeFetch works
// statelessly across route invocations (and across dev-server reloads).
function encodeTxn(payload: MockTxnPayload): string {
  return 'mock_' + Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeTxn(transactionId: string): MockTxnPayload | null {
  if (!transactionId.startsWith('mock_')) return null;
  try {
    return JSON.parse(
      Buffer.from(transactionId.slice(5), 'base64url').toString('utf8')
    ) as MockTxnPayload;
  } catch {
    return null;
  }
}

function maskMobile(mobile: string): string {
  return `+91 ${mobile.slice(0, 2)}XXXXXX${mobile.slice(8)}`;
}

export class MockProvider implements PFProvider {
  readonly name = 'mock';

  async initiateFetch(req: InitiateRequest): Promise<InitiateResult> {
    await delay();
    const suffix = req.uan.slice(-2);
    switch (suffix) {
      case '02':
        throw new PFError('UAN_INACTIVE', false);
      case '03':
        throw new PFError('EPFO_UNAVAILABLE', true);
      case '04':
        throw new PFError('MOBILE_MISMATCH', false);
      case '05':
        throw new PFError('INVALID_UAN', false);
      case '06':
        throw new PFError('PROVIDER_UNAVAILABLE', true);
      case '07':
        throw new PFError('UNKNOWN', true);
    }
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    return {
      transactionId: encodeTxn({
        uan: req.uan,
        mobile: req.mobile,
        exp: expiresAt.getTime(),
      }),
      otpSentTo: maskMobile(req.mobile),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async completeFetch(req: CompleteRequest): Promise<PFAccountData> {
    await delay();
    const txn = decodeTxn(req.transactionId);
    if (!txn) throw new PFError('UNKNOWN', false);
    if (Date.now() > txn.exp || req.otp === EXPIRED_OTP) {
      throw new PFError('OTP_EXPIRED', true);
    }
    if (req.otp !== HAPPY_OTP) throw new PFError('OTP_INVALID', true);

    const suffix = txn.uan.slice(-2);
    if (suffix === '01') throw new PFError('EXEMPTED_TRUST', false);

    const accounts: MemberAccount[] =
      suffix === '00'
        ? [
            buildAccount(txn.uan, 0, { contributions: 12, active: true }),
            buildAccount(txn.uan, 1, { contributions: 12, active: false }),
          ]
        : suffix === '10'
          ? [buildAccount(txn.uan, 0, { contributions: 2, active: true })]
          : suffix === '11'
            ? [
                buildAccount(txn.uan, 0, {
                  contributions: 12,
                  zeroBalance: true,
                  active: false,
                }),
              ]
            : [buildAccount(txn.uan, 0, { contributions: 12, active: true })];

    return {
      uan: txn.uan,
      memberName: memberNameFor(txn.uan),
      accounts,
      fetchedAt: new Date().toISOString(),
      provider: this.name,
    };
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      provider: this.name,
      ok: true,
      checkedAt: new Date().toISOString(),
    };
  }
}
