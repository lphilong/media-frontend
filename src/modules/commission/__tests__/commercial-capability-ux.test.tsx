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
  talentKpi?: Array<'global'>;
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

const commonCapabilityText = (key: string): string => i18n.t(`common:capabilities.${key}`);

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
        'contractRegistry.update',
        'contractRegistry.manageOwner',
        'contractRegistry.manageFileReference',
        'contractRegistry.manageLifecycle',
      ],
      scopeGrants: {},
    });

    await renderContractRecordDetail();

    const editDraft = await screen.findByRole('button', {
      name: i18n.t('contract-registry:actions.editDraftCore'),
    });
    await waitFor(() => expect(editDraft).toBeDisabled());
    expect(editDraft).toHaveAccessibleDescription(commonCapabilityText('missingScope'));
    expect(
      screen.getByRole('button', {
        name: i18n.t('contract-registry:actions.assignOwner'),
      }),
    ).toHaveAccessibleDescription(commonCapabilityText('missingScope'));

    cleanup();
    mockCapabilities({
      permissions: [
        'contractRegistry.manageOwner',
        'contractRegistry.manageFileReference',
        'contractRegistry.manageLifecycle',
      ],
      scopeGrants: { contractRegistry: ['global'] },
    });
    await renderContractRecordDetail();

    const missingPermissionEdit = await screen.findByRole('button', {
      name: i18n.t('contract-registry:actions.editDraftCore'),
    });
    await waitFor(() => expect(missingPermissionEdit).toBeDisabled());
    expect(missingPermissionEdit).toHaveAccessibleDescription(
      commonCapabilityText('missingPermission'),
    );
  });

  it('requires Talent KPI permission and global scope while preserving archived local disabled state', async () => {
    mockCapabilities({
      permissions: ['talentKpi.update', 'talentKpi.manageMetrics', 'talentKpi.manageLifecycle'],
      scopeGrants: {},
    });

    renderRoute('/talent-kpi-records/talent-kpi-record-001');

    const replaceMetrics = await screen.findByRole('button', {
      name: i18n.t('talent-kpi:actions.replaceMetrics'),
    });
    await waitFor(() => expect(replaceMetrics).toBeDisabled());
    expect(replaceMetrics).toHaveAccessibleDescription(commonCapabilityText('missingScope'));

    cleanup();
    mockCapabilities({
      permissions: [],
      scopeGrants: { talentKpi: ['global'] },
    });
    renderRoute('/talent-kpi-records/talent-kpi-record-archived');

    const archivedEdit = await screen.findByRole('button', {
      name: i18n.t('talent-kpi:actions.editDraftCore'),
    });
    expect(archivedEdit).toBeDisabled();
    await waitFor(() =>
      expect(screen.queryByText(commonCapabilityText('missingPermission'))).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(commonCapabilityText('missingScope'))).not.toBeInTheDocument();
  });

  it('requires Commission Rule global scope and leaves fully capable local actions enabled', async () => {
    mockCapabilities({
      permissions: ['commissionRule.update', 'commissionRule.manageLifecycle'],
      scopeGrants: {},
    });

    renderRoute('/commission/rules/commission-rule-001');

    const activate = await screen.findByRole('button', {
      name: i18n.t('commission:rules.actions.activate'),
    });
    await waitFor(() => expect(activate).toBeDisabled());
    expect(activate).toHaveAccessibleDescription(commonCapabilityText('missingScope'));

    cleanup();
    mockCapabilities({
      permissions: ['commissionRule.update', 'commissionRule.manageLifecycle'],
      scopeGrants: { commission: ['global'] },
    });
    renderRoute('/commission/rules/commission-rule-001');

    const editDraft = await screen.findByRole('button', {
      name: i18n.t('commission:rules.actions.editDraftCore'),
    });
    await waitFor(() => expect(editDraft).toBeEnabled());
    expect(editDraft).not.toHaveAccessibleDescription(commonCapabilityText('missingScope'));
  });

  it('requires Commission Settlement global scope and keeps capability fetch failure non-fatal', async () => {
    mockCapabilities({
      permissions: ['commissionSettlement.update', 'commissionSettlement.manageLifecycle'],
      scopeGrants: {},
    });

    renderRoute('/commission/settlements/commission-settlement-001');

    const replaceRevenueEntries = await screen.findByRole('button', {
      name: i18n.t('commission:settlements.actions.replaceRevenueEntries'),
    });
    await waitFor(() => expect(replaceRevenueEntries).toBeDisabled());
    expect(replaceRevenueEntries).toHaveAccessibleDescription(commonCapabilityText('missingScope'));

    cleanup();
    mockCapabilities({ status: 500 });
    renderRoute('/commission/settlements/commission-settlement-001');

    const editDraft = await screen.findByRole('button', {
      name: i18n.t('commission:settlements.actions.editDraftCore'),
    });
    await waitFor(() => expect(editDraft).toBeEnabled());
  });
});
