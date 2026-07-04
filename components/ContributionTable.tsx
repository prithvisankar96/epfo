'use client';

import { useState } from 'react';
import { formatMonth, formatNumber } from '@/lib/format';
import type { Contribution } from '@/lib/providers/types';
import { en } from '@/lib/strings';

const COLLAPSED_ROWS = 6;

export default function ContributionTable({
  contributions,
}: {
  contributions: Contribution[];
}) {
  const s = en.dashboard;
  const [expanded, setExpanded] = useState(false);
  const rows = expanded
    ? contributions
    : contributions.slice(0, COLLAPSED_ROWS);

  if (contributions.length === 0) {
    return <p className="text-sm text-bodytext">{s.noContributions}</p>;
  }

  return (
    <div data-testid="contribution-table">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-canvas-soft text-left text-xs uppercase tracking-wide text-bodytext">
              <th className="whitespace-nowrap rounded-l-lg px-2 py-2 font-semibold">
                {s.tableMonth}
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">
                {s.tableEmployee}
              </th>
              <th className="whitespace-nowrap px-2 py-2 text-right font-semibold">
                {s.tableEmployer}
              </th>
              <th className="rounded-r-lg whitespace-nowrap px-2 py-2 text-right font-semibold">
                {s.tablePension}
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((c) => (
              <tr key={c.month} className="border-b border-canvas-soft">
                <td className="whitespace-nowrap px-2 py-2.5 text-bodytext">
                  {formatMonth(c.month)}
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right font-semibold text-ink">
                  {formatNumber(c.employeeAmount)}
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right font-semibold text-ink">
                  {formatNumber(c.employerAmount)}
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right font-semibold text-ink">
                  {formatNumber(c.pensionAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {contributions.length > COLLAPSED_ROWS && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          data-testid="table-toggle"
          className="mt-3 rounded-full bg-canvas-soft px-4 py-1.5 text-sm font-semibold text-ink transition hover:bg-primary-pale"
        >
          {expanded ? s.showLess : s.showAll}
        </button>
      )}
    </div>
  );
}
