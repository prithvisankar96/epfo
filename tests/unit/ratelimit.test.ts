import { describe, expect, it } from 'vitest';
import { checkRateLimit, clientIp } from '@/lib/ratelimit';

describe('checkRateLimit', () => {
  it('allows 5 initiates then blocks the 6th for the same IP', () => {
    const ip = '203.0.113.7';
    for (let i = 0; i < 5; i++) expect(checkRateLimit(ip)).toBe(true);
    expect(checkRateLimit(ip)).toBe(false);
  });

  it('tracks IPs independently', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('203.0.113.8');
    expect(checkRateLimit('203.0.113.9')).toBe(true);
  });
});

describe('clientIp', () => {
  it('uses the first x-forwarded-for hop', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '198.51.100.4, 10.0.0.1' },
    });
    expect(clientIp(req)).toBe('198.51.100.4');
  });

  it('falls back to unknown', () => {
    expect(clientIp(new Request('http://localhost'))).toBe('unknown');
  });
});
