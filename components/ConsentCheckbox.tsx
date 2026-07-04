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
      {/* Soft-green feature surface for the consent copy */}
      <div className="rounded-2xl bg-primary-pale p-4 text-sm leading-relaxed text-ink-deep">
        {s.body}
      </div>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-5 w-5 rounded border-ink accent-primary"
          data-testid="consent-checkbox"
        />
        <span className="text-sm font-semibold text-ink">
          {s.checkboxLabel}
        </span>
      </label>
      <p className="text-xs text-mute">
        <Link href="/privacy" target="_blank" className="underline">
          {s.privacyLinkText}
        </Link>
      </p>
    </div>
  );
}
