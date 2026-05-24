import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

import {
  canUseAction,
  currentActorCapabilitiesSchema,
  fetchCurrentActorCapabilities,
  hasAllPermissions,
  hasAnyPermission,
  hasAnyScopeGrant,
  hasPermission,
  hasScopeGrant,
  PERMISSIONS,
  useCurrentActorCapabilities,
  type CurrentActorCapabilities,
} from '@shared/auth/current-actor-capabilities';
import { apiRequest } from '@shared/api';

vi.mock('@shared/api', () => ({
  apiRequest: vi.fn(),
}));

const capabilitiesPayload: CurrentActorCapabilities = {
  id: 'user-admin',
  type: 'admin',
  context: 'ADMIN',
  isActive: true,
  roles: ['role-admin'],
  permissions: ['role:update', 'revenueLedger.update'],
  scopeGrants: {
    revenueLedger: ['global'],
    eventAssignment: ['managedGroup'],
    kpi: ['managedGroup', 'self'],
    workSchedule: ['self', 'team'],
  },
  generatedAt: '2026-05-20T00:00:00.000Z',
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('current actor capabilities', () => {
  const apiRequestMock = vi.mocked(apiRequest);

  afterEach(() => {
    apiRequestMock.mockReset();
  });

  it('parses permissions and scopeGrants with a strict schema', () => {
    const parsed = currentActorCapabilitiesSchema.parse(capabilitiesPayload);

    expect(parsed.permissions).toEqual(['role:update', 'revenueLedger.update']);
    expect(parsed.scopeGrants.revenueLedger).toEqual(['global']);
    expect(parsed.scopeGrants.eventAssignment).toEqual(['managedGroup']);
    expect(parsed.scopeGrants.kpi).toEqual(['managedGroup', 'self']);
    expect(() =>
      currentActorCapabilitiesSchema.parse({
        ...capabilitiesPayload,
        token: 'secret',
      }),
    ).toThrow();
  });

  it('fetches current actor capabilities from the admin introspection endpoint', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: capabilitiesPayload });

    await expect(fetchCurrentActorCapabilities()).resolves.toEqual(capabilitiesPayload);
    expect(apiRequestMock).toHaveBeenCalledWith({
      method: 'GET',
      url: '/admin/me/capabilities',
    });
  });

  it('exposes UX-only permission and scope helpers', () => {
    expect(hasPermission(capabilitiesPayload, PERMISSIONS.ROLE_UPDATE)).toBe(true);
    expect(hasPermission(capabilitiesPayload, PERMISSIONS.ROLE_ARCHIVE)).toBe(false);
    expect(
      hasAnyPermission(capabilitiesPayload, [PERMISSIONS.ROLE_ARCHIVE, PERMISSIONS.ROLE_UPDATE]),
    ).toBe(true);
    expect(
      hasAllPermissions(capabilitiesPayload, [
        PERMISSIONS.ROLE_UPDATE,
        PERMISSIONS.REVENUE_LEDGER_UPDATE,
      ]),
    ).toBe(true);
    expect(
      hasAllPermissions(capabilitiesPayload, [PERMISSIONS.ROLE_UPDATE, PERMISSIONS.ROLE_ARCHIVE]),
    ).toBe(false);
    expect(hasScopeGrant(capabilitiesPayload, 'revenueLedger', 'global')).toBe(true);
    expect(hasScopeGrant(capabilitiesPayload, 'kpi', 'managedGroup')).toBe(true);
    expect(hasScopeGrant(capabilitiesPayload, 'kpi', 'global')).toBe(false);
    expect(hasAnyScopeGrant(capabilitiesPayload, 'kpi', ['global', 'managedGroup'])).toBe(true);
    expect(
      canUseAction(capabilitiesPayload, {
        permission: PERMISSIONS.REVENUE_LEDGER_UPDATE,
        scope: { module: 'commission', value: 'global' },
      }),
    ).toEqual({ allowed: false, reason: 'missing-scope' });
  });

  it('hook handles success', async () => {
    apiRequestMock.mockResolvedValueOnce({ data: capabilitiesPayload });

    const { result } = renderHook(() => useCurrentActorCapabilities(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.permissions).toContain('role:update');
  });

  it('hook handles failure without throwing from render', async () => {
    apiRequestMock.mockRejectedValueOnce(new Error('denied'));

    const { result } = renderHook(() => useCurrentActorCapabilities(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
