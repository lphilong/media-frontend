import { useLocation } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

import i18n from '@shared/i18n/i18n';
import {
  useConfirmDialog,
  ConfirmDialogProvider,
} from '@shared/components/primitives/ConfirmDialog';
import { ListPagination } from '@shared/components/primitives/ListPagination';
import { PermissionDeniedState } from '@shared/components/primitives/PermissionDeniedState';
import { AsyncReferencePicker } from '@shared/components/reference/AsyncReferencePicker';
import {
  createActorCapabilities,
  createFailClosedActorCapabilities,
  createScopeGrant,
  createUser,
  makeFinanceScope,
} from '@test/factories';
import {
  expectCursorPaginationDisclosure,
  expectDangerousActionRequiresConfirmation,
  expectNoForbiddenNormalUiLeaks,
  expectNoRawAccountContextCodes,
  expectNoRawIdsInNormalUi,
  expectPermissionDeniedBusinessCopy,
  expectReferencePickerOption,
} from '@test/assertions';
import { setupLocale, installFakeTime } from '@test/locale-time';
import { setupMswScenario } from '@test/msw-scenario';
import {
  getMockCurrentActorCapabilities,
  setMockCurrentActorCapabilities,
} from '@test/msw/identity-access-handlers';
import {
  renderModuleSurface,
  renderRouteWithAccess,
  renderWithProviders,
} from '@test/render-app-route';

const LocationProbe = (): JSX.Element => {
  const location = useLocation();

  return <p>Current route: {location.pathname}</p>;
};

const DangerousActionHarness = (): JSX.Element => {
  const { confirm } = useConfirmDialog();

  return (
    <button
      type="button"
      onClick={() =>
        void confirm({
          title: 'Archive record',
          description: 'This action changes a controlled record.',
          confirmLabel: 'Confirm action',
          confirmTone: 'danger',
        })
      }
    >
      Archive
    </button>
  );
};

describe('TEST Macro 2 harness baseline helpers', () => {
  it('creates deterministic fail-closed actor, user, scope, workspace, and finance factories', () => {
    const actor = createActorCapabilities({
      id: 'actor-finance',
      permissions: ['revenueLedger.read'],
      scopeGrants: makeFinanceScope({ revenueLedger: ['global'] }),
      accountContexts: ['ADMIN_CONSOLE', 'MANAGER_CONSOLE'],
    });
    const failClosed = createFailClosedActorCapabilities();
    const defaultActor = createActorCapabilities();
    const user = createUser({ id: 'user-finance', displayName: 'Finance Operator' });

    expect(actor.workspaceAvailability?.primaryWorkspace).toBe('ADMIN_CONSOLE');
    expect(actor.workspaceAvailability?.managerResponsibilitiesAvailable).toBe(true);
    expect(actor.scopeGrants.revenueLedger).toEqual(['global']);
    expect(defaultActor.accountContexts).toEqual([]);
    expect(defaultActor.workspaceAvailability?.primaryWorkspace).toBeNull();
    expect(
      defaultActor.workspaceAvailability?.availableWorkspaces.every((entry) => !entry.available),
    ).toBe(true);
    expect(makeFinanceScope()).toEqual({
      contractRegistry: [],
      revenueLedger: [],
      commission: [],
    });
    expect(createScopeGrant('kpi', ['managedGroup'])).toEqual({ kpi: ['managedGroup'] });
    expect(failClosed.accountContexts).toEqual([]);
    expect(failClosed.workspaceAvailability?.primaryWorkspace).toBeNull();
    expect(user.timezone).toBe('Asia/Saigon');
  });

  it('renders providers, module surfaces, and route helpers with isolated query clients', async () => {
    const first = renderWithProviders(<p>Provider render</p>);
    const second = renderWithProviders(<p>Second render</p>);

    expect(first.queryClient).not.toBe(second.queryClient);
    expect(await screen.findByText('Provider render')).toBeInTheDocument();
    expect(await screen.findByText('Second render')).toBeInTheDocument();

    renderModuleSurface(<LocationProbe />, { routePath: '/module-local' });
    expect(await screen.findByText('Current route: /module-local')).toBeInTheDocument();

    const actor = createActorCapabilities({ id: 'route-helper-actor' });
    renderRouteWithAccess('/local-route', {
      capabilities: actor,
      routes: [{ path: '/local-route', element: <p>Route helper render</p> }],
    });

    expect(await screen.findByText('Route helper render')).toBeInTheDocument();
    expect(getMockCurrentActorCapabilities().id).toBe('route-helper-actor');
  });

  it('fails closed when route/access capabilities are omitted', async () => {
    setMockCurrentActorCapabilities(
      createActorCapabilities({
        id: 'stale-admin-state',
        accountContexts: ['ADMIN_CONSOLE'],
        permissions: ['role:list'],
        scopeGrants: makeFinanceScope({ revenueLedger: ['global'] }),
      }),
    );

    renderRouteWithAccess('/local-route', {
      routes: [{ path: '/local-route', element: <p>Route helper fail closed</p> }],
    });

    const actor = getMockCurrentActorCapabilities();
    expect(await screen.findByText('Route helper fail closed')).toBeInTheDocument();
    expect(actor.id).toBe('test-actor');
    expect(actor.permissions).toEqual([]);
    expect(actor.scopeGrants).toEqual({});
    expect(actor.accountContexts).toEqual([]);
    expect(actor.workspaceAvailability?.primaryWorkspace).toBeNull();
    expect(
      actor.workspaceAvailability?.availableWorkspaces.every((entry) => !entry.available),
    ).toBe(true);
  });

  it('sets MSW scenarios fail-closed by default after reset', () => {
    setMockCurrentActorCapabilities(
      createActorCapabilities({
        id: 'stale-scenario-admin',
        accountContexts: ['ADMIN_CONSOLE'],
        permissions: ['role:list'],
      }),
    );

    setupMswScenario();

    const actor = getMockCurrentActorCapabilities();
    expect(actor.permissions).toEqual([]);
    expect(actor.scopeGrants).toEqual({});
    expect(actor.accountContexts).toEqual([]);
    expect(actor.workspaceAvailability?.primaryWorkspace).toBeNull();
    expect(
      actor.workspaceAvailability?.availableWorkspaces.every((entry) => !entry.available),
    ).toBe(true);
  });

  it('sets MSW scenarios, locale, and fake time without using product behavior as truth', async () => {
    const restoreTime = installFakeTime('2026-06-15T00:00:00+07:00');

    try {
      const restoreLocale = await setupLocale('en');
      setupMswScenario({
        capabilities: createActorCapabilities({ id: 'scenario-actor' }),
        handlers: [
          http.get('*/test-harness/scenario', () =>
            HttpResponse.json({ data: { scenario: 'ok' } }),
          ),
        ],
      });

      const response = await fetch('http://localhost/test-harness/scenario');
      expect(await response.json()).toEqual({ data: { scenario: 'ok' } });
      expect(getMockCurrentActorCapabilities().id).toBe('scenario-actor');
      expect(new Date().toISOString()).toBe('2026-06-14T17:00:00.000Z');
      await restoreLocale();
    } finally {
      restoreTime();
    }
  });

  it('restores locale changes through the locale helper cleanup', async () => {
    await setupLocale('en');
    const restoreLocale = await setupLocale('vi');

    expect(i18n.language).toBe('vi');
    await restoreLocale();
    expect(i18n.language).toBe('en');
  });

  it('asserts permission copy, raw-code leaks, and cursor disclosure through reusable helpers', async () => {
    renderWithProviders(
      <>
        <PermissionDeniedState
          reason="missing-account-context"
          requiredAccountContext="ADMIN_CONSOLE"
        />
        <ListPagination
          mode="cursor"
          canGoBack={false}
          canGoNext
          displayedCount={20}
          onPrevious={() => undefined}
          onNext={() => undefined}
        />
      </>,
    );

    expect(await screen.findByRole('navigation', { name: /list pagination/i })).toBeInTheDocument();
    expectPermissionDeniedBusinessCopy();
    expectNoRawAccountContextCodes();
    expectNoRawIdsInNormalUi(document.body, ['ADMIN_CONSOLE']);
    expectCursorPaginationDisclosure();
  });

  it('asserts forbidden normal UI leak classes and ignores explicit technical disclosure', () => {
    const safeContainer = document.createElement('section');
    safeContainer.innerHTML = `
      <p>Business-safe access summary</p>
      <details>
        <summary>Technical trace</summary>
        <pre>{"sourceTrace":[{"source":"ACCOUNT_CONTEXT","id":"550e8400-e29b-41d4-a716-446655440000"}]}</pre>
      </details>
      <div data-normal-ui-ignore>ADMIN_FULL CurrentActorCapabilities DTO debug payload</div>
    `;

    expectNoForbiddenNormalUiLeaks(safeContainer);

    const unsafeContainer = document.createElement('section');
    unsafeContainer.textContent =
      'ADMIN_CONSOLE ADMIN_FULL ACCOUNT_CONTEXT CurrentActorCapabilities {"sourceTrace":[]} debug payload user-12345';

    expect(() => expectNoForbiddenNormalUiLeaks(unsafeContainer)).toThrow();
  });

  it('asserts dangerous confirmation and reference picker options without raw ids', async () => {
    renderWithProviders(
      <>
        <ConfirmDialogProvider>
          <DangerousActionHarness />
        </ConfirmDialogProvider>
        <AsyncReferencePicker
          pickerId="test-reference"
          value={undefined}
          onChange={() => undefined}
          loadOptions={async () => [
            {
              id: 'user-123',
              label: 'Mina Manager',
              description: 'Assigned work lead',
            },
          ]}
          showTechnicalMetadata={false}
        />
      </>,
    );

    await screen.findByRole('option', { name: /Mina Manager/ });
    expectReferencePickerOption(/Mina Manager/, { rawIds: ['user-123'] });

    await expectDangerousActionRequiresConfirmation(
      screen.getByRole('button', { name: 'Archive' }),
      {
        confirmName: 'Confirm action',
      },
    );
  });

  it('keeps fake-time helper cleanup explicit for following tests', () => {
    const restoreTime = installFakeTime('2026-01-01T00:00:00.000Z');
    expect(vi.isFakeTimers()).toBe(true);
    restoreTime();
    expect(vi.isFakeTimers()).toBe(false);
  });
});
