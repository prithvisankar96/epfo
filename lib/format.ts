// Formatting helpers. Indian number system throughout (₹1,23,456).

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const inNumber = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function formatINR(amount: number): string {
  return inr.format(amount);
}

export function formatNumber(amount: number): string {
  return inNumber.format(amount);
}

/** "2026-05" → "May 2026" */
export function formatMonth(month: string): string {
  const m = month.match(/^(\d{4})-(\d{2})$/);
  if (!m) return month;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

/** "123456789012" → "XXXX XXXX 9012" */
export function maskUan(uan: string): string {
  return `XXXX XXXX ${uan.slice(-4)}`;
}

/** ISO timestamp → "4 Jul 2026, 3:12 pm" (IST). */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}
