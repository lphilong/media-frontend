import { z } from 'zod';

import { userActorKindValues } from '@modules/user/constants/user.constants';

const optionalNonEmptyString = z.string().trim().min(1).optional();

export const userCreatePayloadSchema = z
  .object({
    actorKind: z.enum(userActorKindValues).optional(),
    displayName: z.string().trim().min(1),
    email: optionalNonEmptyString,
    phone: optionalNonEmptyString,
    locale: optionalNonEmptyString,
    timezone: optionalNonEmptyString,
  })
  .strict();

export const userProvisionPayloadSchema = z
  .object({
    actorKind: z.enum(userActorKindValues).optional(),
    displayName: z.string().trim().min(1),
    email: z.string().trim().min(1),
    phone: optionalNonEmptyString,
    locale: optionalNonEmptyString,
    timezone: optionalNonEmptyString,
    credentialMode: z.literal('INVITE_LINK').optional(),
    sendInvitation: z.boolean().optional(),
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
