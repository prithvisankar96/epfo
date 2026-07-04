import { beforeAll, describe, expect, it } from 'vitest';
import {
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
  ] as const)('%s "%s" → %s', (status, message, code) => {
    const err = mapVendorError(status, message);
    expect(err).toBeInstanceOf(PFError);
    expect(err.code).toBe(code);
  });
});
