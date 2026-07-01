import i18n from 'i18next';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { appRoutes } from '@app/router/router';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { server } from '@test/msw/server';
import { renderAppWithProviders } from '@test/render-app-route';

type CommercialScopeGrants = {
  contractRegistry?: Array<'global'>;
  commission?: Array<'global'>;
};

type CapabilityResponseParams = {
  permissions?: string[];
  scopeGrants?: CommercialScopeGrants;
  status?: number;
};

const renderRoute = (path: string) => {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  renderAppWithProviders(<RouterProvider router={router} />);
};

const renderContractRecordDetail = async (): Promise<void> => {
  renderRoute('/contract-records/contract-record-001');

  expect(await screen.findByText('CON-2026-000001', {}, { timeout: 3000 })).toBeInTheDocument();
  expect(screen.getByText(i18n.t('contract-registry:actionRail.title'))).toBeInTheDocument();
};

const mockCapabilities = ({
  permissions = [],
  scopeGrants = {},
  status,
}: CapabilityResponseParams): void => {
  server.use(
    http.get('*/admin/me/capabilities', () => {
      if (status) {
        return HttpResponse.json({ message: 'Capability check failed' }, { status });
      }

      return HttpResponse.json({
        data: {
          id: 'commercial-capability-test-user',
          type: 'admin',
          context: 'ADMIN',
          isActive: true,
          roles: ['role-commercial-capability-test'],
          permissions,
          scopeGrants,
          generatedAt: '2026-05-21T00:00:00.000Z',
        },
      });
    }),
  );
};

describe('commercial capability UX hints', () => {
  beforeEach(async () => {
    await setLocale(DEFAULT_LOCALE);
  });

  it('requires Contract Registry permission and global scope for locally available detail actions', async () => {
    mockCapabilities({
      permissions: [
        'contractRegistry.read',
        'contractRegistry.update',
        'contractRegistry.manageOwner',
        'contractRegistry.manageFileReference',
        'contractRegistry.manageLifecycle',
      ],
      scopeGrants: {},
    });

    await renderContractRecordDetail();

    await waitFor(() =>
      expect(
        screen.queryByRole('button', {
          name: i18n.t('contract-registry:actions.editDraftCore'),
        }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('button', {
        name: i18n.t('contract-registry:actions.assignOwner'),
      }),
    ).not.toBeInTheDocument();

    cleanup();
    mockCapabilities({
      permissions: [
        'contractRegistry.read',
        'contractRegistry.manageOwner',
        'contractRegistry.manageFileReference',
        'contractRegistry.manageLifecycle',
      ],
      scopeGrants: { contractRegistry: ['global'] },
    });
    await renderContractRecordDetail();

    expect(
      screen.queryByRole('button', {
        name: i18n.t('contract-registry:actions.editDraftCore'),
      }),
    ).not.toBeInTheDocument();
  });

  it('preserves Contract Registry object-state disabled actions for fully capable actors', async () => {
    mockCapabilities({
      permissions: [
        'contractRegistry.read',
        'contractRegistry.update',
        'contractRegistry.manageOwner',
        'contractRegistry.manageFileReference',
        'contractRegistry.manageLifecycle',
      ],
      scopeGrants: { contractRegistry: ['global'] },
    });

    renderRoute('/contract-records/contract-record-archived');

    const editDraft = await screen.findByRole('button', {
      name: i18n.t('contract-registry:actions.editDraftCore'),
    });
    expect(editDraft).toBeDisabled();
    expect(
      screen.getByRole('button', {
        name: i18n.t('contract-registry:actions.assignOwner'),
      }),
    ).toBeDisabled();
  });

  it('hides Contract Registry object-state disabled actions for read-only actors', async () => {
    mockCapabilities({
      permissions: ['contractRegistry.read'],
      scopeGrants: { contractRegistry: ['global'] },
    });

    renderRoute('/contract-records/contract-record-archived');

    expect(await screen.findByText('CON-2025-999999')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('contract-registry:actions.editDraftCore'),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('contract-registry:actions.assignOwner'),
      }),
    ).not.toBeInTheDocument();
  });

  it('requires Commission Rule global scope and leaves fully capable local actions enabled', async () => {
    mockCapabilities({
      permissions: [
        'commissionRule.read',
        'commissionRule.update',
        'commissionRule.manageLifecycle',
      ],
      scopeGrants: {},
    });

    renderRoute('/commission/rules/commission-rule-001');

    await screen.findByText(i18n.t('commission:rules.actionRail.title'));
    expect(
      screen.queryByRole('button', {
        name: i18n.t('commission:rules.actions.activate'),
      }),
    ).not.toBeInTheDocument();

    cleanup();
    mockCapabilities({
      permissions: [
        'commissionRule.read',
        'commissionRule.update',
        'commissionRule.manageLifecycle',
      ],
      scopeGrants: { commission: ['global'] },
    });
    renderRoute('/commission/rules/commission-rule-001');

    const editDraft = await screen.findByRole('button', {
      name: i18n.t('commission:rules.actions.editDraftCore'),
    });
    await waitFor(() => expect(editDraft).toBeEnabled());
  });

  it('requires Commission Settlement global scope and hides actions when capability fetch fails', async () => {
    mockCapabilities({
      permissions: [
        'commissionSettlement.read',
        'commissionSettlement.update',
        'commissionSettlement.manageLifecycle',
      ],
      scopeGrants: {},
    });

    renderRoute('/commission/settlements/commission-settlement-001');

    await screen.findByText(i18n.t('commission:settlements.actionRail.title'));
    expect(
      screen.queryByRole('button', {
        name: i18n.t('commission:settlements.actions.replaceRevenueEntries'),
      }),
    ).not.toBeInTheDocument();

    cleanup();
    mockCapabilities({ status: 500 });
    renderRoute('/commission/settlements/commission-settlement-001');

    expect(await screen.findByText('Không có quyền truy cập')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('commission:settlements.actions.editDraftCore'),
      }),
    ).not.toBeInTheDocument();
  });
});
