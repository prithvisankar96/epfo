'use client';

import { useState } from 'react';
import { formatINR } from '@/lib/format';
import type { MemberAccount } from '@/lib/providers/types';
import { en } from '@/lib/strings';

export default function SplitTiles({
  balance,
}: {
  balance: MemberAccount['balance'];
}) {
  const s = en.dashboard;
  const [tooltipOpen, setTooltipOpen] = useState(false);

  const tiles = [
    { label: s.employeeShare, value: balance.employeeShare, testId: 'employee-share' },
    { label: s.employerShare, value: balance.employerShare, testId: 'employer-share' },
    {
      label: s.pensionShare,
      value: balance.pensionShare,
      testId: 'pension-share',
      tooltip: s.epsTooltip,
    },
  ];

  return (
    <section className="grid grid-cols-3 gap-2 sm:gap-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="relative rounded-xl border border-neutral-200 bg-white p-3 sm:p-4"
          data-testid={tile.testId}
        >
          <div className="flex items-start gap-1 text-xs text-neutral-500 sm:text-sm">
            <span>{tile.label}</span>
            {tile.tooltip && (
              <button
                type="button"
                aria-label="What is EPS?"
                aria-expanded={tooltipOpen}
                onClick={() => setTooltipOpen((o) => !o)}
                onBlur={() => setTooltipOpen(false)}
                className="mt-px inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-[10px] font-bold text-neutral-500 hover:bg-neutral-100"
              >
                ?
              </button>
            )}
          </div>
          <p className="mt-1 text-base font-semibold text-neutral-900 sm:text-xl">
            {formatINR(tile.value)}
          </p>
          {tile.tooltip && tooltipOpen && (
            <div
              role="tooltip"
              className="absolute left-0 right-0 top-full z-10 mt-2 rounded-lg bg-neutral-900 p-3 text-xs leading-relaxed text-white shadow-lg sm:left-auto sm:w-64"
            >
              {tile.tooltip}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
