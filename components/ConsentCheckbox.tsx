import Link from 'next/link';
import { en } from '@/lib/strings';

export default function ConsentCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const s = en.consent;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed text-neutral-700">
        {s.body}
      </div>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-5 w-5 rounded border-neutral-300 text-brand-600 accent-brand-600 focus:ring-brand-500"
          data-testid="consent-checkbox"
        />
        <span className="text-sm font-medium text-neutral-900">
          {s.checkboxLabel}
        </span>
      </label>
      <p className="text-xs text-neutral-500">
        <Link href="/privacy" target="_blank" className="underline">
          {s.privacyLinkText}
        </Link>
      </p>
    </div>
  );
}
