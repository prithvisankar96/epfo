import { redirect } from 'next/navigation';
import Dashboard from '@/components/Dashboard';
import { getSession } from '@/lib/session';
import { en } from '@/lib/strings';
import { checkAnotherUan } from './actions';

export const dynamic = 'force-dynamic';

// Dashboard route (§5). PF data is read from the server-side session —
// it is never in the URL, never in client storage. No session → back to /check.

export default function ResultPage() {
  const session = getSession();
  const data = session?.data.data;
  if (!data) redirect('/check');

  return (
    <div className="space-y-6">
      <Dashboard data={data} />

      <p className="text-xs leading-relaxed text-neutral-500">
        {en.dashboard.freshnessNote}
      </p>

      <form action={checkAnotherUan}>
        <button
          type="submit"
          data-testid="check-another"
          className="w-full rounded-xl border border-neutral-300 bg-white px-6 py-3 font-semibold text-neutral-700 transition hover:bg-neutral-100 sm:w-auto"
        >
          {en.dashboard.checkAnother}
        </button>
      </form>
    </div>
  );
}
