import { z } from 'zod';

import {
  roleDelegationBandValues,
  roleMaxDelegatableBandValues,
} from '@modules/role/constants/role.constants';
import type { JsonPlainValue } from '@modules/role/types/role.types';

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const jsonPlainValueSchema: z.ZodType<JsonPlainValue, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z
      .custom<Record<string, unknown>>(isPlainObject)
      .superRefine((value, context) => {
        if (Object.prototype.hasOwnProperty.call(value, 'toJSON')) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'toJSON is not supported in assignment-rule conditions',
          });
        }
      })
      .pipe(z.record(jsonPlainValueSchema)),
  ]),
);

const assignmentRuleConditionsSchema = z
  .custom<Record<string, unknown>>(isPlainObject)
  .superRefine((value, context) => {
    if (Object.prototype.hasOwnProperty.call(value, 'toJSON')) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'toJSON is not supported in assignment-rule conditions',
      });
    }
  })
  .pipe(z.record(jsonPlainValueSchema));

const assignmentRuleSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    code: z.string().trim().min(1),
    description: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    conditions: assignmentRuleConditionsSchema.nullable().optional(),
  })
  .strict();

export const roleCreatePayloadSchema = z
  .object({
    name: z.string().trim().min(1),
    code: z.string().trim().min(1),
    description: z.string().nullable().optional(),
    initialPermissions: z.array(z.string()).optional(),
    initialDelegationBand: z.enum(roleDelegationBandValues).optional(),
    initialMaxDelegatableBand: z.enum(roleMaxDelegatableBandValues).optional(),
    initialAssignmentRules: z.array(assignmentRuleSchema).optional(),
  })
  .strict();

export const roleUpdatePayloadSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().nullable().optional(),
    delegationBand: z.enum(roleDelegationBandValues).optional(),
    maxDelegatableBand: z.enum(roleMaxDelegatableBandValues).optional(),
  })
  .strict();

export const rolePermissionReplacementPayloadSchema = z
  .object({
    permissions: z.array(z.string()),
  })
  .strict();

export const roleAssignmentRuleReplacementPayloadSchema = z
  .object({
    rules: z.array(assignmentRuleSchema),
  })
  .strict();

export const roleAssignToUserPayloadSchema = z
  .object({
    userId: z.string().trim().min(1),
    reason: z.string().nullable().optional(),
  })
  .strict();

export const roleRevokeAssignmentPayloadSchema = z
  .object({
    reason: z.string().nullable().optional(),
  })
  .strict();
