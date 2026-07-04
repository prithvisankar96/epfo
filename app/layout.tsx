import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import { en } from '@/lib/strings';

// Inter is DESIGN.md's prescribed substitute for the proprietary display
// face: weight 900 carries hero/display type, 600 sub-displays, 400 body.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: `${en.app.name} — ${en.app.tagline}`,
  description:
    'Check your EPF balance and recent contributions in under 60 seconds using only your UAN and an OTP. No EPFO password needed, nothing stored.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#9fe870',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <header className="bg-canvas">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-base font-black text-ink"
              >
                ₹
              </span>
              <span className="text-lg font-black tracking-tight text-ink">
                {en.app.name}
              </span>
            </Link>
            <span className="hidden text-sm font-semibold text-ink sm:block">
              {en.app.tagline}
            </span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:py-12">
          {children}
        </main>
        <footer className="bg-ink">
          <div className="mx-auto max-w-3xl space-y-3 px-6 py-12 text-sm text-canvas-soft">
            <p className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-black text-ink"
              >
                ₹
              </span>
              <span className="font-black text-canvas">{en.app.name}</span>
            </p>
            <p>
              <Link
                href="/privacy"
                className="font-semibold text-canvas-soft underline hover:text-canvas"
              >
                {en.footer.privacy}
              </Link>
            </p>
            <p className="text-xs leading-relaxed text-canvas-soft/70">
              {en.footer.disclaimer}
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
