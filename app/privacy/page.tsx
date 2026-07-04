import type { Metadata } from 'next';
import { CONSENT_TEXT_VERSION } from '@/lib/consent';

export const metadata: Metadata = {
  title: 'Privacy policy — PF Pulse',
};

// Plain-English privacy policy (§7). Reviewed against the DPDP Act posture:
// explicit purpose-limited consent, zero retention beyond session, minimization.

export default function PrivacyPage() {
  return (
    <article className="prose-sm max-w-none space-y-6 rounded-3xl bg-canvas p-6 text-bodytext sm:p-8">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-ink">Privacy policy</h1>
        <p className="mt-1 text-sm text-mute">
          Effective July 2026 · Consent text version {CONSENT_TEXT_VERSION}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-ink">
          The short version
        </h2>
        <p>
          PF Pulse shows you your EPF balance, once, with your explicit
          consent. We never see your EPFO password, we don&rsquo;t keep your
          balance after your session ends, and we don&rsquo;t sell or share
          your data with anyone.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-ink">
          What we collect, and why
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Your UAN and mobile number</strong> — used only to request
            your EPF passbook from EPFO records through a secure verification
            service, after you tick the consent box. They are sent to that
            service and are not written to our logs or stored in your browser.
          </li>
          <li>
            <strong>The OTP you enter</strong> — passed straight through to
            verify the fetch. Never logged, never stored.
          </li>
          <li>
            <strong>Your PF data</strong> (balance, share split, recent
            contributions) — held in server memory tied to your session for at
            most 30 minutes, then deleted. Choosing &ldquo;Check another
            UAN&rdquo; deletes it immediately. We keep no database of balances.
          </li>
          <li>
            <strong>A consent record</strong> — Indian data-protection law
            (the DPDP Act) requires us to be able to prove you consented. We
            store a one-way hash of your UAN (the UAN itself cannot be
            recovered from it), a masked version of your mobile number, the
            consent text version, a timestamp, and your IP address.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-ink">
          What we deliberately don&rsquo;t do
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>No EPFO passwords — the flow is OTP-only, ever.</li>
          <li>
            No extra data — we fetch only passbook and balance data. We never
            request your PAN, Aadhaar details, or any other KYC information,
            even where the verification service offers them.
          </li>
          <li>
            No third-party analytics, ad trackers, or marketing pixels. At most
            we count page views, without anything that identifies you.
          </li>
          <li>
            No storing PF data in your browser — no localStorage, no
            sessionStorage. Your session is identified by a single encrypted,
            httpOnly cookie that JavaScript cannot read.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-ink">
          Who else is involved
        </h2>
        <p>
          Fetches go through a regulated verification-API provider that
          connects to EPFO records. Your UAN, mobile number, and OTP are shared
          with that provider solely to perform the one-time fetch you
          consented to. We are not affiliated with EPFO.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-ink">
          Your choices
        </h2>
        <p>
          Everything here is opt-in: nothing is fetched until you enter your
          details, tick the consent box, and confirm with the OTP. To erase
          your session data at any time, tap &ldquo;Check another UAN&rdquo; or
          simply close the tab — it expires on its own within 30 minutes.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-ink">Questions</h2>
        <p>
          If anything here is unclear, or you want a consent record deleted,
          contact us at privacy@pfpulse.in.
        </p>
      </section>
    </article>
  );
}
