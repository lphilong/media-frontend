import { z } from 'zod';

import { userActorKindValues } from '@modules/user/constants/user.constants';

const optionalNonEmptyString = z.string().trim().min(1).optional();

export const userCreatePayloadSchema = z
  .object({
    authSubject: z.string().trim().min(1),
    actorKind: z.enum(userActorKindValues).optional(),
    displayName: z.string().trim().min(1),
    email: optionalNonEmptyString,
    phone: optionalNonEmptyString,
    locale: optionalNonEmptyString,
    timezone: optionalNonEmptyString,
  })
  .strict();

export const userUpdatePayloadSchema = z
  .object({
    displayName: optionalNonEmptyString,
    email: optionalNonEmptyString,
    phone: optionalNonEmptyString,
    locale: optionalNonEmptyString,
    timezone: optionalNonEmptyString,
  })
  .strict()
  .refine((payload) => Object.values(payload).some((value) => value !== undefined));

export const userAuthLinkagePayloadSchema = z
  .object({
    provider: z.literal('auth0'),
    subject: z.string().trim().min(1),
  })
  .strict();
