import { z } from 'zod';

const nameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(80, 'Name must be at most 80 characters');

const emailSchema = z
  .string()
  .trim()
  .min(5)
  .max(254)
  .toLowerCase()
  .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Enter a valid email address');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .refine((v) => /[a-zA-Z]/.test(v), 'Password must contain a letter')
  .refine((v) => /[0-9]/.test(v), 'Password must contain a number');

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+0-9][0-9 -]{7,16}$/, 'Enter a valid phone number');

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['CUSTOMER', 'PARTNER']).default('CUSTOMER'),
  phone: phoneSchema.nullish(),
  businessName: z.string().trim().min(2).max(120).nullish(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(72),
  rememberMe: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(10).max(200),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  phone: phoneSchema.nullish(),
  avatarUrl: z
    .string()
    .trim()
    .max(2000)
    .refine(
      (v) => v === '' || v.startsWith('https://') || v.startsWith('data:image/'),
      'Avatar must be an https URL or an uploaded image',
    )
    .nullish(),
});

export const verifyEmailSchema = z.object({ token: z.string().trim().min(10).max(400) });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
