import Link from 'next/link';
import { en } from '@/lib/strings';

export default function LandingPage() {
  const s = en.landing;
  return (
    <div className="space-y-10">
      <section className="space-y-4 pt-4 text-center sm:pt-10">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          {s.heroTitle}
        </h1>
        <p className="mx-auto max-w-xl text-neutral-600">{s.heroSubtitle}</p>
        <Link
          href="/check"
          className="inline-block rounded-xl bg-brand-600 px-8 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
        >
          {s.cta}
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {s.trust.map((t) => (
          <div
            key={t.title}
            className="rounded-xl border border-neutral-200 bg-white p-4"
          >
            <h2 className="mb-1 font-semibold text-neutral-900">{t.title}</h2>
            <p className="text-sm text-neutral-600">{t.body}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-brand-100 bg-brand-50 p-5">
        <h2 className="mb-3 font-semibold text-brand-900">How it works</h2>
        <ol className="space-y-2">
          {s.howItWorks.map((step, i) => (
            <li key={step} className="flex gap-3 text-sm text-brand-900">
              <span
                aria-hidden
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white"
              >
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
