import type { PFErrorCode } from './providers/errors';

// All user-facing copy lives here, structured for future i18n (§2: ship
// English only, but keep strings out of components). A future locale adds
// another object with the same shape.

export const en = {
  app: {
    name: 'PF Pulse',
    tagline: 'Check your EPF balance in under a minute.',
  },

  landing: {
    heroTitle: 'Your PF balance, without the portal maze',
    heroSubtitle:
      'Check your EPF balance and recent contributions in under 60 seconds. All you need is your UAN and the mobile number registered with EPFO — no password, no login.',
    cta: 'Check my PF balance',
    trust: [
      {
        title: 'No password needed',
        body: 'We use a one-time OTP sent to your EPFO-registered mobile. We never see or ask for your EPFO portal password.',
      },
      {
        title: 'Nothing is stored',
        body: 'Your balance is shown for this session only and wiped within 30 minutes. We keep no database of balances.',
      },
      {
        title: 'Consent-based',
        body: 'Every fetch is a one-time, explicit-consent request — you approve it, we fetch it once, and that is it.',
      },
    ],
    howItWorks: [
      'Enter your 12-digit UAN and registered mobile number',
      'Approve the one-time fetch and enter the OTP you receive',
      'See your balance, share split, and last 12 contributions',
    ],
  },

  input: {
    title: 'Enter your details',
    uanLabel: 'UAN (Universal Account Number)',
    uanPlaceholder: '12-digit UAN',
    uanHelper:
      'Your UAN is on your salary slip, or in the EPFO/UMANG app. 12 digits.',
    uanError: 'Enter your 12-digit UAN (numbers only).',
    mobileLabel: 'Mobile number',
    mobilePlaceholder: '10-digit mobile number',
    mobileHelper:
      'Must be the mobile number registered with EPFO for this UAN — the OTP goes there.',
    mobileError: 'Enter a valid 10-digit Indian mobile number.',
    continue: 'Continue',
  },

  consent: {
    title: 'Your consent',
    version: '2026-07-v1',
    body: 'I authorise PF Pulse to fetch my EPF passbook — current balance, employee/employer/pension split, and recent contributions — from EPFO records via a secure verification service, one time, using an OTP sent to my EPFO-registered mobile number. I understand that PF Pulse does not receive or store my EPFO password, and that the fetched data is shown to me for this session only and deleted within 30 minutes. No data is sold or shared with third parties.',
    checkboxLabel: 'I agree to a one-time fetch of my EPF passbook',
    privacyLinkText: 'Read the privacy policy',
    sendOtp: 'Send OTP',
    back: 'Back',
  },

  otp: {
    title: 'Enter the OTP',
    sentTo: (masked: string) => `We sent a 6-digit OTP to ${masked}`,
    helper: 'It can take up to a minute to arrive.',
    verify: 'Verify & fetch balance',
    resend: 'Resend OTP',
    resendIn: (s: number) => `Resend in ${s}s`,
    attemptsLeft: (n: number) =>
      n === 1 ? '1 attempt left' : `${n} attempts left`,
    invalid: 'That OTP is not correct. Check the SMS and try again.',
    expired: 'That OTP has expired. Request a new one.',
  },

  loading: {
    stages: [
      'Contacting EPFO…',
      'Verifying your consent…',
      'Fetching passbook…',
      'Crunching the numbers…',
    ],
    slow: 'EPFO is responding slowly — hang tight…',
  },

  dashboard: {
    totalBalance: 'Total PF balance',
    asOf: (ts: string) => `As of ${ts}`,
    disclaimer: 'Fetched from EPFO records via secure consent.',
    employeeShare: 'Your contribution',
    employerShare: 'Employer contribution',
    pensionShare: 'Pension (EPS)',
    epsTooltip:
      'EPS is the pension component of your PF. It is paid out as a pension (or limited lump sum) and has different withdrawal rules from the rest of your balance.',
    trendTitle: 'Last 12 months',
    contributionsTitle: 'Recent contributions',
    tableMonth: 'Month',
    tableEmployee: 'Employee ₹',
    tableEmployer: 'Employer ₹',
    tablePension: 'EPS ₹',
    showAll: 'Show all',
    showLess: 'Show less',
    inactiveBadge: 'No longer active',
    freshnessNote:
      'EPFO passbooks update after your employer files monthly returns, so this balance can lag your actual salary deductions by up to ~2 months.',
    checkAnother: 'Check another UAN',
    noContributions: 'No contributions recorded for this account yet.',
  },

  errors: {
    INVALID_UAN: {
      title: 'We couldn’t find that UAN',
      body: 'EPFO has no record matching this UAN. Double-check the 12 digits — it’s printed on your salary slip and in the UMANG app under EPFO services.',
      action: 'Try again',
    },
    UAN_INACTIVE: {
      title: 'Your UAN isn’t activated yet',
      body: 'Your UAN exists, but it hasn’t been activated on the EPFO portal, so balances can’t be fetched yet. Activating takes about two minutes: open the EPFO Member Portal (unifiedportal-mem.epfindia.gov.in) or the UMANG app, choose “Activate UAN”, and verify with your Aadhaar-linked mobile. Then come back and try again.',
      action: 'Start over',
      linkText: 'Open EPFO member portal',
      linkHref: 'https://unifiedportal-mem.epfindia.gov.in/memberinterface/',
    },
    MOBILE_MISMATCH: {
      title: 'That mobile number isn’t linked to this UAN',
      body: 'The OTP can only go to the mobile number registered with EPFO for your UAN. If you’ve changed numbers, log in to the EPFO Member Portal (or visit your HR) to update it — then try again with the registered number. Not sure which number is registered? Your last EPFO SMS (from EPFOHO) went to it.',
      action: 'Use a different number',
    },
    OTP_INVALID: {
      title: 'That OTP didn’t match',
      body: 'Check the latest SMS from EPFO and re-enter the 6-digit code. Codes expire after a few minutes, so use the newest one.',
      action: 'Try again',
    },
    OTP_EXPIRED: {
      title: 'That OTP has expired',
      body: 'OTPs are only valid for a few minutes. Request a fresh one and enter it right away.',
      action: 'Start over',
    },
    OTP_MAX_ATTEMPTS: {
      title: 'Too many incorrect attempts',
      body: 'For your security we’ve reset this session after 3 incorrect OTP entries. Start again and re-request an OTP.',
      action: 'Start over',
    },
    EXEMPTED_TRUST: {
      title: 'Your PF is managed by your company’s trust',
      body: 'Your employer runs an exempted PF trust — common at large companies like TCS and Infosys — which means your PF money is managed in-house instead of by EPFO, and your balance lives with the company, not on the EPFO portal. Your money is safe and earns at least the EPFO-declared rate. To see your balance, check your company’s HR or payroll portal, or ask your HR team for your trust passbook.',
      action: 'Check another UAN',
    },
    EPFO_UNAVAILABLE: {
      title: 'EPFO isn’t responding right now',
      body: 'EPFO migrated to its new EPFO 3.0 platform in July 2026 and services have been intermittently degraded since. This is on EPFO’s side, not yours — try again in a little while. Need your balance right now? Give a missed call to 9966044425 from your EPFO-registered mobile and you’ll get it by SMS.',
      action: 'Try again',
    },
    PROVIDER_UNAVAILABLE: {
      title: 'Our data service is temporarily down',
      body: 'The secure service we use to reach EPFO is having a moment. Your details were not lost and nothing was stored. Please try again in a few minutes.',
      action: 'Try again',
    },
    RATE_LIMITED: {
      title: 'Too many requests',
      body: 'You’ve hit the limit of 5 balance checks in 10 minutes. Take a short break and try again.',
      action: 'Back to start',
    },
    UNKNOWN: {
      title: 'Something unexpected happened',
      body: 'The fetch failed in a way we didn’t anticipate. Nothing was stored. Please try again — if it keeps happening, EPFO’s systems may be degraded.',
      action: 'Try again',
    },
  } satisfies Record<
    PFErrorCode,
    { title: string; body: string; action: string; linkText?: string; linkHref?: string }
  >,

  footer: {
    privacy: 'Privacy policy',
    disclaimer:
      'PF Pulse is not affiliated with EPFO. Balances are fetched from EPFO records with your consent and are informational only.',
  },
};

export type Strings = typeof en;
