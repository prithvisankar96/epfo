'use client';

import { useEffect, useRef } from 'react';

// Six single-digit boxes with auto-advance, backspace navigation, and
// paste support. Value is plain state in the parent — never persisted.

export default function OTPInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (otp: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');

  const setDigit = (index: number, digit: string) => {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join(''));
  };

  return (
    <div className="flex justify-center gap-2" data-testid="otp-input">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={digit}
          aria-label={`OTP digit ${i + 1}`}
          data-testid={`otp-digit-${i}`}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            if (!v) {
              setDigit(i, '');
              return;
            }
            setDigit(i, v[v.length - 1]);
            refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digit && i > 0) {
              refs.current[i - 1]?.focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData
              .getData('text')
              .replace(/\D/g, '')
              .slice(0, 6);
            if (pasted) {
              onChange(pasted);
              refs.current[Math.min(pasted.length, 5)]?.focus();
            }
          }}
          className="h-12 w-10 rounded-xl border border-ink bg-canvas text-center text-xl font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-ink disabled:bg-canvas-soft sm:h-14 sm:w-12"
        />
      ))}
    </div>
  );
}
