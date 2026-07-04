import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import { en } from '@/lib/strings';

export const metadata: Metadata = {
  title: `${en.app.name} — ${en.app.tagline}`,
  description:
    'Check your EPF balance and recent contributions in under 60 seconds using only your UAN and an OTP. No EPFO password needed, nothing stored.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#156641',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-bold text-white"
              >
                ₹
              </span>
              <span className="text-lg font-semibold tracking-tight">
                {en.app.name}
              </span>
            </Link>
            <span className="hidden text-sm text-neutral-500 sm:block">
              {en.app.tagline}
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:py-10">
          {children}
        </main>
        <footer className="border-t border-neutral-200 bg-white">
          <div className="mx-auto max-w-3xl space-y-2 px-4 py-6 text-xs text-neutral-500">
            <p>
              <Link href="/privacy" className="underline hover:text-neutral-700">
                {en.footer.privacy}
              </Link>
            </p>
            <p>{en.footer.disclaimer}</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
