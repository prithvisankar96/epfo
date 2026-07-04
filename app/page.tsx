import Link from 'next/link';
import { en } from '@/lib/strings';

export default function LandingPage() {
  const s = en.landing;
  return (
    <div className="space-y-12">
      {/* Hero band: display weight 900 on the sage canvas, lime CTA pill */}
      <section className="space-y-6 pt-6 text-center sm:pt-12">
        <h1 className="mx-auto max-w-2xl text-4xl font-black leading-[0.95] tracking-tight text-ink sm:text-6xl">
          {s.heroTitle}
        </h1>
        <p className="mx-auto max-w-xl text-lg leading-relaxed text-bodytext">
          {s.heroSubtitle}
        </p>
        <Link
          href="/check"
          className="inline-block rounded-3xl bg-primary px-8 py-3.5 text-base font-semibold text-ink transition hover:bg-primary-active focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2 focus:ring-offset-canvas-soft"
        >
          {s.cta}
        </Link>
      </section>

      {/* White content cards on the sage canvas — surface contrast is the elevation */}
      <section className="grid gap-4 sm:grid-cols-3">
        {s.trust.map((t) => (
          <div key={t.title} className="rounded-3xl bg-canvas p-6">
            <h2 className="mb-2 text-base font-semibold tracking-tight text-ink">
              {t.title}
            </h2>
            <p className="text-sm leading-relaxed text-bodytext">{t.body}</p>
          </div>
        ))}
      </section>

      {/* Polarity-flipped dark feature card: ink surface, Wise-green text */}
      <section className="rounded-3xl bg-ink p-6 sm:p-8">
        <h2 className="mb-5 text-2xl font-black tracking-tight text-primary">
          How it works
        </h2>
        <ol className="space-y-4">
          {s.howItWorks.map((step, i) => (
            <li key={step} className="flex items-start gap-4 text-canvas-soft">
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-ink"
              >
                {i + 1}
              </span>
              <span className="pt-0.5 text-sm leading-relaxed sm:text-base">
                {step}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
