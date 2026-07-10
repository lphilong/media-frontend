import type {
  AccessAssignmentRequestPayload,
  AccessAssignmentScopeGrant,
  AccessAssignmentTargetOption,
} from '@modules/role/types/role.types';

export const buildAccessAssignmentPayload = (input: {
  selectedUserId: string;
  selectedTarget: AccessAssignmentTargetOption;
  structuredScopeGrants: AccessAssignmentScopeGrant[];
  reason: string;
  reviewAt?: string;
  expiresAt?: string;
}): AccessAssignmentRequestPayload => {
  const payload: AccessAssignmentRequestPayload = {
    targetUserId: input.selectedUserId,
    assignmentTargetType: input.selectedTarget.assignmentKind,
    structuredScopeGrants: input.structuredScopeGrants,
    reason: input.reason,
    reviewAt: input.reviewAt || undefined,
    expiresAt: input.expiresAt || undefined,
  };

  if (input.selectedTarget.assignmentKind === 'ROLE') {
    if (input.selectedTarget.id) {
      payload.assignmentTargetId = input.selectedTarget.id;
    }
    payload.assignmentTargetCode = input.selectedTarget.code;
  } else {
    payload.assignmentTargetCode = input.selectedTarget.code;
  }
  if (input.selectedTarget.assignmentKind === 'BUNDLE' && input.selectedTarget.version) {
    payload.bundleVersion = input.selectedTarget.version;
  }
  return payload;
};
