import { z } from 'zod';

// Server-side validation schemas. The client validates too, but every route
// handler re-validates with these — never trust client validation.

/** 12-digit numeric UAN. */
export const uanSchema = z
  .string()
  .trim()
  .regex(/^\d{12}$/, 'UAN must be exactly 12 digits');

/** Indian mobile: 10 digits, starting 6–9. */
export const mobileSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');

/** 6-digit OTP. */
export const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'OTP must be exactly 6 digits');

export const initiateBodySchema = z.object({
  uan: uanSchema,
  mobile: mobileSchema,
  consentAccepted: z.literal(true),
});

export const completeBodySchema = z.object({
  transactionId: z.string().min(1).max(2048),
  otp: otpSchema,
});

export type InitiateBody = z.infer<typeof initiateBodySchema>;
export type CompleteBody = z.infer<typeof completeBodySchema>;
