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
    return <p className="text-sm text-neutral-500">{s.noContributions}</p>;
  }

  return (
    <div data-testid="contribution-table">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="py-2 pr-2 font-medium">{s.tableMonth}</th>
              <th className="py-2 pr-2 text-right font-medium">
                {s.tableEmployee}
              </th>
              <th className="py-2 pr-2 text-right font-medium">
                {s.tableEmployer}
              </th>
              <th className="py-2 text-right font-medium">{s.tablePension}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((c) => (
              <tr key={c.month} className="border-b border-neutral-100">
                <td className="py-2 pr-2 text-neutral-700">
                  {formatMonth(c.month)}
                </td>
                <td className="py-2 pr-2 text-right text-neutral-900">
                  {formatNumber(c.employeeAmount)}
                </td>
                <td className="py-2 pr-2 text-right text-neutral-900">
                  {formatNumber(c.employerAmount)}
                </td>
                <td className="py-2 text-right text-neutral-900">
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
          className="mt-3 text-sm font-medium text-brand-700 underline"
        >
          {expanded ? s.showLess : s.showAll}
        </button>
      )}
    </div>
  );
}
