import i18n from 'i18next';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { appRoutes } from '@app/router/router';
import {
  fetchRevenueEntriesByEvent,
  fetchRevenueEntriesByPlatform,
  fetchRevenueEntriesByTalent,
} from '@modules/revenue-ledger/api/revenue-ledger.api';
import { formatVietnamTimestamp } from '@shared/formatting/formatters';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';
import { server } from '@test/msw/server';

const adminWorkspaceAvailability = {
  primaryWorkspace: 'ADMIN_CONSOLE',
  availableWorkspaces: [
    {
      context: 'STAFF_CONSOLE',
      available: false,
      source: 'ACCOUNT_CONTEXT',
      reasonCodes: ['ACCOUNT_CONTEXT_MISSING'],
      trace: [{ source: 'ACCOUNT_CONTEXT', context: 'STAFF_CONSOLE', matched: false }],
    },
    {
      context: 'MANAGER_CONSOLE',
      available: false,
      source: 'ACCOUNT_CONTEXT',
      reasonCodes: ['ACCOUNT_CONTEXT_MISSING'],
      trace: [{ source: 'ACCOUNT_CONTEXT', context: 'MANAGER_CONSOLE', matched: false }],
    },
    {
      context: 'ADMIN_CONSOLE',
      available: true,
      source: 'ACCOUNT_CONTEXT',
      reasonCodes: ['ACCOUNT_CONTEXT_ACTIVE'],
      trace: [{ source: 'ACCOUNT_CONTEXT', context: 'ADMIN_CONSOLE', matched: true }],
    },
  ],
  ownDataAvailable: false,
  managerResponsibilitiesAvailable: false,
  effectiveAccessTraceAvailable: true,
  sourceTrace: [
    {
      source: 'ACCOUNT_CONTEXT',
      accountContexts: ['ADMIN_CONSOLE'],
      primaryWorkspace: 'ADMIN_CONSOLE',
    },
  ],
} as const;

const renderRoute = (path: string) => {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });

  renderAppWithProviders(<RouterProvider router={router} />, { queryClient });

  return router;
};

const mockRevenueLedgerQueryAccess = (): void => {
  server.use(
    http.get('*/admin/me/capabilities', () =>
      HttpResponse.json({
        data: {
          id: 'revenue-ledger-query-user',
          type: 'admin',
          context: 'ADMIN',
          isActive: true,
          roles: ['role-revenue-ledger-query'],
          permissions: ['revenueLedger.read', 'revenueLedger.create'],
          scopeGrants: {
            revenueLedger: ['global'],
          },
          accountContexts: ['ADMIN_CONSOLE'],
          workspaceAvailability: adminWorkspaceAvailability,
          generatedAt: '2026-05-20T00:00:00.000Z',
        },
      }),
    ),
  );
};

describe('Revenue Ledger Wave 8 query mode selection', () => {
  beforeEach(async () => {
    await setLocale(DEFAULT_LOCALE);
    mockRevenueLedgerQueryAccess();
  });

  it.each([
    ['subjectTalentId', '/revenue-entries?subjectTalentId=talent-001', 'REV-202604-000001'],
    [
      'attributionPlatformAccountId',
      '/revenue-entries?attributionPlatformAccountId=platform-001',
      'REV-202604-000001',
    ],
    ['attributionEventId', '/revenue-entries?attributionEventId=event-001', 'REV-202604-000002'],
  ])('keeps flat %s identity filters in flat-list mode', async (_label, path, expectedCode) => {
    renderRoute(path);

    expect(
      await screen.findByRole('heading', { name: i18n.t('revenue-ledger:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText(expectedCode, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(i18n.t('revenue-ledger:filters.searchPlaceholder')),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('revenue-ledger:relatedModes.by-talent')),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('revenue-ledger:relatedModes.by-platform')),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('revenue-ledger:relatedModes.by-event')),
    ).not.toBeInTheDocument();
  });

  it('allows flat identity filters to coexist with flat-list search', async () => {
    const router = renderRoute(
      '/revenue-entries?subjectTalentId=talent-001&search=REV-202604-000001',
    );

    expect(await screen.findByText('REV-202604-000001', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(i18n.t('revenue-ledger:filters.searchPlaceholder')),
    ).toHaveValue('REV-202604-000001');
    expect(
      screen.queryByText(i18n.t('revenue-ledger:relatedModes.by-talent')),
    ).not.toBeInTheDocument();
    expect(screen.getByText(i18n.t('common:filters.appliedFilters'))).toBeInTheDocument();
    expect(new URLSearchParams(router.state.location.search).get('subjectTalentId')).toBe(
      'talent-001',
    );
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common:filters.moreFilters') }));
    expect(
      screen.getAllByText(i18n.t('revenue-ledger:filters.subjectTalentId')).length,
    ).toBeGreaterThan(0);
    fireEvent.click(
      screen.getByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'revenue-ledger:filters.subjectTalentId',
        )}`,
      }),
    );
    expect(
      screen.queryByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'revenue-ledger:filters.subjectTalentId',
        )}`,
      }),
    ).not.toBeInTheDocument();
  });

  it('clears stale Revenue Ledger selected reference labels when the option becomes unavailable', async () => {
    const user = userEvent.setup();
    renderRoute('/revenue-entries?subjectTalentId=talent-001');

    expect(await screen.findByText('REV-202604-000001', {}, { timeout: 3000 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common:filters.moreFilters') }));

    const appliedFilters = screen.getByLabelText(i18n.t('common:filters.appliedFilters'));
    await waitFor(() => expect(appliedFilters).toHaveTextContent('Mina'));

    await user.type(
      screen.getByPlaceholderText(i18n.t('revenue-ledger:filters.subjectTalentIdPlaceholder')),
      'missing-reference',
    );

    await waitFor(() => {
      expect(appliedFilters).toHaveTextContent('Luna Park');
      expect(appliedFilters).not.toHaveTextContent('Mina');
    });
  });

  it('keeps target timestamp filters hidden but active through the flat-list URL', async () => {
    renderRoute(
      '/revenue-entries?status=FINALIZED&createdBeforeAt=1780000000000&finalizedFromAt=1770000000000&finalizedToAt=1780000000000',
    );

    expect(await screen.findByText('REV-202604-000002', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(
      screen.getByText(`${i18n.t('revenue-ledger:filters.createdBeforeAt')}:`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${i18n.t('revenue-ledger:filters.finalizedFromAt')}:`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${i18n.t('revenue-ledger:filters.finalizedToAt')}:`),
    ).toBeInTheDocument();
    expect(screen.getAllByText(formatVietnamTimestamp(1_780_000_000_000)).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText(formatVietnamTimestamp(1_770_000_000_000)).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText(/1770000000000|1780000000000/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('spinbutton', {
        name: i18n.t('revenue-ledger:filters.finalizedFromAt'),
      }),
    ).not.toBeInTheDocument();
  });

  it('serializes reconciled target filters and keeps narrow sort disabled when they are active', async () => {
    renderRoute(
      '/revenue-entries?status=RECONCILED&reconciledFromAt=1770000000000&reconciledToAt=1780000000000&sortBy=createdAt',
    );

    expect(
      await screen.findByRole('heading', { name: i18n.t('revenue-ledger:page.title') }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(`${i18n.t('revenue-ledger:filters.reconciledFromAt')}:`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${i18n.t('revenue-ledger:filters.reconciledToAt')}:`),
    ).toBeInTheDocument();
    expect(screen.getAllByText(formatVietnamTimestamp(1_770_000_000_000)).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText(formatVietnamTimestamp(1_780_000_000_000)).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText(/1770000000000|1780000000000/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(i18n.t('common:labels.sort'))).toHaveValue('recognizedAt');
  });

  it.each([
    [
      'by-talent',
      '/revenue-entries?view=by-talent&subjectTalentId=talent-001&search=REV-202604-000001',
    ],
    [
      'by-platform',
      '/revenue-entries?view=by-platform&attributionPlatformAccountId=platform-001&search=REV-202604-000001',
    ],
    [
      'by-event',
      '/revenue-entries?view=by-event&attributionEventId=event-001&search=REV-202604-000001',
    ],
  ])('uses explicit %s related mode without related search', async (mode, path) => {
    renderRoute(path);

    expect(
      await screen.findByText(i18n.t(`revenue-ledger:relatedModes.${mode}`), {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(i18n.t('revenue-ledger:filters.searchPlaceholder')),
    ).not.toBeInTheDocument();
  });

  it('parses Revenue Ledger related endpoints with reduced backend shapes', async () => {
    const byTalent = await fetchRevenueEntriesByTalent({
      subjectTalentId: 'talent-001',
      limit: 10,
    });
    const byPlatform = await fetchRevenueEntriesByPlatform({
      attributionPlatformAccountId: 'platform-001',
      limit: 10,
    });
    const byEvent = await fetchRevenueEntriesByEvent({
      attributionEventId: 'event-001',
      limit: 1,
    });

    const byTalentRecord = byTalent.data.find((record) => record.id === 'revenue-entry-001');
    expect(byTalentRecord).toMatchObject({
      id: 'revenue-entry-001',
      revenueEntryCode: 'REV-202604-000001',
      subjectTalentId: 'talent-001',
      revenueKind: 'PLATFORM_LIVESTREAM',
      status: 'DRAFT',
    });
    expect(byTalentRecord).not.toHaveProperty('entrySource');
    expect(byTalentRecord).not.toHaveProperty('createdAt');
    expect(byTalentRecord).not.toHaveProperty('subjectTalentRef');

    const byPlatformRecord = byPlatform.data.find((record) => record.id === 'revenue-entry-001');
    expect(byPlatformRecord).toMatchObject({
      id: 'revenue-entry-001',
      attributionPlatformAccountId: 'platform-001',
      revenueKind: 'PLATFORM_LIVESTREAM',
    });
    expect(byPlatformRecord).not.toHaveProperty('entrySource');
    expect(byPlatformRecord).not.toHaveProperty('createdAt');

    expect(byEvent.data[0]).toMatchObject({
      id: 'revenue-entry-finalized',
      attributionEventId: 'event-001',
      revenueKind: 'EVENT_OPERATIONAL',
    });
    expect(byEvent.data[0]).not.toHaveProperty('entrySource');
    expect(byEvent.data[0]).not.toHaveProperty('createdAt');
  });

  it('keeps Revenue Ledger create, search, and narrow sort controls available during list failure', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/admin/revenue-entries', () =>
        HttpResponse.json({ message: 'errors:transport.generic' }, { status: 500 }),
      ),
    );

    renderRoute('/revenue-entries?search=REV-202604-000001&sortBy=recognizedAt&sortDirection=desc');

    expect(
      await screen.findByText(i18n.t('revenue-ledger:states.loadErrorTitle')),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(i18n.t('revenue-ledger:filters.searchPlaceholder')),
    ).toHaveValue('REV-202604-000001');
    expect(screen.getByLabelText(i18n.t('common:labels.sort'))).toHaveValue('recognizedAt');

    await user.click(screen.getByRole('button', { name: i18n.t('revenue-ledger:actions.create') }));

    expect(
      await screen.findByRole('heading', {
        name: i18n.t('revenue-ledger:mutations.create.title'),
      }),
    ).toBeInTheDocument();
  });

  it('renders readable Revenue attribution refs in list and detail without raw IDs', async () => {
    renderRoute('/revenue-entries');

    expect((await screen.findAllByText('Luna Park', {}, { timeout: 3000 })).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText('Luna TikTok').length).toBeGreaterThan(0);
    expect(screen.queryByText('talent-001')).not.toBeInTheDocument();
    expect(screen.queryByText('platform-001')).not.toBeInTheDocument();

    cleanup();
    renderRoute('/revenue-entries/revenue-entry-finalized');

    expect(await screen.findByText('Minh Tran', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(
      await screen.findByText(
        i18n.t('revenue-ledger:detail.boundaryHelper'),
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText('06:58 22-04-2026').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Spring Live Show').length).toBeGreaterThan(0);
    expect(screen.queryByText('talent-002')).not.toBeInTheDocument();
    expect(screen.queryByText('event-001')).not.toBeInTheDocument();
  });

  it('hides Revenue Ledger actions when capability scope is missing', async () => {
    server.use(
      http.get('*/admin/me/capabilities', () =>
        HttpResponse.json({
          data: {
            id: 'user-admin',
            type: 'admin',
            context: 'ADMIN',
            isActive: true,
            roles: ['role-admin'],
            permissions: [
              'revenueLedger.read',
              'revenueLedger.update',
              'revenueLedger.manageLifecycle',
            ],
            scopeGrants: {},
            accountContexts: ['ADMIN_CONSOLE'],
            workspaceAvailability: adminWorkspaceAvailability,
            generatedAt: '2026-05-20T00:00:00.000Z',
          },
        }),
      ),
    );

    renderRoute('/revenue-entries/revenue-entry-001');

    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(document.body).toHaveTextContent(i18n.t('errors:permission.reason.missingScope'));
    expect(
      screen.queryByRole('button', {
        name: i18n.t('revenue-ledger:actions.editDraftCore'),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('revenue-ledger:actions.finalize'),
      }),
    ).not.toBeInTheDocument();
  });

  it('keeps invalid Revenue Ledger status reason ahead of capability reasons', async () => {
    server.use(
      http.get('*/admin/me/capabilities', () =>
        HttpResponse.json({
          data: {
            id: 'user-admin',
            type: 'admin',
            context: 'ADMIN',
            isActive: true,
            roles: ['role-admin'],
            permissions: [
              'revenueLedger.read',
              'revenueLedger.update',
              'revenueLedger.manageLifecycle',
            ],
            scopeGrants: {
              revenueLedger: ['global'],
            },
            accountContexts: ['ADMIN_CONSOLE'],
            workspaceAvailability: adminWorkspaceAvailability,
            generatedAt: '2026-05-20T00:00:00.000Z',
          },
        }),
      ),
    );

    renderRoute('/revenue-entries/revenue-entry-archived');

    const editDraftCore = await screen.findByRole('button', {
      name: i18n.t('revenue-ledger:actions.editDraftCore'),
    });

    expect(editDraftCore).toBeDisabled();
    expect(editDraftCore).toHaveAccessibleDescription(i18n.t('common:capabilities.invalidStatus'));
  });
});
