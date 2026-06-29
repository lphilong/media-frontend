import i18n from 'i18next';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import {
  TalentGroupCreateSurface,
  TalentGroupEditSurface,
} from '@modules/talent-group/forms/talent-group-mutation-forms';
import { fetchResponsibilitySummary } from '@modules/responsibility/api/responsibility.api';
import { fetchTalentGroupsByTalent } from '@modules/talent-group/api/talent-group.api';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import {
  resetIdentityAccessMockData,
  setMockCurrentActorCapabilities,
} from '@test/msw/identity-access-handlers';
import { renderAppWithProviders } from '@test/render-app-route';

type RouteEntry = string | { pathname: string; search?: string; state?: unknown };

afterEach(() => {
  resetIdentityAccessMockData();
});

const renderRoute = (path: RouteEntry) => {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  renderAppWithProviders(<RouterProvider router={router} />);

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

describe('talent-group wave 4 surfaces', () => {
  it('does not grant TalentGroup list access from management responsibility alone', async () => {
    await setLocale(DEFAULT_LOCALE);
    setMockCurrentActorCapabilities({
      id: 'user-team-manager',
      type: 'admin',
      context: 'ADMIN',
      isActive: true,
      roles: ['TEAM_MANAGER'],
      permissions: ['talent.read', 'talentGroup.read'],
      scopeGrants: {
        workSchedule: ['self', 'team'],
        kpi: ['managedGroup'],
      },
      generatedAt: '2026-05-20T00:00:00.000Z',
    });

    renderRoute('/talent-groups');

    expect(
      await screen.findByRole('heading', { name: i18n.t('talent-group:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(screen.queryByText('TG-000001')).not.toBeInTheDocument();
  });

  it('renders an error state for TEAM_MANAGER unmanaged TalentGroup detail', async () => {
    await setLocale(DEFAULT_LOCALE);
    setMockCurrentActorCapabilities({
      id: 'user-team-manager',
      type: 'admin',
      context: 'ADMIN',
      isActive: true,
      roles: ['TEAM_MANAGER'],
      permissions: ['talent.read', 'talentGroup.read'],
      scopeGrants: {
        workSchedule: ['self', 'team'],
        kpi: ['managedGroup'],
      },
      generatedAt: '2026-05-20T00:00:00.000Z',
    });

    renderRoute('/talent-groups/group-002');

    expect(
      await screen.findByText(i18n.t('errors:permission.title'), {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('talent-group:actionRail.title'))).not.toBeInTheDocument();
  });

  it('renders filtered flat-list rows for query-driven Talent Group routes', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/talent-groups?status=INACTIVE&search=B%20Team');

    expect(
      await screen.findByRole('heading', { name: i18n.t('talent-group:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('TG-000002', {}, { timeout: 3000 })).toBeInTheDocument();
    expect((await screen.findAllByText('B Team', {}, { timeout: 3000 })).length).toBeGreaterThan(0);
    expect(screen.getByText(i18n.t('talent-group:sort.displayOrder'))).toBeInTheDocument();
    expect(screen.queryByText('displayOrder')).not.toBeInTheDocument();
    expect(screen.queryByText(/sortPriority\(/i)).not.toBeInTheDocument();
  });

  it('opens Talent Group create in a drawer without replacing the list', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/talent-groups');

    await user.click(
      await screen.findByRole('button', { name: i18n.t('talent-group:actions.create') }),
    );
    const heading = await screen.findByRole('heading', {
      name: i18n.t('talent-group:mutations.create.title'),
    });
    const surface = heading.closest('section');
    expect(surface).toHaveAttribute('data-mutation-presentation', 'drawer');
    expect(screen.getByText('TG-000001')).toBeInTheDocument();

    await user.click(within(surface as HTMLElement).getByRole('button', { name: /hủy|cancel/i }));
    expect(
      screen.queryByRole('heading', { name: i18n.t('talent-group:mutations.create.title') }),
    ).not.toBeInTheDocument();
  });

  it('resets Talent Group create state after host close and reopens in one click', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/talent-groups');

    await user.click(
      await screen.findByRole('button', { name: i18n.t('talent-group:actions.create') }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: i18n.t('talent-group:mutations.create.title'),
    });

    await user.click(within(dialog).getByRole('button', { name: i18n.t('common:actions.close') }));

    const createTrigger = await screen.findByRole('button', {
      name: i18n.t('talent-group:actions.create'),
    });
    expect(
      screen.queryByRole('dialog', {
        name: i18n.t('talent-group:mutations.create.title'),
      }),
    ).not.toBeInTheDocument();

    await user.click(createTrigger);

    expect(
      await screen.findByRole('dialog', {
        name: i18n.t('talent-group:mutations.create.title'),
      }),
    ).toBeInTheDocument();
  });

  it('uses a talent selector for the contains-talent relationship filter', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const router = renderRoute('/talent-groups?status=ACTIVE&containsTalentId=talent-001');

    expect(
      await screen.findByRole('heading', { name: i18n.t('talent-group:page.title') }),
    ).toBeInTheDocument();
    expect(
      await screen.findByPlaceholderText(i18n.t('talent-group:filters.searchPlaceholder')),
    ).toBeTruthy();
    expect(
      screen.queryByPlaceholderText(i18n.t('talent-group:filters.containsTalentIdPlaceholder')),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole('combobox', { name: i18n.t('talent-group:filters.status') }),
    ).toHaveValue('ACTIVE');
    expect(await screen.findByText(i18n.t('common:filters.appliedFilters'))).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'talent-group:filters.containsTalentId',
        )}`,
      }),
    ).toBeInTheDocument();

    await openMoreFilters(user);

    const picker = await findPicker('talent-group-filter-contains-talent');
    expect(await within(picker).findAllByText(/TAL-000001/)).not.toHaveLength(0);

    await user.click(await within(picker).findByRole('button', { name: /TAL-000001/ }));
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('containsTalentId')).toBe(
        'talent-001',
      );
      expect(new URLSearchParams(router.state.location.search).get('containsTalentId')).not.toBe(
        'TAL-000001',
      );
    });

    await user.click(
      screen.getByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'talent-group:filters.containsTalentId',
        )}`,
      }),
    );
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('containsTalentId')).toBeNull();
    });

    await user.click(await within(picker).findByRole('button', { name: /TAL-000001/ }));
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('containsTalentId')).toBe(
        'talent-001',
      );
    });

    const field = picker.closest('fieldset');
    expect(field).not.toBeNull();
    if (!field) {
      return;
    }

    await user.click(within(field).getByRole('button', { name: i18n.t('common:actions.clear') }));
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('containsTalentId')).toBeNull();
    });

    await user.click(await within(picker).findByRole('button', { name: /TAL-000001/ }));
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('containsTalentId')).toBe(
        'talent-001',
      );
    });

    await user.click(screen.getByRole('button', { name: i18n.t('common:filters.clearAll') }));
    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get('status')).toBeNull();
      expect(params.get('containsTalentId')).toBeNull();
    });
  });

  it('renders by-talent related mode and excludes removed memberships', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/talent-groups?view=by-talent&talentId=talent-003');

    expect(
      await screen.findByText(i18n.t('talent-group:related.byTalentModeLabel')),
    ).toBeInTheDocument();
    expect(await screen.findByText('Chau')).toBeInTheDocument();
    expect(screen.queryByText('talent-003')).not.toBeInTheDocument();
    expect(await screen.findByText('TG-000002')).toBeInTheDocument();
    expect(screen.queryByText('TG-000001')).not.toBeInTheDocument();
  });

  it('shortens missing related talent labels while keeping the URL id-only', async () => {
    await setLocale(DEFAULT_LOCALE);
    const talentId = '018f9f2b-4d6f-75f1-ae2a-780d515d5d2a';
    const router = renderRoute(`/talent-groups?view=by-talent&talentId=${talentId}`);

    expect(
      await screen.findByText(i18n.t('talent-group:related.byTalentModeLabel')),
    ).toBeInTheDocument();
    expect(screen.getByText('018f9f2b...5d2a')).toBeInTheDocument();
    expect(screen.queryByText(talentId)).not.toBeInTheDocument();
    expect(new URLSearchParams(router.state.location.search).get('talentId')).toBe(talentId);
  });

  it('parses by-talent related rows with backend groupId while opening by internal id', async () => {
    const response = await fetchTalentGroupsByTalent({ talentId: 'talent-003', limit: 10 });
    const item = response.data[0];

    expect(item).toMatchObject({
      id: 'group-002',
      groupId: 'group-002',
      groupCode: 'TG-000002',
      membershipId: 'membership-003',
      talentId: 'talent-003',
    });
    expect(item?.groupId).toBe(item?.id);
    expect(item?.id).not.toBe(item?.groupCode);
  });

  it('parses central responsibility summaries with strict safe fields', async () => {
    const summary = await fetchResponsibilitySummary('TALENT_GROUP', 'group-001');
    expect(summary.items[0]).toMatchObject({
      subjectType: 'TALENT_GROUP',
      subjectId: 'group-001',
      responsibleEmploymentProfileId: 'ep-001',
      responsibilityType: 'TALENT_GROUP_MANAGER',
    });
    expect(summary.items[0]).not.toHaveProperty('authSubject');
    expect(summary.items[0]).not.toHaveProperty('managerEmploymentProfileId');
  });

  it('renders detail roster/links and status gating for group lifecycle', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/talent-groups/group-001');

    expect(await screen.findByText(i18n.t('talent-group:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('talent-group:fields.displayOrder'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('talent-group:help.displayOrder'))).toBeInTheDocument();
    expect(screen.queryByText('Stale Internal Legal')).not.toBeInTheDocument();
    expect(screen.queryByText('Stale Internal Short')).not.toBeInTheDocument();
    expect(screen.queryByText('talent-003')).not.toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: i18n.t('talent-group:actions.activate') }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('talent-group:actions.deactivate') }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: i18n.t('talent-group:actions.archive') }),
    ).toBeDisabled();

    const relatedLinks = screen.getAllByRole('link', {
      name: i18n.t('talent-group:related.openFilteredList'),
    });
    expect(relatedLinks.length).toBeGreaterThanOrEqual(3);
  });

  it('renders central responsibilities from the detail page without local manager actions', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/talent-groups/group-001');

    expect(await screen.findByText(i18n.t('talent-group:managers.title'))).toBeInTheDocument();
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('managerEmploymentProfileId')).not.toBeInTheDocument();
    expect(
      screen
        .getAllByRole('link', { name: i18n.t('responsibility:summary.openCentral') })
        .some(
          (link) =>
            link.getAttribute('href') ===
            '/responsibilities?subjectType=TALENT_GROUP&subjectId=group-001',
        ),
    ).toBe(true);
  });

  it('keeps Talent Group sort priority visible in create/edit surfaces without changing values', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const onEdit = vi.fn();

    const createRender = renderAppWithProviders(
      <TalentGroupCreateSurface onCancel={() => undefined} onSubmit={onCreate} />,
    );

    expect(screen.getByLabelText(i18n.t('talent-group:fields.displayOrder'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('talent-group:help.displayOrder'))).toBeInTheDocument();
    createRender.unmount();

    renderAppWithProviders(
      <TalentGroupEditSurface
        initialValues={{
          name: 'A Team',
          displayOrder: 30,
        }}
        onCancel={() => undefined}
        onSubmit={onEdit}
      />,
    );

    expect(screen.getByLabelText(i18n.t('talent-group:fields.displayOrder'))).toHaveValue(30);
    expect(screen.getByText(i18n.t('talent-group:help.displayOrder'))).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: i18n.t('talent-group:mutations.edit.submit') }),
    );

    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        displayOrder: 30,
      }),
    );
  });

  it('supports membership actions and detail-first mutation surfaces', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/talent-groups/group-001');

    expect(await screen.findByText(i18n.t('talent-group:actionRail.title'))).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: i18n.t('talent-group:actions.addMember') }),
    );
    expect(
      await screen.findByRole('heading', {
        name: i18n.t('talent-group:mutations.addMember.title'),
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: i18n.t('common:actions.cancel') }));

    const activeMemberRow = screen.getByText('Bao').closest('tr');
    expect(activeMemberRow).not.toBeNull();
    if (!activeMemberRow) {
      return;
    }

    await user.click(
      within(activeMemberRow).getByRole('button', {
        name: i18n.t('talent-group:actions.deactivateMember'),
      }),
    );
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );

    await waitFor(
      () => {
        const refreshedRow = screen.getByText('Bao').closest('tr');
        expect(refreshedRow).not.toBeNull();
        if (!refreshedRow) {
          return;
        }
        expect(
          within(refreshedRow).getByText(i18n.t('talent-group:membershipStatuses.INACTIVE')),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  }, 15_000);
});
