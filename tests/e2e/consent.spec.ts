import { createHash } from 'crypto';
import { readFile, rm } from 'fs/promises';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';

// Verifies the DPDP consent-log requirements end to end (§6.5 + acceptance
// criteria): the consent event is persisted BEFORE any provider call, the
// entry stores a SHA-256 hash of the UAN (never the raw UAN or full mobile),
// and it survives even when the provider call itself fails.

const LOG_FILE = path.join(process.cwd(), 'data', 'e2e-consent-log.jsonl');
const MOBILE = '9876543210';

async function runInitiate(page: Page, uan: string) {
  await page.goto('/check');
  await page.getByTestId('uan-input').fill(uan);
  await page.getByTestId('mobile-input').fill(MOBILE);
  await page.getByTestId('details-continue').click();
  await page.getByTestId('consent-checkbox').check();
  await page.getByTestId('send-otp').click();
}

test('consent entry is written before the provider call — even when the provider fails', async ({
  page,
}) => {
  await rm(LOG_FILE, { force: true });

  // UAN …03 makes the MockProvider throw EPFO_UNAVAILABLE at initiate, so
  // any log entry present can only have been written before that call.
  const uan = '888877776603';
  await runInitiate(page, uan);
  await expect(page.getByTestId('error-EPFO_UNAVAILABLE')).toBeVisible();

  const raw = await readFile(LOG_FILE, 'utf8');
  const entries = raw
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  expect(entries.length).toBeGreaterThanOrEqual(1);

  const expectedHash = createHash('sha256').update(uan).digest('hex');
  const entry = entries.find((e) => e.uanHash === expectedHash);
  expect(entry).toBeDefined();
  expect(entry.consentTextVersion).toBeTruthy();
  expect(entry.timestamp).toBeTruthy();
  expect(entry.consentId).toBeTruthy();
  expect(entry.mobileMasked).toBe('98XXXXXX10');

  // The raw UAN and full mobile number must never appear in the log.
  expect(raw).not.toContain(uan);
  expect(raw).not.toContain(MOBILE);
});
