import { z } from 'zod';

const email = z.string().trim().toLowerCase().email();
const password = z.string().min(8).max(128);

export const signUpSchema = z
  .object({
    displayName: z.string().trim().min(1).max(50),
    email,
    password,
    passwordConfirmation: z.string(),
    termsAccepted: z.literal(true),
    privacyAcknowledged: z.literal(true),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'PASSWORD_MISMATCH',
  });

export const signInSchema = z.object({ email, password: z.string().min(1) });
export const passwordResetRequestSchema = z.object({ email });
export const updatePasswordSchema = z
  .object({ password, passwordConfirmation: z.string() })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'PASSWORD_MISMATCH',
  });

export const authCallbackSchema = z.object({
  code: z.string().min(1).optional(),
  flowId: z.string().min(1).optional(),
  accessToken: z.string().min(1).optional(),
  refreshToken: z.string().min(1).optional(),
  type: z.string().optional(),
});
