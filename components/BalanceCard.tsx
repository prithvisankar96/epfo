import { formatINR, formatTimestamp, maskUan } from '@/lib/format';
import type { MemberAccount } from '@/lib/providers/types';
import { en } from '@/lib/strings';

// The hero balance uses the brand's polarity-flipped dark card: ink
// surface, Wise-green display type at weight 900 — the promotional moment.

export default function BalanceCard({
  memberName,
  uan,
  fetchedAt,
  accounts,
  selectedIndex,
  onSelect,
}: {
  memberName: string;
  uan: string;
  fetchedAt: string;
  accounts: MemberAccount[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const s = en.dashboard;
  const account = accounts[selectedIndex];

  return (
    <section className="overflow-hidden rounded-3xl bg-ink text-canvas-soft">
      {accounts.length > 1 && (
        <div
          className="flex overflow-x-auto px-3 pt-3"
          role="tablist"
          aria-label="PF accounts"
        >
          {accounts.map((acc, i) => (
            <button
              key={acc.memberId}
              role="tab"
              aria-selected={i === selectedIndex}
              onClick={() => onSelect(i)}
              data-testid={`account-tab-${i}`}
              className={
                'shrink-0 border-b-2 px-3 py-2.5 text-left text-xs font-semibold transition ' +
                (i === selectedIndex
                  ? 'border-primary text-primary'
                  : 'border-transparent text-canvas-soft/60 hover:text-canvas-soft')
              }
            >
              {acc.establishmentName}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-3 p-6 sm:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm text-canvas-soft/80">{s.totalBalance}</span>
          {!account.isActive && (
            <span className="rounded-full bg-canvas-soft/15 px-3 py-1 text-xs font-semibold text-canvas-soft">
              {s.inactiveBadge}
            </span>
          )}
        </div>
        <p
          className="text-5xl font-black leading-none tracking-tight text-primary sm:text-6xl"
          data-testid="total-balance"
        >
          {formatINR(account.balance.total)}
        </p>
        <div className="space-y-0.5 pt-1 text-sm">
          <p data-testid="member-name" className="font-semibold text-canvas">
            {memberName} ·{' '}
            <span className="font-normal text-canvas-soft/80">
              {maskUan(uan)}
            </span>
          </p>
          <p className="truncate text-canvas-soft/80">
            {account.establishmentName}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-1 border-t border-canvas-soft/15 pt-4 text-xs text-canvas-soft/60">
          <span>{s.asOf(formatTimestamp(fetchedAt))}</span>
          <span>{s.disclaimer}</span>
        </div>
      </div>
    </section>
  );
}
