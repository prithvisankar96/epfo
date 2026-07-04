'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatINR, formatMonth, formatNumber } from '@/lib/format';
import type { Contribution } from '@/lib/providers/types';
import { en } from '@/lib/strings';

// Stacked monthly bars: employee + employer share (§5.3). If fewer than
// 3 months of data exist, the parent renders the table instead of this
// chart. Colors are the validated 2-slot categorical palette (CVD ΔE 73.6
// on white); the aqua slot is sub-3:1 contrast, relieved by the full
// contributions table rendered directly below.

const EMPLOYEE_COLOR = '#2a78d6';
const EMPLOYER_COLOR = '#1baf7a';
const MUTED_INK = '#898781';
const GRIDLINE = '#e1e0d9';

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  const employee = payload.find((p) => p.dataKey === 'employeeAmount');
  const employer = payload.find((p) => p.dataKey === 'employerAmount');
  return (
    <div className="rounded-lg bg-neutral-900 px-3 py-2 text-xs text-white shadow-lg">
      <p className="mb-1 font-semibold">{formatMonth(label)}</p>
      <p className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-2 w-2 rounded-full"
          style={{ background: EMPLOYEE_COLOR }}
        />
        {en.dashboard.tableEmployee.replace(' ₹', '')}:{' '}
        {formatINR(employee?.value ?? 0)}
      </p>
      <p className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-2 w-2 rounded-full"
          style={{ background: EMPLOYER_COLOR }}
        />
        {en.dashboard.tableEmployer.replace(' ₹', '')}:{' '}
        {formatINR(employer?.value ?? 0)}
      </p>
    </div>
  );
}

export default function ContributionChart({
  contributions,
}: {
  contributions: Contribution[];
}) {
  // Contributions arrive most-recent-first; the chart reads left→right.
  const data = contributions.slice().reverse();

  return (
    <div data-testid="contribution-chart">
      <div className="mb-2 flex items-center gap-4 text-xs text-neutral-600">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: EMPLOYEE_COLOR }}
          />
          Employee
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: EMPLOYER_COLOR }}
          />
          Employer
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRIDLINE} />
          <XAxis
            dataKey="month"
            tickFormatter={(m: string) => formatMonth(m).split(' ')[0]}
            tick={{ fontSize: 11, fill: MUTED_INK }}
            tickLine={false}
            axisLine={{ stroke: GRIDLINE }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v: number) => formatNumber(v)}
            tick={{ fontSize: 11, fill: MUTED_INK }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          />
          <Bar
            dataKey="employeeAmount"
            stackId="contribution"
            fill={EMPLOYEE_COLOR}
            stroke="#ffffff"
            strokeWidth={1}
            maxBarSize={28}
          />
          <Bar
            dataKey="employerAmount"
            stackId="contribution"
            fill={EMPLOYER_COLOR}
            stroke="#ffffff"
            strokeWidth={1}
            maxBarSize={28}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
