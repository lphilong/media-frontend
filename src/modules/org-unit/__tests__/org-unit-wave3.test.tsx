import i18n from 'i18next';
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { appRoutes } from '@app/router/router';
import {
  OrgUnitCreateSurface,
  OrgUnitEditSurface,
  OrgUnitMoveSurface,
} from '@modules/org-unit/forms/org-unit-mutation-forms';
import { loadContextualEmploymentProfileReferenceOptions } from '@shared/components/reference/admin-reference-options';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import { renderAppWithProviders } from '@test/render-app-route';
import { server } from '@test/msw/server';

vi.mock('@shared/components/reference/admin-reference-options', () => ({
  loadEmploymentProfileReferenceOptions: vi.fn(async () => [
    {
      id: 'ep-001',
      label: 'Alice - EP-000001',
      description: 'Director',
      href: '/employment-profiles/ep-001',
    },
    {
      id: 'ep-002',
      label: 'Bao - EP-000002',
      description: 'Specialist',
      href: '/employment-profiles/ep-002',
    },
  ]),
  loadContextualEmploymentProfileReferenceOptions: vi.fn(async () => [
    {
      id: 'ep-001',
      label: 'Alice - EP-000001',
      description: 'Director - ACTIVE',
      href: '/employment-profiles/ep-001',
    },
  ]),
  loadOrgUnitReferenceOptions: vi.fn(async () => [
    {
      id: 'ou-parent',
      label: 'Parent Unit - OU-PARENT',
      description: 'ACTIVE',
      href: '/org-units/ou-parent',
    },
    {
      id: 'ou-new-parent',
      label: 'New Parent - OU-NEW',
      description: 'ACTIVE',
      href: '/org-units/ou-new-parent',
    },
  ]),
}));

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

const findPicker = async (pickerId: string): Promise<HTMLElement> => {
  await waitFor(() => {
    expect(
      screen
        .getAllByTestId('picker-surface')
        .some((surface) => surface.getAttribute('data-picker-id') === pickerId),
    ).toBe(true);
  });
  const picker = screen
    .getAllByTestId('picker-surface')
    .find((surface) => surface.getAttribute('data-picker-id') === pickerId);
  if (!picker) {
    throw new Error(`Picker not found: ${pickerId}`);
  }
  return picker;
};

const selectPickerOption = async (
  user: ReturnType<typeof userEvent.setup>,
  pickerId: string,
  optionText: RegExp,
): Promise<void> => {
  const picker = await findPicker(pickerId);
  await user.click(await within(picker).findByText(optionText));
};

const textPattern = (text: string): RegExp =>
  new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u');

const openMoreFilters = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(
    screen.getByRole('button', {
      name: new RegExp(i18n.t('common:filters.moreFilters')),
    }),
  );
  expect(
    await screen.findByRole('heading', { name: i18n.t('common:filters.moreFilters') }),
  ).toBeInTheDocument();
};

describe('org unit wave 3 surfaces', () => {
  it('renders list rows for query-driven Org Unit routes', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/org-units?status=INACTIVE&search=OU-000003');

    expect(
      await screen.findByRole('heading', { name: i18n.t('org-unit:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('OU-000003', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByText('Operations', {}, { timeout: 3000 })).toBeInTheDocument();
    const row = (await screen.findAllByText('OU-000003', {}, { timeout: 3000 }))
      .map((element) => element.closest('tr'))
      .find((candidate): candidate is HTMLTableRowElement => Boolean(candidate));
    expect(row).not.toBeNull();
    if (!row) {
      return;
    }
    expect(within(row).getByText(i18n.t('org-unit:statuses.INACTIVE'))).toBeInTheDocument();
    expect(within(row).queryByText('INACTIVE')).not.toBeInTheDocument();
    expect(await screen.findByText('Head Office')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('org-unit:sort.displayOrder'))).toBeInTheDocument();
    expect(screen.queryByText('displayOrder')).not.toBeInTheDocument();
    expect(screen.queryByText(/sortPriority\(/i)).not.toBeInTheDocument();
  });

  it('uses a parent org unit selector for the relationship filter while preserving query ids', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const router = renderRoute('/org-units?status=ACTIVE&parentOrgUnitId=ou-parent');

    expect(
      await screen.findByRole('heading', { name: i18n.t('org-unit:page.title') }),
    ).toBeInTheDocument();
    expect(
      await screen.findByPlaceholderText(i18n.t('org-unit:filters.searchPlaceholder')),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(i18n.t('org-unit:filters.parentOrgUnitIdPlaceholder')),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: i18n.t('org-unit:filters.status') })).toHaveValue(
      'ACTIVE',
    );
    expect(screen.getByText(i18n.t('common:filters.appliedFilters'))).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'org-unit:filters.parentOrgUnitId',
        )}`,
      }),
    ).toBeInTheDocument();

    await openMoreFilters(user);

    const picker = await findPicker('org-unit-filter-parent');
    expect(await within(picker).findAllByText(/OU-PARENT/)).not.toHaveLength(0);

    await user.click(await within(picker).findByRole('button', { name: /OU-NEW/ }));
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('parentOrgUnitId')).toBe(
        'ou-new-parent',
      );
      expect(new URLSearchParams(router.state.location.search).get('parentOrgUnitId')).not.toBe(
        'OU-NEW',
      );
    });

    await user.click(
      screen.getByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'org-unit:filters.parentOrgUnitId',
        )}`,
      }),
    );
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('parentOrgUnitId')).toBeNull();
    });

    await user.click(await within(picker).findByRole('button', { name: /OU-PARENT/ }));
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('parentOrgUnitId')).toBe(
        'ou-parent',
      );
    });

    const field = picker.closest('fieldset');
    expect(field).not.toBeNull();
    if (!field) {
      return;
    }

    await user.click(within(field).getByRole('button', { name: i18n.t('common:actions.clear') }));
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('parentOrgUnitId')).toBeNull();
    });

    await user.click(await within(picker).findByRole('button', { name: /OU-PARENT/ }));
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('parentOrgUnitId')).toBe(
        'ou-parent',
      );
    });

    await user.click(screen.getByRole('button', { name: i18n.t('common:filters.clearAll') }));
    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get('status')).toBeNull();
      expect(params.get('parentOrgUnitId')).toBeNull();
    });
  });

  it('renders detail hierarchy and detail-first action surfaces', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/org-units/ou-root');

    expect(await screen.findByText(i18n.t('org-unit:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('org-unit:fields.displayOrder'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('org-unit:help.displayOrder'))).toBeInTheDocument();

    const activateButton = screen.getByRole('button', {
      name: i18n.t('org-unit:actions.activate'),
    });
    const deactivateButton = screen.getByRole('button', {
      name: i18n.t('org-unit:actions.deactivate'),
    });
    expect(activateButton).toBeDisabled();
    expect(deactivateButton).toBeEnabled();

    await user.click(screen.getByRole('button', { name: i18n.t('org-unit:actions.move') }));
    expect(await screen.findByText(i18n.t('org-unit:mutations.move.title'))).toBeInTheDocument();
    expect(await findPicker('org-unit-new-parent')).toBeInTheDocument();
    const childRow = (await screen.findByText('Sales')).closest('tr');
    expect(childRow).not.toBeNull();
    if (!childRow) {
      return;
    }
    expect(within(childRow).getByText(i18n.t('org-unit:statuses.ACTIVE'))).toBeInTheDocument();
    expect(within(childRow).queryByText('ACTIVE')).not.toBeInTheDocument();
  });

  it('renders Org Unit Responsibilities / Managers with business labels and helper copy', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/org-units/ou-root');

    const heading = await screen.findByText(i18n.t('org-unit:responsibilities.title'));
    const section = heading.closest('section') ?? document.body;

    expect(
      within(section).getByText(i18n.t('org-unit:responsibilities.helper')),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(
        textPattern(i18n.t('org-unit:responsibilityRoles.DEPARTMENT_OWNER')),
      ),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(textPattern(i18n.t('org-unit:responsibilityRoles.UNIT_MANAGER'))),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(textPattern(i18n.t('org-unit:responsibilityRoles.UNIT_OPERATOR'))),
    ).toBeInTheDocument();
    expect(within(section).queryByText('DEPARTMENT_OWNER')).not.toBeInTheDocument();
    expect(within(section).queryByText('managerEmploymentProfileId')).not.toBeInTheDocument();
    expect(within(section).getByText(/EP-000001/)).toBeInTheDocument();
  });

  it('assigns and revokes Org Unit responsibility from the detail page', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/org-units/ou-root');

    const heading = await screen.findByText(i18n.t('org-unit:responsibilities.title'));
    const section = heading.closest('section') ?? document.body;

    await user.click(
      within(section).getByRole('button', { name: i18n.t('org-unit:responsibilities.assign') }),
    );
    const assignSurfaceHeading = await screen.findByRole('heading', {
      name: i18n.t('org-unit:responsibilities.assignTitle'),
    });
    const assignSurface = assignSurfaceHeading.closest('section') ?? document.body;
    expect(
      within(assignSurface).getByText(i18n.t('org-unit:responsibilities.managerEmploymentProfile')),
    ).toBeInTheDocument();
    expect(
      within(assignSurface).getByLabelText(i18n.t('org-unit:responsibilities.role')),
    ).toBeInTheDocument();
    expect(
      within(assignSurface).getByLabelText(i18n.t('org-unit:responsibilities.includeDescendants')),
    ).toBeInTheDocument();
    expect(
      within(assignSurface).getByLabelText(i18n.t('org-unit:responsibilities.isPrimary')),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(loadContextualEmploymentProfileReferenceOptions).toHaveBeenCalledWith('', {
        orgUnitId: 'ou-root',
        employmentStatuses: ['ACTIVE', 'ON_LEAVE'],
      });
    });

    await selectPickerOption(user, 'org-unit-responsibility-manager', /EP-000001/);
    await user.selectOptions(
      within(assignSurface).getByLabelText(i18n.t('org-unit:responsibilities.role')),
      'UNIT_OPERATOR',
    );
    await user.click(
      within(assignSurface).getByLabelText(i18n.t('org-unit:responsibilities.includeDescendants')),
    );
    await user.click(
      within(assignSurface).getByRole('button', {
        name: i18n.t('org-unit:responsibilities.assign'),
      }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {
          name: i18n.t('org-unit:responsibilities.assignTitle'),
        }),
      ).not.toBeInTheDocument();
    });

    const updatedHeading = await screen.findByText(i18n.t('org-unit:responsibilities.title'));
    const updatedSection = updatedHeading.closest('section') ?? document.body;
    expect(
      within(updatedSection).getAllByText(i18n.t('org-unit:responsibilityRoles.UNIT_OPERATOR'))
        .length,
    ).toBeGreaterThan(0);

    const revokeButtonsBefore = within(updatedSection).getAllByRole('button', {
      name: i18n.t('org-unit:responsibilities.revoke'),
    });
    await user.click(revokeButtonsBefore[0]);
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );
    await waitFor(() => {
      const revokeButtonsAfter = within(updatedSection).getAllByRole('button', {
        name: i18n.t('org-unit:responsibilities.revoke'),
      });
      expect(revokeButtonsAfter.length).toBeLessThan(revokeButtonsBefore.length);
    });
  });

  it('edits Org Unit responsibility safe metadata without changing manager identity', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const patchRequests: Array<{ url: string; body: Record<string, unknown> }> = [];

    server.use(
      http.patch('*/admin/org-units/:orgUnitId/responsibilities/:assignmentId', async (info) => {
        const body = (await info.request.json()) as Record<string, unknown>;
        patchRequests.push({ url: info.request.url, body });

        return HttpResponse.json({
          data: {
            id: String(info.params.assignmentId),
            orgUnitId: String(info.params.orgUnitId),
            managerEmploymentProfileId: 'ep-002',
            role: body.role,
            status: 'ACTIVE',
            includeDescendants: body.includeDescendants,
            effectiveFrom: Date.UTC(2026, 1, 1),
            effectiveTo: Date.UTC(2026, 2, 31),
            isPrimary: body.isPrimary,
            createdAt: Date.UTC(2026, 0, 1),
            updatedAt: Date.UTC(2026, 1, 2),
            orgUnitRef: {
              id: 'ou-root',
              code: 'OU-000001',
              name: 'Head Office',
              status: 'ACTIVE',
            },
            managerRef: {
              id: 'ep-002',
              code: 'EP-000002',
              displayName: 'Bao',
              name: 'Bao Tran',
              title: 'Specialist',
              status: 'ON_LEAVE',
            },
          },
        });
      }),
      http.get('*/admin/org-units/:orgUnitId/responsibilities', () =>
        patchRequests.length > 0
          ? HttpResponse.json({
              data: [
                {
                  id: 'ou-responsibility-manager',
                  orgUnitId: 'ou-root',
                  managerEmploymentProfileId: 'ep-002',
                  role: 'UNIT_OPERATOR',
                  status: 'ACTIVE',
                  includeDescendants: true,
                  effectiveFrom: Date.UTC(2026, 1, 1),
                  effectiveTo: Date.UTC(2026, 2, 31),
                  isPrimary: true,
                  createdAt: Date.UTC(2026, 0, 1),
                  updatedAt: Date.UTC(2026, 1, 2),
                  orgUnitRef: {
                    id: 'ou-root',
                    code: 'OU-000001',
                    name: 'Head Office',
                    status: 'ACTIVE',
                  },
                  managerRef: {
                    id: 'ep-002',
                    code: 'EP-000002',
                    displayName: 'Bao',
                    name: 'Bao Tran',
                    title: 'Specialist',
                    status: 'ON_LEAVE',
                  },
                },
              ],
            })
          : HttpResponse.json({
              data: [
                {
                  id: 'ou-responsibility-manager',
                  orgUnitId: 'ou-root',
                  managerEmploymentProfileId: 'ep-002',
                  role: 'UNIT_MANAGER',
                  status: 'ACTIVE',
                  includeDescendants: false,
                  effectiveFrom: Date.UTC(2026, 0, 1),
                  effectiveTo: null,
                  isPrimary: false,
                  createdAt: Date.UTC(2026, 0, 1),
                  updatedAt: Date.UTC(2026, 0, 1),
                  orgUnitRef: {
                    id: 'ou-root',
                    code: 'OU-000001',
                    name: 'Head Office',
                    status: 'ACTIVE',
                  },
                  managerRef: {
                    id: 'ep-002',
                    code: 'EP-000002',
                    displayName: 'Bao',
                    name: 'Bao Tran',
                    title: 'Specialist',
                    status: 'ON_LEAVE',
                  },
                },
              ],
            }),
      ),
    );

    renderRoute('/org-units/ou-root');

    const heading = await screen.findByText(i18n.t('org-unit:responsibilities.title'));
    const section = heading.closest('section') ?? document.body;
    expect(within(section).getByText(/EP-000002/)).toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: i18n.t('common:actions.edit') }));

    const editSurfaceHeading = await screen.findByRole('heading', {
      name: i18n.t('org-unit:responsibilities.editTitle'),
    });
    const editSurface = editSurfaceHeading.closest('section') ?? document.body;

    expect(
      within(editSurface).queryByLabelText(
        i18n.t('org-unit:responsibilities.managerEmploymentProfile'),
      ),
    ).not.toBeInTheDocument();
    expect(within(editSurface).queryByText(/EP-000002/)).not.toBeInTheDocument();
    expect(within(editSurface).queryByText('actionMask')).not.toBeInTheDocument();

    await user.selectOptions(
      within(editSurface).getByLabelText(i18n.t('org-unit:responsibilities.role')),
      'UNIT_OPERATOR',
    );
    await user.clear(
      within(editSurface).getByLabelText(i18n.t('org-unit:responsibilities.effectiveFrom')),
    );
    await user.type(
      within(editSurface).getByLabelText(i18n.t('org-unit:responsibilities.effectiveFrom')),
      '2026-02-01',
    );
    await user.clear(
      within(editSurface).getByLabelText(i18n.t('org-unit:responsibilities.effectiveTo')),
    );
    await user.type(
      within(editSurface).getByLabelText(i18n.t('org-unit:responsibilities.effectiveTo')),
      '2026-03-31',
    );
    await user.click(
      within(editSurface).getByLabelText(i18n.t('org-unit:responsibilities.includeDescendants')),
    );
    await user.click(
      within(editSurface).getByLabelText(i18n.t('org-unit:responsibilities.isPrimary')),
    );
    await user.click(
      within(editSurface).getByRole('button', { name: i18n.t('org-unit:responsibilities.save') }),
    );

    await waitFor(() => {
      expect(patchRequests).toHaveLength(1);
    });
    expect(patchRequests[0].url).toContain(
      '/admin/org-units/ou-root/responsibilities/ou-responsibility-manager',
    );
    expect(patchRequests[0].body).toEqual({
      role: 'UNIT_OPERATOR',
      includeDescendants: true,
      effectiveFrom: '2026-02-01',
      effectiveTo: '2026-03-31',
      isPrimary: true,
    });
    expect(patchRequests[0].body).not.toHaveProperty('managerEmploymentProfileId');
    expect(patchRequests[0].body).not.toHaveProperty('actionMask');

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {
          name: i18n.t('org-unit:responsibilities.editTitle'),
        }),
      ).not.toBeInTheDocument();
    });

    const refreshedHeading = await screen.findByText(i18n.t('org-unit:responsibilities.title'));
    const refreshedSection = refreshedHeading.closest('section') ?? document.body;
    expect(within(refreshedSection).getByText(/EP-000002/)).toBeInTheDocument();
    expect(
      within(refreshedSection).getByText(
        textPattern(i18n.t('org-unit:responsibilityRoles.UNIT_OPERATOR')),
      ),
    ).toBeInTheDocument();
    expect(
      within(refreshedSection).getByText(textPattern(i18n.t('org-unit:responsibilities.primary'))),
    ).toBeInTheDocument();
    expect(
      within(refreshedSection).getByText(
        textPattern(i18n.t('org-unit:responsibilities.descendantsIncluded')),
      ),
    ).toBeInTheDocument();
    expect(within(refreshedSection).queryByText('UNIT_OPERATOR')).not.toBeInTheDocument();
  });

  it('renders an empty responsibilities state with assign action when permitted', async () => {
    await setLocale(DEFAULT_LOCALE);
    server.use(
      http.get('*/admin/org-units/:orgUnitId/responsibilities', () =>
        HttpResponse.json({ data: [] }),
      ),
    );

    renderRoute('/org-units/ou-root');

    const heading = await screen.findByText(i18n.t('org-unit:responsibilities.title'));
    const section = heading.closest('section') ?? document.body;
    expect(
      within(section).getAllByText(i18n.t('org-unit:responsibilities.emptyTitle')).length,
    ).toBeGreaterThan(0);
    expect(
      within(section).getAllByText(i18n.t('org-unit:responsibilities.emptyMessage')).length,
    ).toBeGreaterThan(0);
    expect(
      within(section).getByRole('button', { name: i18n.t('org-unit:responsibilities.assign') }),
    ).toBeInTheDocument();
    expect(
      within(section).queryByRole('button', { name: i18n.t('org-unit:responsibilities.revoke') }),
    ).not.toBeInTheDocument();
  });

  it('renders read-only empty responsibilities without mutation controls', async () => {
    await setLocale(DEFAULT_LOCALE);
    server.use(
      http.get('*/admin/me/capabilities', () =>
        HttpResponse.json({
          data: {
            id: 'user-admin',
            type: 'admin',
            context: 'ADMIN',
            isActive: true,
            roles: ['role-admin'],
            permissions: ['orgUnit.read'],
            scopeGrants: {},
            generatedAt: '2026-05-20T00:00:00.000Z',
          },
        }),
      ),
      http.get('*/admin/org-units/:orgUnitId/responsibilities', () =>
        HttpResponse.json({ data: [] }),
      ),
    );

    renderRoute('/org-units/ou-root');

    const heading = await screen.findByText(i18n.t('org-unit:responsibilities.title'));
    const section = heading.closest('section') ?? document.body;
    expect(
      within(section).getAllByText(i18n.t('org-unit:responsibilities.emptyTitle')).length,
    ).toBeGreaterThan(0);
    expect(
      within(section).queryByRole('button', { name: i18n.t('org-unit:responsibilities.assign') }),
    ).not.toBeInTheDocument();
    expect(
      within(section).queryByRole('button', { name: i18n.t('common:actions.edit') }),
    ).not.toBeInTheDocument();
    expect(
      within(section).queryByRole('button', { name: i18n.t('org-unit:responsibilities.revoke') }),
    ).not.toBeInTheDocument();
  });

  it('shows Org Unit responsibilities read-only when update permission is missing', async () => {
    await setLocale(DEFAULT_LOCALE);
    server.use(
      http.get('*/admin/me/capabilities', () =>
        HttpResponse.json({
          data: {
            id: 'user-admin',
            type: 'admin',
            context: 'ADMIN',
            isActive: true,
            roles: ['role-admin'],
            permissions: ['orgUnit.read'],
            scopeGrants: {},
            generatedAt: '2026-05-20T00:00:00.000Z',
          },
        }),
      ),
    );

    renderRoute('/org-units/ou-root');

    const heading = await screen.findByText(i18n.t('org-unit:responsibilities.title'));
    const section = heading.closest('section') ?? document.body;
    expect(
      within(section).getByText(i18n.t('org-unit:responsibilityRoles.UNIT_MANAGER')),
    ).toBeInTheDocument();
    expect(
      within(section).queryByRole('button', { name: i18n.t('org-unit:responsibilities.assign') }),
    ).not.toBeInTheDocument();
    expect(
      within(section).queryByRole('button', { name: i18n.t('org-unit:responsibilities.revoke') }),
    ).not.toBeInTheDocument();
  });

  it('keeps read access while mutation permissions and local Org Unit status gate actions', async () => {
    await setLocale(DEFAULT_LOCALE);
    server.use(
      http.get('*/admin/me/capabilities', () =>
        HttpResponse.json({
          data: {
            id: 'user-admin',
            type: 'admin',
            context: 'ADMIN',
            isActive: true,
            roles: ['role-admin'],
            permissions: ['orgUnit.read', 'orgUnit.manageLifecycle'],
            scopeGrants: {},
            generatedAt: '2026-05-20T00:00:00.000Z',
          },
        }),
      ),
    );

    renderRoute('/org-units/ou-root');

    expect(await screen.findByText(i18n.t('org-unit:actionRail.title'))).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('org-unit:actions.edit') }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('org-unit:actions.move') }),
    ).not.toBeInTheDocument();

    const activate = screen.getByRole('button', { name: i18n.t('org-unit:actions.activate') });
    const deactivate = screen.getByRole('button', {
      name: i18n.t('org-unit:actions.deactivate'),
    });

    expect(activate).toBeDisabled();
    expect(activate).not.toHaveAccessibleDescription(
      i18n.t('common:capabilities.missingPermission'),
    );
    expect(deactivate).toBeEnabled();
    expect(deactivate).not.toHaveAccessibleDescription(
      i18n.t('common:capabilities.missingPermission'),
    );
  });

  it('fails closed before rendering Org Unit actions when capability fetch fails', async () => {
    await setLocale(DEFAULT_LOCALE);
    server.use(
      http.get('*/admin/me/capabilities', () =>
        HttpResponse.json({ message: 'errors:transport.generic' }, { status: 500 }),
      ),
    );

    renderRoute('/org-units/ou-root');

    expect(await screen.findByText('Không có quyền truy cập')).toBeInTheDocument();
    expect(
      screen.getByText('Backend đã từ chối quyền truy cập tài nguyên này.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('org-unit:actions.edit') }),
    ).not.toBeInTheDocument();
  });

  it('renders readable parent org unit refs on detail while links stay id-based', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/org-units/ou-sales');

    const parentLink = await screen.findByRole('link', { name: 'Head Office' });
    expect(parentLink).toHaveAttribute('href', '/org-units/ou-root');
    expect(parentLink).not.toHaveTextContent('ou-root');
  });

  it('submits selected parent org unit references from create and move surfaces', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const onMove = vi.fn();

    const createRender = renderAppWithProviders(
      <MemoryRouter>
        <OrgUnitCreateSurface onCancel={() => undefined} onSubmit={onCreate} />
      </MemoryRouter>,
    );
    expect(screen.queryByLabelText(i18n.t('org-unit:fields.code'))).toBeNull();
    expect(screen.getByText(i18n.t('org-unit:generatedCode.description'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('org-unit:help.displayOrder'))).toBeInTheDocument();
    await user.type(screen.getByLabelText(i18n.t('org-unit:fields.name')), 'Selector Unit');
    await user.selectOptions(screen.getByLabelText(i18n.t('org-unit:fields.type')), 'TEAM');
    await user.type(screen.getByLabelText(i18n.t('org-unit:fields.externalRef')), 'EXT-OU');
    await selectPickerOption(user, 'org-unit-parent', /OU-PARENT/);
    await user.click(
      screen.getByRole('button', { name: i18n.t('org-unit:mutations.create.submit') }),
    );
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        parentOrgUnitId: 'ou-parent',
        externalRef: 'EXT-OU',
      }),
    );
    expect(onCreate.mock.calls[0][0]).not.toHaveProperty('code');
    createRender.unmount();

    renderAppWithProviders(
      <MemoryRouter>
        <OrgUnitMoveSurface
          currentOrgUnitId="ou-current"
          currentParentOrgUnitId={null}
          onCancel={() => undefined}
          onSubmit={onMove}
        />
      </MemoryRouter>,
    );
    await selectPickerOption(user, 'org-unit-new-parent', /OU-NEW/);
    await user.click(
      screen.getByRole('button', { name: i18n.t('org-unit:mutations.move.submit') }),
    );
    expect(onMove).toHaveBeenCalledWith({
      newParentOrgUnitId: 'ou-new-parent',
    });
  });

  it('keeps the stored Org Unit sort priority value visible in edit payloads', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onEdit = vi.fn();

    renderAppWithProviders(
      <MemoryRouter>
        <OrgUnitEditSurface
          initialValues={{
            name: 'Editorial',
            displayOrder: 20,
          }}
          onCancel={() => undefined}
          onSubmit={onEdit}
        />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText(i18n.t('org-unit:fields.displayOrder'))).toHaveValue(20);
    expect(screen.getByText(i18n.t('org-unit:help.displayOrder'))).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: i18n.t('org-unit:mutations.edit.submit') }),
    );

    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        displayOrder: 20,
      }),
    );
  });

  it('resets Org Unit create state after host close and reopens in one click', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/org-units');

    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('org-unit:actions.create'),
      }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: i18n.t('org-unit:mutations.create.title'),
    });

    await user.click(within(dialog).getByRole('button', { name: i18n.t('common:actions.close') }));

    const createTrigger = await screen.findByRole('button', {
      name: i18n.t('org-unit:actions.create'),
    });
    expect(
      screen.queryByRole('dialog', {
        name: i18n.t('org-unit:mutations.create.title'),
      }),
    ).not.toBeInTheDocument();

    await user.click(createTrigger);

    expect(
      await screen.findByRole('dialog', {
        name: i18n.t('org-unit:mutations.create.title'),
      }),
    ).toBeInTheDocument();
  });

  it('supports create and lifecycle mutation flows from list/detail surfaces', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/org-units');

    await user.click(
      await screen.findByRole('button', {
        name: i18n.t('org-unit:actions.create'),
      }),
    );

    const createSurfaceHeading = await screen.findByRole('heading', {
      name: i18n.t('org-unit:mutations.create.title'),
    });
    const createSurface = createSurfaceHeading.closest('section');
    expect(createSurface).not.toBeNull();
    if (!createSurface) {
      return;
    }
    expect(createSurface).toHaveAttribute('data-mutation-presentation', 'drawer');

    const createSurfaceScope = within(createSurface);
    expect(createSurfaceScope.queryByLabelText(i18n.t('org-unit:fields.code'))).toBeNull();
    expect(
      createSurfaceScope.getByText(i18n.t('org-unit:generatedCode.description')),
    ).toBeInTheDocument();
    await user.type(
      createSurfaceScope.getByLabelText(i18n.t('org-unit:fields.name')),
      'Wave 3 Org',
    );
    await user.selectOptions(
      createSurfaceScope.getByLabelText(i18n.t('org-unit:fields.type')),
      'TEAM',
    );
    const displayOrderInput = createSurfaceScope.getByLabelText(
      i18n.t('org-unit:fields.displayOrder'),
    );
    await user.clear(displayOrderInput);
    await user.type(displayOrderInput, '17');
    await user.click(
      createSurfaceScope.getByRole('button', { name: i18n.t('org-unit:mutations.create.submit') }),
    );

    expect(await screen.findByText('OU-000101', {}, { timeout: 3000 })).toBeInTheDocument();

    const row = screen.getByText('OU-000101').closest('tr');
    expect(row).not.toBeNull();
    if (!row) {
      return;
    }

    await user.click(
      within(row).getByRole('button', { name: i18n.t('org-unit:actions.deactivate') }),
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );

    await waitFor(
      () => {
        const refreshedRow = screen.getByText('OU-000101').closest('tr');
        expect(refreshedRow).not.toBeNull();
        if (!refreshedRow) {
          return;
        }

        expect(
          within(refreshedRow).getByText(i18n.t('org-unit:statuses.INACTIVE')),
        ).toBeInTheDocument();
        expect(within(refreshedRow).queryByText('INACTIVE')).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('keeps Org Unit create and query controls inspectable when the list request fails', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    server.use(
      http.get('*/admin/org-units', () =>
        HttpResponse.json({ message: 'errors:transport.generic' }, { status: 500 }),
      ),
    );

    renderRoute('/org-units?status=INACTIVE&search=OU-000003');

    expect(await screen.findByText(i18n.t('org-unit:states.loadErrorTitle'))).toBeInTheDocument();
    expect(screen.getByPlaceholderText(i18n.t('org-unit:filters.searchPlaceholder'))).toHaveValue(
      'OU-000003',
    );
    expect(screen.getByRole('combobox', { name: i18n.t('org-unit:filters.status') })).toHaveValue(
      'INACTIVE',
    );

    await user.click(screen.getByRole('button', { name: i18n.t('org-unit:actions.create') }));

    expect(
      await screen.findByRole('heading', { name: i18n.t('org-unit:mutations.create.title') }),
    ).toBeInTheDocument();
  });
});
