import { expect, test, type Page } from '@playwright/test';

// Full-flow E2E against the MockProvider (see lib/providers/mock.ts for the
// UAN trigger table). Mobile viewport (360px) per acceptance criteria.

const MOBILE = '9876543210';
const UAN = (suffix: string) => `1234567890${suffix}`;
const HAPPY_OTP = '123456';

async function fillDetails(page: Page, uanSuffix: string) {
  await page.goto('/check');
  await page.getByTestId('uan-input').fill(UAN(uanSuffix));
  await page.getByTestId('mobile-input').fill(MOBILE);
  await page.getByTestId('details-continue').click();
}

async function acceptConsentAndSendOtp(page: Page) {
  await page.getByTestId('consent-checkbox').check();
  await page.getByTestId('send-otp').click();
}

async function enterOtp(page: Page, otp: string) {
  await expect(page.getByTestId('otp-input')).toBeVisible();
  for (let i = 0; i < 6; i++) {
    await page.getByTestId(`otp-digit-${i}`).fill(otp[i]);
  }
  await page.getByTestId('verify-otp').click();
}

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

test.describe('happy path (UAN …00)', () => {
  test('landing → details → consent → OTP → dashboard, zero console errors', async ({
    page,
  }) => {
    const consoleErrors = collectConsoleErrors(page);

    await page.goto('/');
    await page.getByRole('link', { name: 'Check my PF balance' }).click();
    await expect(page).toHaveURL(/\/check$/);

    await page.getByTestId('uan-input').fill(UAN('00'));
    await page.getByTestId('mobile-input').fill(MOBILE);
    await page.getByTestId('details-continue').click();

    // Consent gate: button disabled until the box is ticked.
    await expect(page.getByTestId('send-otp')).toBeDisabled();
    await page.getByTestId('consent-checkbox').check();
    await expect(page.getByTestId('send-otp')).toBeEnabled();
    await page.getByTestId('send-otp').click();

    // Masked mobile shown, never the full number.
    await expect(page.getByTestId('otp-sent-to')).toContainText(
      '+91 98XXXXXX10'
    );

    await enterOtp(page, HAPPY_OTP);
    await expect(page).toHaveURL(/\/result$/, { timeout: 15_000 });

    // Dashboard sections
    await expect(page.getByTestId('total-balance')).toContainText('₹');
    await expect(page.getByTestId('member-name')).toContainText('XXXX XXXX 9000');
    await expect(page.getByTestId('member-name')).not.toContainText(UAN('00'));
    await expect(page.getByTestId('employee-share')).toBeVisible();
    await expect(page.getByTestId('employer-share')).toBeVisible();
    await expect(page.getByTestId('pension-share')).toBeVisible();
    await expect(page.getByTestId('contribution-chart')).toBeVisible();
    await expect(page.getByTestId('contribution-table')).toBeVisible();

    // Two accounts → account switcher tabs
    await expect(page.getByTestId('account-tab-0')).toBeVisible();
    await expect(page.getByTestId('account-tab-1')).toBeVisible();
    const firstBalance = await page.getByTestId('total-balance').textContent();
    await page.getByTestId('account-tab-1').click();
    const secondBalance = await page.getByTestId('total-balance').textContent();
    expect(secondBalance).not.toBe(firstBalance);

    // Table expands beyond the collapsed 6 rows
    const collapsedRows = await page
      .getByTestId('contribution-table')
      .locator('tbody tr')
      .count();
    expect(collapsedRows).toBe(6);
    await page.getByTestId('table-toggle').click();
    const expandedRows = await page
      .getByTestId('contribution-table')
      .locator('tbody tr')
      .count();
    expect(expandedRows).toBe(12);

    // Indian number formatting on the hero balance (₹x,xx,xxx style)
    expect(firstBalance).toMatch(/₹[\d,]+/);

    // §6.1: PF data must never touch client-side storage.
    const storage = await page.evaluate(() => ({
      local: Object.entries(localStorage),
      session: Object.entries(sessionStorage),
    }));
    const dumped = JSON.stringify(storage);
    expect(dumped).not.toContain(UAN('00'));
    expect(dumped).not.toContain(MOBILE);
    expect(storage.local).toHaveLength(0);
    expect(storage.session).toHaveLength(0);

    // §6.1: no PF identifiers in the URL at any point.
    expect(page.url()).not.toContain(UAN('00'));
    expect(page.url()).not.toContain(MOBILE);

    // "Check another UAN" destroys the session and returns to /check.
    await page.getByTestId('check-another').click();
    await expect(page).toHaveURL(/\/check$/);
    // Session gone → /result bounces back to /check.
    await page.goto('/result');
    await expect(page).toHaveURL(/\/check$/);

    expect(consoleErrors).toEqual([]);
  });
});

test.describe('error states (M2)', () => {
  test('UAN …01 → EXEMPTED_TRUST after OTP', async ({ page }) => {
    await fillDetails(page, '01');
    await acceptConsentAndSendOtp(page);
    await enterOtp(page, HAPPY_OTP);
    await expect(page.getByTestId('error-EXEMPTED_TRUST')).toBeVisible();
    // Tone check: informative, not apologetic — no "sorry", no "error".
    const text = await page
      .getByTestId('error-EXEMPTED_TRUST')
      .textContent();
    expect(text?.toLowerCase()).not.toContain('sorry');
    expect(text?.toLowerCase()).not.toContain('error');
    expect(text).toContain('trust');
  });

  test('UAN …02 → UAN_INACTIVE with activation link', async ({ page }) => {
    await fillDetails(page, '02');
    await acceptConsentAndSendOtp(page);
    await expect(page.getByTestId('error-UAN_INACTIVE')).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Open EPFO member portal' })
    ).toBeVisible();
  });

  test('UAN …03 → EPFO_UNAVAILABLE mentions missed-call fallback', async ({
    page,
  }) => {
    await fillDetails(page, '03');
    await acceptConsentAndSendOtp(page);
    await expect(page.getByTestId('error-EPFO_UNAVAILABLE')).toBeVisible();
    await expect(page.getByTestId('error-EPFO_UNAVAILABLE')).toContainText(
      '9966044425'
    );
  });

  test('UAN …04 → MOBILE_MISMATCH, action returns to details keeping UAN', async ({
    page,
  }) => {
    await fillDetails(page, '04');
    await acceptConsentAndSendOtp(page);
    await expect(page.getByTestId('error-MOBILE_MISMATCH')).toBeVisible();
    await page.getByTestId('error-action').click();
    await expect(page.getByTestId('uan-input')).toHaveValue(UAN('04'));
    await expect(page.getByTestId('mobile-input')).toHaveValue('');
  });

  test('UAN …05 → INVALID_UAN', async ({ page }) => {
    await fillDetails(page, '05');
    await acceptConsentAndSendOtp(page);
    await expect(page.getByTestId('error-INVALID_UAN')).toBeVisible();
  });

  test('UAN …06 → PROVIDER_UNAVAILABLE', async ({ page }) => {
    await fillDetails(page, '06');
    await acceptConsentAndSendOtp(page);
    await expect(page.getByTestId('error-PROVIDER_UNAVAILABLE')).toBeVisible();
  });

  test('UAN …07 → UNKNOWN', async ({ page }) => {
    await fillDetails(page, '07');
    await acceptConsentAndSendOtp(page);
    await expect(page.getByTestId('error-UNKNOWN')).toBeVisible();
  });
});

test.describe('OTP failure paths', () => {
  test('wrong OTP shows attempts left, 3rd failure resets the session', async ({
    page,
  }) => {
    await fillDetails(page, '00');
    await acceptConsentAndSendOtp(page);

    await enterOtp(page, '111111');
    await expect(page.getByTestId('otp-message')).toContainText(
      '2 attempts left'
    );
    await enterOtp(page, '222222');
    await expect(page.getByTestId('otp-message')).toContainText(
      '1 attempt left'
    );
    await enterOtp(page, '333333');
    await expect(page.getByTestId('error-OTP_MAX_ATTEMPTS')).toBeVisible();
  });

  test('expired OTP (000000) → OTP_EXPIRED screen', async ({ page }) => {
    await fillDetails(page, '00');
    await acceptConsentAndSendOtp(page);
    await enterOtp(page, '000000');
    await expect(page.getByTestId('error-OTP_EXPIRED')).toBeVisible();
  });
});

test.describe('edge states (M5)', () => {
  test('UAN …10 (2 contributions) shows table, not chart', async ({
    page,
  }) => {
    await fillDetails(page, '10');
    await acceptConsentAndSendOtp(page);
    await enterOtp(page, HAPPY_OTP);
    await expect(page).toHaveURL(/\/result$/, { timeout: 15_000 });
    await expect(page.getByTestId('contribution-chart')).toHaveCount(0);
    await expect(page.getByTestId('contribution-table')).toBeVisible();
  });

  test('UAN …11 (zero balance) renders ₹0 without errors', async ({
    page,
  }) => {
    const consoleErrors = collectConsoleErrors(page);
    await fillDetails(page, '11');
    await acceptConsentAndSendOtp(page);
    await enterOtp(page, HAPPY_OTP);
    await expect(page).toHaveURL(/\/result$/, { timeout: 15_000 });
    await expect(page.getByTestId('total-balance')).toContainText('₹0');
    expect(consoleErrors).toEqual([]);
  });
});

test.describe('validation', () => {
  test('client-side field validation blocks bad input', async ({ page }) => {
    await page.goto('/check');
    await page.getByTestId('uan-input').fill('12345');
    await page.getByTestId('mobile-input').fill('12345');
    await page.getByTestId('details-continue').click();
    await expect(
      page.getByText('Enter your 12-digit UAN (numbers only).')
    ).toBeVisible();
    await expect(
      page.getByText('Enter a valid 10-digit Indian mobile number.')
    ).toBeVisible();
  });
});
