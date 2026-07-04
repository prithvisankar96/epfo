// The provider adapter interface. ALL EPFO data access flows through this.
// Product code imports these types and the factory in ./index.ts — never a
// concrete provider. Future providers (UPIProvider over NPCI rails,
// AAProvider over the Account Aggregator framework) slot into the same
// initiate/complete shape: OTP flows today, consent-handle flows tomorrow.

export interface PFProvider {
  readonly name: string;

  /** Step 1: initiate fetch — triggers OTP to the UAN-registered mobile. */
  initiateFetch(req: InitiateRequest): Promise<InitiateResult>;

  /** Step 2: submit OTP, retrieve data. */
  completeFetch(req: CompleteRequest): Promise<PFAccountData>;

  /** Provider health, used for status banner + failover decisions. */
  healthCheck(): Promise<ProviderHealth>;
}

export interface InitiateRequest {
  uan: string; // 12 digits, pre-validated
  mobile: string; // 10 digits, pre-validated
  consentId: string; // reference to logged consent event
}

export interface InitiateResult {
  transactionId: string; // provider-side reference for step 2
  otpSentTo: string; // masked mobile, e.g. "+91 98XXXXXX21"
  expiresAt: string; // ISO timestamp
}

export interface CompleteRequest {
  transactionId: string;
  otp: string;
}

export interface PFAccountData {
  uan: string;
  memberName: string;
  accounts: MemberAccount[]; // one per Member ID / employer
  fetchedAt: string;
  provider: string;
}

export interface MemberAccount {
  memberId: string;
  establishmentName: string;
  balance: {
    employeeShare: number; // paise-free integers in INR
    employerShare: number;
    pensionShare: number; // EPS
    total: number;
  };
  contributions: Contribution[]; // most recent first, cap 12
  lastContributionMonth: string; // "2026-05"
  isActive: boolean;
}

export interface Contribution {
  month: string; // "2026-05"
  employeeAmount: number;
  employerAmount: number;
  pensionAmount: number;
}

export interface ProviderHealth {
  provider: string;
  ok: boolean;
  checkedAt: string;
  detail?: string;
}
