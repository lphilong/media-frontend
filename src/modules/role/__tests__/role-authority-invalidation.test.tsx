import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { vi } from 'vitest';

vi.mock('@modules/role/api/role.api', async () => {
  const actual = await vi.importActual<typeof import('@modules/role/api/role.api')>(
    '@modules/role/api/role.api',
  );
  return {
    ...actual,
    applyAccessAssignment: vi.fn(),
    revokeAccessAssignment: vi.fn(),
  };
});

import { applyAccessAssignment, revokeAccessAssignment } from '@modules/role/api/role.api';
import { employmentTermsQueryKeys } from '@modules/employment-terms/hooks/use-employment-terms';
import {
  MANAGER_WORKSPACE_CONTEXT_QUERY_KEY,
  managerWorkspaceReadQueryKeys,
} from '@modules/manager-workspace/api/manager-workspace.api';
import {
  classifyAuthorityReductionQuery,
  useAccessAssignmentApplyMutation,
  useAccessAssignmentRevokeMutation,
} from '@modules/role/hooks/use-role';
import type {
  AccessAssignmentApplyResult,
  AccessAssignmentLifecycleResult,
  AccessAssignmentRequestPayload,
} from '@modules/role/types/role.types';
import {
  CURRENT_ACTOR_CAPABILITIES_QUERY_KEY,
  type CurrentActorCapabilities,
} from '@shared/auth/current-actor-capabilities';

const actorCapabilities = (id: string): CurrentActorCapabilities => ({
  id,
  type: 'admin',
  context: 'ADMIN',
  isActive: true,
  permissions: [],
  scopeGrants: {},
});

const applyPayload = (targetUserId: string): AccessAssignmentRequestPayload => ({
  targetUserId,
  assignmentTargetType: 'ROLE',
  assignmentTargetId: 'role-01',
  structuredScopeGrants: [],
  reason: 'Authority invalidation test',
});

const appliedResult: AccessAssignmentApplyResult = {
  applied: true,
  canApply: true,
  applyStatus: 'APPLIED',
  blockers: [],
  warnings: [],
};

const employmentTermsAdminListKey = employmentTermsQueryKeys.adminList({});
const managerReadIdentity = {
  actorId: 'current-user',
  accountContext: 'MANAGER_CONSOLE' as const,
  scopeFingerprint: 'ORG_UNIT:ou-1',
};
const managerGroupsKey = managerWorkspaceReadQueryKeys.groups(managerReadIdentity, {
  scopeType: 'ORG_UNIT',
  search: 'ops',
  cursor: 'cursor-1',
});
const managerMembersKey = managerWorkspaceReadQueryKeys.members(
  managerReadIdentity,
  { scopeType: 'ORG_UNIT', scopeId: 'ou-1' },
  { operationalStatus: 'ACTIVE', cursor: 'cursor-2' },
);
const managerWeeklyScheduleKey = managerWorkspaceReadQueryKeys.weeklySchedule(managerReadIdentity, {
  scopeType: 'ORG_UNIT',
  scopeId: 'ou-1',
  weekStart: '2026-07-13',
  status: 'READY',
  conflict: 'WITHOUT_CONFLICT',
  request: 'WITH_REQUEST',
  search: 'ops',
  cursor: 'cursor-week',
});
const unregisteredRetentionEvidenceKey = ['unregistered-retention-evidence', 'opaque'] as const;

const revokedResult = (targetUserId?: string): AccessAssignmentLifecycleResult => ({
  revoked: true,
  lifecycleStatus: 'REVOKED',
  blockers: [],
  warnings: [],
  assignment: targetUserId
    ? {
        assignmentId: 'assignment-01',
        targetUserId,
        roleId: 'role-01',
        roleCode: 'ROLE_01',
        roleName: 'Role 01',
        structuredScopeGrants: [],
        scopeFingerprint: 'scope:none',
        status: 'REVOKED',
        lifecycleState: 'REVOKED',
        currentlyEffective: false,
        effectiveAt: null,
        expiresAt: null,
        reviewAt: null,
        origin: 'DIRECT',
        bundleOrigin: null,
        reason: 'Original assignment',
        sensitiveOrGlobal: false,
        isSensitive: false,
        isGlobalLike: false,
        isHighRisk: false,
        requiresReview: false,
        isBreakGlassLike: false,
        supportedActions: [],
      }
    : null,
});

const createHarness = (actorId = 'current-user') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(CURRENT_ACTOR_CAPABILITIES_QUERY_KEY, actorCapabilities(actorId));
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
};

describe('Role authority cache invalidation', () => {
  beforeEach(() => {
    vi.mocked(applyAccessAssignment).mockResolvedValue(appliedResult);
    vi.mocked(revokeAccessAssignment).mockReset();
  });

  it('classifies production authority-reduction query families and preserves unregistered keys by default', () => {
    expect(classifyAuthorityReductionQuery(employmentTermsAdminListKey)).toBe(
      'PROTECTED_AUTHORITY_DEPENDENT',
    );
    expect(classifyAuthorityReductionQuery(MANAGER_WORKSPACE_CONTEXT_QUERY_KEY)).toBe(
      'PROTECTED_AUTHORITY_DEPENDENT',
    );
    expect(classifyAuthorityReductionQuery(managerGroupsKey)).toBe('PROTECTED_AUTHORITY_DEPENDENT');
    expect(classifyAuthorityReductionQuery(managerMembersKey)).toBe(
      'PROTECTED_AUTHORITY_DEPENDENT',
    );
    expect(classifyAuthorityReductionQuery(managerWeeklyScheduleKey)).toBe(
      'PROTECTED_AUTHORITY_DEPENDENT',
    );
    expect(classifyAuthorityReductionQuery(CURRENT_ACTOR_CAPABILITIES_QUERY_KEY)).toBe(
      'CURRENT_ACTOR_CAPABILITY',
    );
    expect(classifyAuthorityReductionQuery(unregisteredRetentionEvidenceKey)).toBe(
      'RETAIN_UNCLASSIFIED',
    );
  });

  it('invalidates current-actor capabilities after a self-affecting assignment', async () => {
    const { queryClient, wrapper } = createHarness();
    queryClient.setQueryData(employmentTermsAdminListKey, { sensitive: 'cached' });
    const { result } = renderHook(() => useAccessAssignmentApplyMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(applyPayload('current-user'));
    });

    expect(queryClient.getQueryState(CURRENT_ACTOR_CAPABILITIES_QUERY_KEY)?.isInvalidated).toBe(
      true,
    );
    expect(queryClient.getQueryData(employmentTermsAdminListKey)).toEqual({
      sensitive: 'cached',
    });
  });

  it('does not invalidate current-actor capabilities for another user assignment', async () => {
    const { queryClient, wrapper } = createHarness();
    const { result } = renderHook(() => useAccessAssignmentApplyMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(applyPayload('other-user'));
    });

    expect(queryClient.getQueryState(CURRENT_ACTOR_CAPABILITIES_QUERY_KEY)?.isInvalidated).toBe(
      false,
    );
  });

  it('evicts only explicit protected data after successful self-revocation', async () => {
    vi.mocked(revokeAccessAssignment).mockResolvedValue(revokedResult('current-user'));
    const { queryClient, wrapper } = createHarness();
    queryClient.setQueryData(employmentTermsAdminListKey, { sensitive: 'cached' });
    queryClient.setQueryData(MANAGER_WORKSPACE_CONTEXT_QUERY_KEY, { scoped: 'cached' });
    queryClient.setQueryData(managerGroupsKey, { scopedGroups: 'cached' });
    queryClient.setQueryData(managerMembersKey, { scopedMembers: 'cached' });
    queryClient.setQueryData(managerWeeklyScheduleKey, { weeklyRows: 'cached' });
    queryClient.setQueryData(unregisteredRetentionEvidenceKey, { retained: 'unclassified' });
    const { result } = renderHook(() => useAccessAssignmentRevokeMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        assignmentId: 'assignment-01',
        payload: { reason: 'Remove current access' },
      });
    });

    expect(queryClient.getQueryData(employmentTermsAdminListKey)).toBeUndefined();
    expect(queryClient.getQueryData(MANAGER_WORKSPACE_CONTEXT_QUERY_KEY)).toBeUndefined();
    expect(queryClient.getQueryData(managerGroupsKey)).toBeUndefined();
    expect(queryClient.getQueryData(managerMembersKey)).toBeUndefined();
    expect(queryClient.getQueryData(managerWeeklyScheduleKey)).toBeUndefined();
    expect(queryClient.getQueryData(unregisteredRetentionEvidenceKey)).toEqual({
      retained: 'unclassified',
    });
    expect(queryClient.getQueryState(CURRENT_ACTOR_CAPABILITIES_QUERY_KEY)?.isInvalidated).toBe(
      true,
    );
  });

  it('refreshes the other target without evicting current-actor protected or unregistered caches', async () => {
    vi.mocked(revokeAccessAssignment).mockResolvedValue(revokedResult('other-user'));
    const { queryClient, wrapper } = createHarness();
    const effectiveAccessKey = ['role', 'effective-access', 'other-user'] as const;
    queryClient.setQueryData(effectiveAccessKey, { access: 'previous' });
    queryClient.setQueryData(employmentTermsAdminListKey, { sensitive: 'cached' });
    queryClient.setQueryData(MANAGER_WORKSPACE_CONTEXT_QUERY_KEY, { scoped: 'cached' });
    queryClient.setQueryData(unregisteredRetentionEvidenceKey, { retained: 'unclassified' });
    const { result } = renderHook(() => useAccessAssignmentRevokeMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        assignmentId: 'assignment-01',
        payload: { reason: 'Remove other access' },
      });
    });

    expect(queryClient.getQueryState(effectiveAccessKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(CURRENT_ACTOR_CAPABILITIES_QUERY_KEY)?.isInvalidated).toBe(
      false,
    );
    expect(queryClient.getQueryData(employmentTermsAdminListKey)).toEqual({
      sensitive: 'cached',
    });
    expect(queryClient.getQueryData(MANAGER_WORKSPACE_CONTEXT_QUERY_KEY)).toEqual({
      scoped: 'cached',
    });
    expect(queryClient.getQueryData(unregisteredRetentionEvidenceKey)).toEqual({
      retained: 'unclassified',
    });
  });

  it('conservatively refreshes capabilities and evicts only protected data for an unknown revoke target', async () => {
    vi.mocked(revokeAccessAssignment).mockResolvedValue(revokedResult());
    const { queryClient, wrapper } = createHarness();
    queryClient.setQueryData(employmentTermsAdminListKey, { sensitive: 'cached' });
    queryClient.setQueryData(MANAGER_WORKSPACE_CONTEXT_QUERY_KEY, { scoped: 'cached' });
    queryClient.setQueryData(unregisteredRetentionEvidenceKey, { retained: 'unclassified' });
    const { result } = renderHook(() => useAccessAssignmentRevokeMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        assignmentId: 'assignment-01',
        payload: { reason: 'Unknown target' },
      });
    });

    expect(queryClient.getQueryData(employmentTermsAdminListKey)).toBeUndefined();
    expect(queryClient.getQueryData(MANAGER_WORKSPACE_CONTEXT_QUERY_KEY)).toBeUndefined();
    expect(queryClient.getQueryData(unregisteredRetentionEvidenceKey)).toEqual({
      retained: 'unclassified',
    });
    expect(queryClient.getQueryState(CURRENT_ACTOR_CAPABILITIES_QUERY_KEY)?.isInvalidated).toBe(
      true,
    );
  });
});
