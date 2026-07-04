import { formatINR, formatTimestamp, maskUan } from '@/lib/format';
import type { MemberAccount } from '@/lib/providers/types';
import { en } from '@/lib/strings';

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
    <section className="overflow-hidden rounded-2xl bg-brand-700 text-white shadow-md">
      {accounts.length > 1 && (
        <div
          className="flex overflow-x-auto border-b border-brand-600"
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
                'shrink-0 px-4 py-2.5 text-left text-xs font-medium transition ' +
                (i === selectedIndex
                  ? 'bg-brand-600 text-white'
                  : 'text-brand-100 hover:bg-brand-600/50')
              }
            >
              {acc.establishmentName}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm text-brand-100">{s.totalBalance}</span>
          {!account.isActive && (
            <span className="rounded-full bg-brand-900/60 px-2.5 py-0.5 text-xs text-brand-100">
              {s.inactiveBadge}
            </span>
          )}
        </div>
        <p
          className="text-4xl font-bold tracking-tight sm:text-5xl"
          data-testid="total-balance"
        >
          {formatINR(account.balance.total)}
        </p>
        <div className="space-y-0.5 text-sm text-brand-100">
          <p data-testid="member-name">
            {memberName} · <span className="font-mono">{maskUan(uan)}</span>
          </p>
          <p className="truncate">{account.establishmentName}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-1 border-t border-brand-600 pt-3 text-xs text-brand-100/80">
          <span>{s.asOf(formatTimestamp(fetchedAt))}</span>
          <span>{s.disclaimer}</span>
        </div>
      </div>
    </section>
  );
}
