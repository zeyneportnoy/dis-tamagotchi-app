import { z } from 'zod';

import { starterAvatarKeys } from './models';

export const NICKNAME_MAX_LENGTH = 20;

export const ageBandSchema = z.enum(['4_6', '7_11']);
export const legacyAgeBandSchema = z.enum(['6_8', '9_10']);
export const storedAgeBandSchema = z.union([ageBandSchema, legacyAgeBandSchema]);
export const isLegacyAgeBand = (value: string): boolean =>
  legacyAgeBandSchema.safeParse(value).success;
export const starterAvatarSchema = z.enum(starterAvatarKeys);
export const nicknameSchema = z
  .string()
  .trim()
  .min(1)
  .max(NICKNAME_MAX_LENGTH)
  .refine((value) => !/[\r\n\t]/.test(value));

export const createChildProfileSchema = z.object({
  familyId: z.string().uuid(),
  nickname: nicknameSchema,
  ageBand: ageBandSchema,
  avatarId: starterAvatarSchema,
});

export const updateChildProfileSchema = z
  .object({
    nickname: nicknameSchema.optional(),
    ageBand: ageBandSchema.optional(),
    avatarId: starterAvatarSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0);
