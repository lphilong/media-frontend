import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { ModuleAccessGuard } from '@app/router/ModuleAccessGuard';
import { WorkspaceAccessGuard } from '@app/router/WorkspaceAccessGuard';
import type {
  AccountContext,
  CurrentActorCapabilities,
} from '@shared/auth/current-actor-capabilities';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';

const useCurrentActorCapabilitiesMock = vi.hoisted(() => vi.fn());

vi.mock('@shared/auth/current-actor-capabilities', async () => {
  const actual =
    await vi.importActual<typeof import('@shared/auth/current-actor-capabilities')>(
      '@shared/auth/current-actor-capabilities',
    );

  return {
    ...actual,
    useCurrentActorCapabilities: () => useCurrentActorCapabilitiesMock(),
  };
});

type CapabilitiesQueryState = {
  data?: CurrentActorCapabilities;
  isError?: boolean;
  isLoading?: boolean;
};

const makeCapabilities = (workspaces: readonly AccountContext[]): CurrentActorCapabilities => ({
  id: 'access-guard-test-user',
  type: 'admin',
  context: 'ADMIN',
  isActive: true,
  roles: [],
  permissions: ['dashboardLite.read'],
  scopeGrants: {
    dashboardLite: ['global'],
  },
  accountContexts: [...workspaces],
  workspaceAvailability: {
    primaryWorkspace: workspaces[0] ?? null,
    availableWorkspaces: (['ADMIN_CONSOLE', 'MANAGER_CONSOLE', 'STAFF_CONSOLE'] as const).map(
      (context) => ({
        context,
        available: workspaces.includes(context),
        source: 'ACCOUNT_CONTEXT',
        reasonCodes: workspaces.includes(context)
          ? ['ACCOUNT_CONTEXT_ACTIVE']
          : ['ACCOUNT_CONTEXT_MISSING'],
        trace: [{ source: 'ACCOUNT_CONTEXT', context, matched: workspaces.includes(context) }],
      }),
    ),
    ownDataAvailable: workspaces.includes('STAFF_CONSOLE'),
    managerResponsibilitiesAvailable: workspaces.includes('MANAGER_CONSOLE'),
    effectiveAccessTraceAvailable: true,
    sourceTrace: [
      {
        source: 'ACCOUNT_CONTEXT',
        accountContexts: [...workspaces],
        primaryWorkspace: workspaces[0] ?? null,
      },
    ],
  },
  generatedAt: '2026-07-02T00:00:00.000Z',
});

const setCapabilitiesQuery = (state: CapabilitiesQueryState): void => {
  useCurrentActorCapabilitiesMock.mockReturnValue({
    data: undefined,
    isError: false,
    isLoading: false,
    ...state,
  });
};

describe('route access guards', () => {
  beforeEach(async () => {
    await setLocale(DEFAULT_LOCALE);
    useCurrentActorCapabilitiesMock.mockReset();
  });

  it('maps ModuleAccessGuard capability query errors to missing capabilities', () => {
    setCapabilitiesQuery({ isError: true });

    render(
      <ModuleAccessGuard moduleId="dashboard">
        <div>Allowed dashboard</div>
      </ModuleAccessGuard>,
    );

    expect(screen.getByText(/Không tải được dữ liệu quyền truy cập/u)).toBeInTheDocument();
    expect(screen.queryByText(/ngữ cảnh làm việc phù hợp/u)).not.toBeInTheDocument();
    expect(screen.queryByText('Allowed dashboard')).not.toBeInTheDocument();
  });

  it('maps WorkspaceAccessGuard capability query errors to missing capabilities', () => {
    setCapabilitiesQuery({ isError: true });

    render(
      <WorkspaceAccessGuard workspace="MANAGER_CONSOLE">
        <div>Allowed manager workspace</div>
      </WorkspaceAccessGuard>,
    );

    expect(screen.getByText(/Không tải được dữ liệu quyền truy cập/u)).toBeInTheDocument();
    expect(screen.queryByText(/ngữ cảnh làm việc phù hợp/u)).not.toBeInTheDocument();
    expect(screen.queryByText('Allowed manager workspace')).not.toBeInTheDocument();
  });

  it('keeps ModuleAccessGuard missing admin workspace mapped to missing account context', () => {
    setCapabilitiesQuery({ data: makeCapabilities(['MANAGER_CONSOLE']) });

    render(
      <ModuleAccessGuard moduleId="dashboard">
        <div>Allowed dashboard</div>
      </ModuleAccessGuard>,
    );

    expect(screen.getByText(/ngữ cảnh làm việc phù hợp/u)).toBeInTheDocument();
    expect(screen.getByText(/Ngữ cảnh: ADMIN_CONSOLE/u)).toBeInTheDocument();
    expect(screen.queryByText(/Không tải được dữ liệu quyền truy cập/u)).not.toBeInTheDocument();
    expect(screen.queryByText('Allowed dashboard')).not.toBeInTheDocument();
  });

  it('keeps WorkspaceAccessGuard missing workspace mapped to missing account context', () => {
    setCapabilitiesQuery({ data: makeCapabilities(['STAFF_CONSOLE']) });

    render(
      <WorkspaceAccessGuard workspace="MANAGER_CONSOLE">
        <div>Allowed manager workspace</div>
      </WorkspaceAccessGuard>,
    );

    expect(screen.getByText(/ngữ cảnh làm việc phù hợp/u)).toBeInTheDocument();
    expect(screen.getByText(/Ngữ cảnh: MANAGER_CONSOLE/u)).toBeInTheDocument();
    expect(screen.queryByText(/Không tải được dữ liệu quyền truy cập/u)).not.toBeInTheDocument();
    expect(screen.queryByText('Allowed manager workspace')).not.toBeInTheDocument();
  });
});
