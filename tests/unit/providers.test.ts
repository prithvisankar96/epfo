import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AggregatorProvider,
  mapVendorError,
  normalizeAmount,
  normalizeMonth,
} from '@/lib/providers/aggregator';
import { PFError } from '@/lib/providers/errors';
import { MockProvider } from '@/lib/providers/mock';

beforeAll(() => {
  process.env.MOCK_DELAY_MS = '0';
});

const UAN = (suffix: string) => `1234567890${suffix}`;
const MOBILE = '9876543210';

async function initiate(provider: MockProvider, suffix: string) {
  return provider.initiateFetch({
    uan: UAN(suffix),
    mobile: MOBILE,
    consentId: 'consent-test',
  });
}

describe('MockProvider', () => {
  const provider = new MockProvider();

  it('happy path (…00): two accounts, 12 contributions each', async () => {
    const init = await initiate(provider, '00');
    expect(init.otpSentTo).toBe('+91 98XXXXXX10');
    const data = await provider.completeFetch({
      transactionId: init.transactionId,
      otp: '123456',
    });
    expect(data.uan).toBe(UAN('00'));
    expect(data.provider).toBe('mock');
    expect(data.accounts).toHaveLength(2);
    for (const acc of data.accounts) {
      expect(acc.contributions).toHaveLength(12);
      expect(acc.balance.total).toBe(
        acc.balance.employeeShare +
          acc.balance.employerShare +
          acc.balance.pensionShare
      );
      // most recent first
      const months = acc.contributions.map((c) => c.month);
      expect([...months].sort().reverse()).toEqual(months);
    }
  });

  it('is deterministic for the same UAN', async () => {
    const a = await provider.completeFetch({
      transactionId: (await initiate(provider, '00')).transactionId,
      otp: '123456',
    });
    const b = await provider.completeFetch({
      transactionId: (await initiate(provider, '00')).transactionId,
      otp: '123456',
    });
    expect(a.accounts[0].balance).toEqual(b.accounts[0].balance);
    expect(a.memberName).toBe(b.memberName);
  });

  it.each([
    ['02', 'UAN_INACTIVE'],
    ['03', 'EPFO_UNAVAILABLE'],
    ['04', 'MOBILE_MISMATCH'],
    ['05', 'INVALID_UAN'],
    ['06', 'PROVIDER_UNAVAILABLE'],
    ['07', 'UNKNOWN'],
  ] as const)('UAN …%s throws %s at initiate', async (suffix, code) => {
    await expect(initiate(provider, suffix)).rejects.toMatchObject({ code });
  });

  it('UAN …01 throws EXEMPTED_TRUST only after a valid OTP', async () => {
    const init = await initiate(provider, '01');
    await expect(
      provider.completeFetch({ transactionId: init.transactionId, otp: '123456' })
    ).rejects.toMatchObject({ code: 'EXEMPTED_TRUST' });
  });

  it('wrong OTP throws OTP_INVALID', async () => {
    const init = await initiate(provider, '00');
    await expect(
      provider.completeFetch({ transactionId: init.transactionId, otp: '999999' })
    ).rejects.toMatchObject({ code: 'OTP_INVALID' });
  });

  it('OTP 000000 throws OTP_EXPIRED', async () => {
    const init = await initiate(provider, '00');
    await expect(
      provider.completeFetch({ transactionId: init.transactionId, otp: '000000' })
    ).rejects.toMatchObject({ code: 'OTP_EXPIRED' });
  });

  it('…10 yields a single account with 2 contributions (chart fallback case)', async () => {
    const init = await initiate(provider, '10');
    const data = await provider.completeFetch({
      transactionId: init.transactionId,
      otp: '123456',
    });
    expect(data.accounts).toHaveLength(1);
    expect(data.accounts[0].contributions).toHaveLength(2);
  });

  it('…11 yields a zero-balance account', async () => {
    const init = await initiate(provider, '11');
    const data = await provider.completeFetch({
      transactionId: init.transactionId,
      otp: '123456',
    });
    expect(data.accounts[0].balance.total).toBe(0);
    expect(data.accounts[0].contributions).toHaveLength(0);
  });
});

describe('aggregator normalization', () => {
  it('normalizeAmount handles numbers, decimal strings, and Indian formatting', () => {
    expect(normalizeAmount(12345)).toBe(12345);
    expect(normalizeAmount(12345.67)).toBe(12346);
    expect(normalizeAmount('12345.67')).toBe(12346);
    expect(normalizeAmount('1,23,456')).toBe(123456);
    expect(normalizeAmount('₹ 1,23,456')).toBe(123456);
    expect(normalizeAmount(undefined)).toBe(0);
    expect(normalizeAmount('n/a')).toBe(0);
  });

  it('normalizeMonth handles the vendor month formats', () => {
    expect(normalizeMonth('2026-05')).toBe('2026-05');
    expect(normalizeMonth('2026/5')).toBe('2026-05');
    expect(normalizeMonth('05/2026')).toBe('2026-05');
    expect(normalizeMonth('5-2026')).toBe('2026-05');
    expect(normalizeMonth('May-2026')).toBe('2026-05');
    expect(normalizeMonth('MAY 2026')).toBe('2026-05');
    expect(normalizeMonth('September 2025')).toBe('2025-09');
    expect(normalizeMonth('2026 May')).toBe('2026-05');
  });
});

describe('aggregator error mapping', () => {
  it.each([
    [422, 'UAN not found in records', 'INVALID_UAN'],
    [422, 'Invalid UAN provided', 'INVALID_UAN'],
    [422, 'UAN not activated', 'UAN_INACTIVE'],
    [422, 'Mobile not linked with UAN', 'MOBILE_MISMATCH'],
    [422, 'Invalid OTP', 'OTP_INVALID'],
    [422, 'OTP expired, request a new one', 'OTP_EXPIRED'],
    [422, 'Maximum attempts exceeded', 'OTP_MAX_ATTEMPTS'],
    [422, 'Establishment is exempted', 'EXEMPTED_TRUST'],
    [502, 'EPFO servers are down', 'EPFO_UNAVAILABLE'],
    [429, '', 'RATE_LIMITED'],
    [503, '', 'EPFO_UNAVAILABLE'],
    [500, 'internal server error', 'PROVIDER_UNAVAILABLE'],
    [400, 'weird new failure', 'UNKNOWN'],
  ] as const)('message text: %s "%s" → %s', (status, message, code) => {
    const err = mapVendorError(status, message);
    expect(err).toBeInstanceOf(PFError);
    expect(err.code).toBe(code);
  });

  it.each([
    ['invalid_otp', 'OTP_INVALID'],
    ['otp_expired', 'OTP_EXPIRED'],
    ['invalid_client_id', 'OTP_EXPIRED'],
    ['record_not_found', 'INVALID_UAN'],
    ['invalid_input', 'INVALID_UAN'],
    ['source_down', 'EPFO_UNAVAILABLE'],
    ['insufficient_credits', 'PROVIDER_UNAVAILABLE'],
    ['unauthorized', 'PROVIDER_UNAVAILABLE'],
  ] as const)('message_code %s → %s', (messageCode, code) => {
    // message_code wins even when the human text is unhelpful
    expect(mapVendorError(400, 'Bad Request', messageCode).code).toBe(code);
  });
});

describe('AggregatorProvider against documented Surepass payloads', () => {
  const provider = new AggregatorProvider();

  beforeEach(() => {
    process.env.PF_PROVIDER_BASE_URL = 'https://sandbox.surepass.io/api/v1';
    process.env.PF_PROVIDER_API_KEY = 'test-token';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(routes: Record<string, { status: number; json: any }>) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const route = Object.keys(routes).find((p) => String(url).endsWith(p));
        if (!route) throw new Error(`unexpected fetch: ${url}`);
        const { status, json } = routes[route];
        return new Response(JSON.stringify(json), { status });
      })
    );
  }

  it('initiateFetch maps the generate-otp response', async () => {
    stubFetch({
      '/income/epfo/passbook/generate-otp': {
        status: 200,
        json: {
          data: {
            client_id: 'income_epfo_passbook_abc',
            otp_sent: true,
            masked_mobile_number: 'XXXXXX3210',
          },
          status_code: 200,
          message_code: 'success',
          success: true,
        },
      },
    });
    const res = await provider.initiateFetch({
      uan: '101550652226',
      mobile: '9876543210',
      consentId: 'c1',
    });
    expect(res.transactionId).toBe('income_epfo_passbook_abc');
    expect(res.otpSentTo).toBe('+91 XXXXXX3210');
  });

  it('initiateFetch throws MOBILE_MISMATCH when the registered tail differs', async () => {
    stubFetch({
      '/income/epfo/passbook/generate-otp': {
        status: 200,
        json: {
          data: {
            client_id: 'income_epfo_passbook_abc',
            otp_sent: true,
            masked_mobile_number: 'XXXXXX5699',
          },
          success: true,
        },
      },
    });
    await expect(
      provider.initiateFetch({
        uan: '101550652226',
        mobile: '9876543210',
        consentId: 'c1',
      })
    ).rejects.toMatchObject({ code: 'MOBILE_MISMATCH' });
  });

  it('completeFetch validates OTP, fetches and normalizes the passbook', async () => {
    stubFetch({
      '/income/epfo/passbook/submit-otp': {
        status: 200,
        json: { data: { otp_validated: true }, success: true },
      },
      '/income/epfo/passbook/get-passbook': {
        status: 200,
        json: {
          data: {
            client_id: 'income_epfo_passbook_abc',
            pf_uan: '101550652226',
            full_name: 'JOHN DOE',
            companies: {
              RJRAJ00161550000031234: {
                company_name: 'M/S ABC BANK LIMITED',
                establishment_id: 'RJRAJ0016112345',
                passbook: [
                  {
                    member_id: 'RJRAJ00161550000031234',
                    year: '2020',
                    month: '01',
                    employee_share: '770',
                    employer_share: '235',
                    approved_on: '2020-01-14',
                  },
                  {
                    member_id: 'RJRAJ00161550000031234',
                    year: '2020',
                    month: '02',
                    employee_share: '800',
                    employer_share: '244',
                    pension_share: '556',
                    approved_on: '2020-02-14',
                  },
                ],
              },
            },
          },
          success: true,
        },
      },
    });
    const data = await provider.completeFetch({
      transactionId: 'income_epfo_passbook_abc',
      otp: '582430',
    });
    expect(data.uan).toBe('101550652226');
    expect(data.memberName).toBe('JOHN DOE');
    expect(data.accounts).toHaveLength(1);
    const acc = data.accounts[0];
    expect(acc.establishmentName).toBe('M/S ABC BANK LIMITED');
    expect(acc.memberId).toBe('RJRAJ00161550000031234');
    // most recent first, YYYY-MM normalized
    expect(acc.contributions.map((c) => c.month)).toEqual([
      '2020-02',
      '2020-01',
    ]);
    expect(acc.balance).toEqual({
      employeeShare: 1570,
      employerShare: 479,
      pensionShare: 556,
      total: 2605,
    });
    // dormant account (last contribution 2020) → inactive
    expect(acc.isActive).toBe(false);
  });

  it('completeFetch maps an invalid OTP without calling get-passbook', async () => {
    stubFetch({
      '/income/epfo/passbook/submit-otp': {
        status: 400,
        json: {
          data: { otp_validated: false },
          status_code: 400,
          message_code: 'invalid_otp',
          message: 'The OTP provided is invalid or has expired',
          success: false,
        },
      },
    });
    await expect(
      provider.completeFetch({ transactionId: 'abc', otp: '000001' })
    ).rejects.toMatchObject({ code: 'OTP_INVALID' });
  });
});
