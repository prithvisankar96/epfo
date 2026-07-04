'use client';

import { useState } from 'react';
import BalanceCard from './BalanceCard';
import ContributionChart from './ContributionChart';
import ContributionTable from './ContributionTable';
import SplitTiles from './SplitTiles';
import type { PFAccountData } from '@/lib/providers/types';
import { en } from '@/lib/strings';

// Client shell for the result screen: owns the account-switcher state and
// composes the §5 sections. Defaults to the account with the latest
// contribution month.

function defaultAccountIndex(data: PFAccountData): number {
  let best = 0;
  for (let i = 1; i < data.accounts.length; i++) {
    if (
      data.accounts[i].lastContributionMonth >
      data.accounts[best].lastContributionMonth
    ) {
      best = i;
    }
  }
  return best;
}

export default function Dashboard({ data }: { data: PFAccountData }) {
  const [selected, setSelected] = useState(() => defaultAccountIndex(data));
  const account = data.accounts[selected];
  const s = en.dashboard;

  // Chart needs ≥ 3 months of data to be meaningful; below that, the
  // contributions table alone tells the story (§5.3).
  const showChart = account.contributions.length >= 3;

  return (
    <div className="space-y-4" data-testid="dashboard">
      <BalanceCard
        memberName={data.memberName}
        uan={data.uan}
        fetchedAt={data.fetchedAt}
        accounts={data.accounts}
        selectedIndex={selected}
        onSelect={setSelected}
      />

      <SplitTiles balance={account.balance} />

      {showChart && (
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-neutral-900">
            {s.trendTitle}
          </h2>
          <ContributionChart contributions={account.contributions} />
        </section>
      )}

      <section className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-neutral-900">
          {s.contributionsTitle}
        </h2>
        <ContributionTable contributions={account.contributions} />
      </section>
    </div>
  );
}
