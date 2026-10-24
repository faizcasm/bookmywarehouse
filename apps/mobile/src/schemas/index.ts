/**
 * Validation schemas — re-exported from the workspace `@bmw/validation` package
 * so client-side validation matches the API's server-side rules exactly (single
 * source of truth). The mobile register form adds a client-only `acceptTerms`
 * gate on top of the shared `registerSchema`.
 */

import { z } from 'zod';
import { registerSchema as baseRegisterSchema } from '@bmw/validation';

export {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from '@bmw/validation';

export type {
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
  UpdateProfileInput,
} from '@bmw/validation';

export {
  createBookingSchema,
  quoteBookingSchema,
  cancelBookingSchema,
} from '@bmw/validation';

export type { CreateBookingInput, QuoteBookingInput } from '@bmw/validation';

/** Shared register rules + a client-only "accept terms" requirement. */
export const registerSchema = baseRegisterSchema.extend({
  // Override role to drop the `.default()` so the schema's input and output
  // types line up (react-hook-form needs matching in/out for zodResolver).
  role: z.enum(['CUSTOMER', 'PARTNER']),
  acceptTerms: z.literal(true, { message: 'You must accept the terms to continue' }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
