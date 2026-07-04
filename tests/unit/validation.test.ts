import { describe, expect, it } from 'vitest';
import {
  completeBodySchema,
  initiateBodySchema,
  mobileSchema,
  otpSchema,
  uanSchema,
} from '@/lib/validation';

describe('uanSchema', () => {
  it('accepts a 12-digit UAN', () => {
    expect(uanSchema.safeParse('123456789012').success).toBe(true);
  });
  it('trims surrounding whitespace', () => {
    expect(uanSchema.safeParse(' 123456789012 ').success).toBe(true);
  });
  it.each(['12345678901', '1234567890123', '12345678901a', '', 'abcdefghijkl'])(
    'rejects %j',
    (bad) => {
      expect(uanSchema.safeParse(bad).success).toBe(false);
    }
  );
});

describe('mobileSchema', () => {
  it('accepts a valid Indian mobile', () => {
    expect(mobileSchema.safeParse('9876543210').success).toBe(true);
    expect(mobileSchema.safeParse('6000000000').success).toBe(true);
  });
  it.each(['1234567890', '987654321', '98765432101', '5876543210', ''])(
    'rejects %j',
    (bad) => {
      expect(mobileSchema.safeParse(bad).success).toBe(false);
    }
  );
});

describe('otpSchema', () => {
  it('accepts 6 digits', () => {
    expect(otpSchema.safeParse('123456').success).toBe(true);
  });
  it.each(['12345', '1234567', '12345a', ''])('rejects %j', (bad) => {
    expect(otpSchema.safeParse(bad).success).toBe(false);
  });
});

describe('initiateBodySchema', () => {
  const valid = {
    uan: '123456789000',
    mobile: '9876543210',
    consentAccepted: true as const,
  };
  it('accepts a valid body', () => {
    expect(initiateBodySchema.safeParse(valid).success).toBe(true);
  });
  it('rejects consentAccepted: false — consent must be explicit', () => {
    expect(
      initiateBodySchema.safeParse({ ...valid, consentAccepted: false }).success
    ).toBe(false);
  });
  it('rejects a missing consent field', () => {
    const { consentAccepted, ...rest } = valid;
    expect(initiateBodySchema.safeParse(rest).success).toBe(false);
  });
});

describe('completeBodySchema', () => {
  it('accepts a valid body', () => {
    expect(
      completeBodySchema.safeParse({ transactionId: 'abc', otp: '123456' })
        .success
    ).toBe(true);
  });
  it('rejects an empty transactionId', () => {
    expect(
      completeBodySchema.safeParse({ transactionId: '', otp: '123456' })
        .success
    ).toBe(false);
  });
});
