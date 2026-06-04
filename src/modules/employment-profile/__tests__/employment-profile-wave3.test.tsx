import i18n from 'i18next';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import {
  EmploymentProfileCreateSurface,
  EmploymentProfileEditSurface,
  EmploymentProfileManagerAssignmentSurface,
  EmploymentProfileOrgAssignmentSurface,
  EmploymentProfileUserLinkSurface,
} from '@modules/employment-profile/forms/employment-profile-mutation-forms';
import { loadUnlinkedUserReferenceOptions } from '@shared/components/reference/admin-reference-options';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
import {
  getMockCurrentActorCapabilities,
  setMockCurrentActorCapabilities,
} from '@test/msw/identity-access-handlers';
import { renderAppWithProviders } from '@test/render-app-route';

vi.mock('@shared/components/reference/admin-reference-options', () => ({
  loadOrgUnitReferenceOptions: vi.fn(async () => [
    {
      id: 'ou-sales',
      label: 'Sales - OU-SALES',
      description: 'ACTIVE',
      href: '/org-units/ou-sales',
    },
  ]),
  loadEmploymentProfileReferenceOptions: vi.fn(async () => [
    {
      id: 'ep-manager',
      label: 'Manager Display - EMPMGR',
      description: 'ACTIVE',
      href: '/employment-profiles/ep-manager',
    },
  ]),
  loadUserReferenceOptions: vi.fn(async () => [
    {
      id: 'user-admin',
      label: 'Admin User - admin@example.com',
      description: 'ACTIVE',
      href: '/users/user-admin',
    },
  ]),
  loadUnlinkedUserReferenceOptions: vi.fn(async () => [
    {
      id: 'user-admin',
      label: 'Admin User - admin@example.com',
      description: 'ACTIVE',
      href: '/users/user-admin',
    },
  ]),
}));

const renderRoute = (path: string) => {
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

const selectPickerOption = async (
  user: ReturnType<typeof userEvent.setup>,
  pickerId: string,
  optionText: RegExp,
): Promise<void> => {
  const picker = await findPicker(pickerId);
  await user.click(await within(picker).findByText(optionText));
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

describe('employment profile wave 3 surfaces', () => {
  it('renders filtered list rows for query-driven Employment Profile routes', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/employment-profiles?employmentStatus=ON_LEAVE&search=Bao&hasLinkedUser=false');

    expect(
      await screen.findByRole('heading', { name: i18n.t('employment-profile:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('EP-000002', {}, { timeout: 3000 })).toBeInTheDocument();
    expect((await screen.findAllByText('Bao', {}, { timeout: 3000 })).length).toBeGreaterThan(0);
    expect(await screen.findByText('Sales')).toBeInTheDocument();
    expect(await screen.findByText('Alice')).toBeInTheDocument();
  });

  it('uses readable org unit and manager selectors for relationship filters', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const router = renderRoute(
      '/employment-profiles?employmentStatus=ACTIVE&orgUnitId=ou-sales&managerEmploymentProfileId=ep-manager',
    );

    expect(
      await screen.findByRole('heading', { name: i18n.t('employment-profile:page.title') }),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(i18n.t('employment-profile:filters.orgUnitIdPlaceholder')),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(
        i18n.t('employment-profile:filters.managerEmploymentProfileIdPlaceholder'),
      ),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole('combobox', {
        name: i18n.t('employment-profile:filters.employmentStatus'),
      }),
    ).toHaveValue('ACTIVE');
    expect(
      screen.getByPlaceholderText(i18n.t('employment-profile:filters.searchPlaceholder')),
    ).toBeTruthy();
    expect(screen.getByText(i18n.t('common:filters.appliedFilters'))).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'employment-profile:filters.orgUnitId',
        )}`,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'employment-profile:filters.managerEmploymentProfileId',
        )}`,
      }),
    ).toBeInTheDocument();

    await openMoreFilters(user);

    const orgUnitPicker = await findPicker('employment-profile-filter-org-unit');
    const managerPicker = await findPicker('employment-profile-filter-manager');
    expect(await within(orgUnitPicker).findAllByText(/OU-SALES/)).not.toHaveLength(0);
    expect(await within(managerPicker).findAllByText(/Manager Display/)).not.toHaveLength(0);

    await user.click(await within(orgUnitPicker).findByRole('button', { name: /OU-SALES/ }));
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('orgUnitId')).toBe('ou-sales');
      expect(new URLSearchParams(router.state.location.search).get('orgUnitId')).not.toBe(
        'OU-SALES',
      );
    });

    await user.click(
      screen.getByRole('button', {
        name: `${i18n.t('common:filters.clearFilter')}: ${i18n.t(
          'employment-profile:filters.orgUnitId',
        )}`,
      }),
    );
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('orgUnitId')).toBeNull();
    });

    await user.click(await within(orgUnitPicker).findByRole('button', { name: /OU-SALES/ }));
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('orgUnitId')).toBe('ou-sales');
    });

    const managerField = managerPicker.closest('fieldset');
    expect(managerField).not.toBeNull();
    if (!managerField) {
      return;
    }

    await user.click(
      within(managerField).getByRole('button', { name: i18n.t('common:actions.clear') }),
    );
    await waitFor(() => {
      expect(
        new URLSearchParams(router.state.location.search).get('managerEmploymentProfileId'),
      ).toBeNull();
    });

    await user.click(await within(managerPicker).findByRole('button', { name: /Manager Display/ }));
    await waitFor(() => {
      expect(
        new URLSearchParams(router.state.location.search).get('managerEmploymentProfileId'),
      ).toBe('ep-manager');
    });

    await user.click(screen.getByRole('button', { name: i18n.t('common:filters.clearAll') }));
    await waitFor(() => {
      const params = new URLSearchParams(router.state.location.search);
      expect(params.get('employmentStatus')).toBeNull();
      expect(params.get('orgUnitId')).toBeNull();
      expect(params.get('managerEmploymentProfileId')).toBeNull();
    });
  });

  it('renders detail direct-reports and lifecycle gating', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/employment-profiles/ep-001');

    expect(
      await screen.findByRole('heading', {
        name: i18n.t('employment-profile:detail.hubTitle'),
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(i18n.t('employment-profile:actionRail.title'))).toBeInTheDocument();
    expect(screen.getByText('Alice - EP-000001')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('employment-profile:detail.overviewTitle'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('employment-profile:detail.accountTitle'))).toBeInTheDocument();
    const peopleHubHeading = screen.getByRole('heading', {
      name: i18n.t('employment-profile:related.peopleHubNavigationTitle'),
    });
    expect(peopleHubHeading).toBeInTheDocument();
    const peopleHubSection = peopleHubHeading.closest('section');
    expect(peopleHubSection).not.toBeNull();
    if (!peopleHubSection) {
      return;
    }
    const peopleHub = within(peopleHubSection);
    expect(
      screen.getByText(i18n.t('employment-profile:related.reportingTitle')),
    ).toBeInTheDocument();
    expect(screen.getAllByText('01-01-2024').length).toBeGreaterThan(0);
    expect(
      screen.getByText(i18n.t('employment-profile:detail.hrAttributionTitle')),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('link', { name: 'Bao' })
        .some((link) => link.getAttribute('href') === '/employment-profiles/ep-002'),
    ).toBe(true);
    expect(screen.getByRole('link', { name: 'Chau' })).toHaveAttribute(
      'href',
      '/employment-profiles/ep-003',
    );
    expect(screen.getAllByText('08-01-2024').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(i18n.t('employment-profile:detail.notAssigned')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Alice User' })).toHaveAttribute(
      'href',
      '/users/user-alice',
    );
    expect(screen.getByRole('link', { name: 'Sales' })).toHaveAttribute(
      'href',
      '/org-units/ou-sales',
    );
    expect(await screen.findByText('EP-000002')).toBeInTheDocument();
    expect(screen.getByText('EP-000003')).toBeInTheDocument();
    expect(
      peopleHub.getByText(i18n.t('employment-profile:related.internalTalent')),
    ).toBeInTheDocument();
    expect(
      peopleHub.getByText(i18n.t('employment-profile:related.talentGroups')),
    ).toBeInTheDocument();
    expect(peopleHub.getByText(i18n.t('employment-profile:related.kpi'))).toBeInTheDocument();
    expect(
      peopleHub
        .getAllByRole('link', { name: i18n.t('employment-profile:related.openFilteredList') })
        .some(
          (link) =>
            link.getAttribute('href') ===
            '/kpi?subjectType=EMPLOYMENT_PROFILE&subjectId=ep-001&status=PUBLISHED',
        ),
    ).toBe(true);
    expect(
      screen.getAllByText(i18n.t('employment-profile:related.noLinkedRecord')).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/setupUrl/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ticketUrl/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/resetUrl/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/temporaryPassword/i)).not.toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: i18n.t('employment-profile:actions.place-on-leave') }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: i18n.t('employment-profile:actions.return-from-leave') }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('employment-profile:actions.reactivate') }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: i18n.t('employment-profile:actions.archive') }),
    ).toBeDisabled();
  });

  it('supports assignment, link/unlink, contract-status, and terminate surfaces', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    renderRoute('/employment-profiles/ep-001');

    expect(
      await screen.findByText(i18n.t('employment-profile:actionRail.title')),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: i18n.t('employment-profile:actions.assignOrgUnit') }),
    );
    expect(
      await screen.findByRole('heading', {
        name: i18n.t('employment-profile:mutations.assignOrgUnit.title'),
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: i18n.t('common:actions.cancel') }));

    await user.click(
      screen.getByRole('button', { name: i18n.t('employment-profile:actions.assignManager') }),
    );
    expect(
      await screen.findByRole('heading', {
        name: i18n.t('employment-profile:mutations.assignManager.title'),
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: i18n.t('common:actions.cancel') }));

    const unlinkUserButton = screen.getByRole('button', {
      name: i18n.t('employment-profile:actions.unlinkUser'),
    });
    expect(unlinkUserButton).toBeEnabled();
    await user.click(unlinkUserButton);
    await user.click(
      screen.getByRole('button', { name: i18n.t('common:actions.confirmDestructive') }),
    );

    await waitFor(
      () => {
        expect(
          screen.getByRole('button', { name: i18n.t('employment-profile:actions.linkUser') }),
        ).toBeEnabled();
      },
      { timeout: 3000 },
    );

    await user.click(
      screen.getByRole('button', { name: i18n.t('employment-profile:actions.linkUser') }),
    );
    await selectPickerOption(user, 'employment-profile-link-user', /Admin/);
    await user.click(
      screen.getByRole('button', { name: i18n.t('employment-profile:mutations.linkUser.submit') }),
    );

    await waitFor(
      () => {
        expect(
          screen.getByRole('button', { name: i18n.t('employment-profile:actions.unlinkUser') }),
        ).toBeEnabled();
      },
      { timeout: 3000 },
    );

    await user.click(
      screen.getByRole('button', {
        name: i18n.t('employment-profile:actions.updateContractStatus'),
      }),
    );
    await user.selectOptions(
      screen.getByLabelText(i18n.t('employment-profile:fields.newContractStatus')),
      'EXPIRED',
    );
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('employment-profile:mutations.contractStatus.submit'),
      }),
    );

    expect(
      await screen.findByText(
        i18n.t('employment-profile:feedback.contractStatusUpdated'),
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: i18n.t('employment-profile:actions.terminate') }),
    );
    const terminateSurfaceHeading = await screen.findByRole('heading', {
      name: i18n.t('employment-profile:mutations.terminate.title'),
    });
    const terminateSurface = terminateSurfaceHeading.closest('section');
    expect(terminateSurface).not.toBeNull();
    if (!terminateSurface) {
      return;
    }

    const terminateSurfaceScope = within(terminateSurface);
    await user.type(
      terminateSurfaceScope.getByLabelText(i18n.t('employment-profile:fields.employmentEndDate')),
      '2026-04-22',
    );
    await user.click(
      terminateSurfaceScope.getByRole('button', {
        name: i18n.t('employment-profile:mutations.terminate.submit'),
      }),
    );

    await waitFor(
      () => {
        expect(
          screen.getAllByText(i18n.t('employment-profile:statuses.TERMINATED')).length,
        ).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
  }, 15_000);

  it('submits selected org unit, manager, and linked-user references from form surfaces', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const onOrgAssign = vi.fn();
    const onManagerAssign = vi.fn();
    const onUserLink = vi.fn();

    const createRender = renderAppWithProviders(
      <MemoryRouter>
        <EmploymentProfileCreateSurface onCancel={() => undefined} onSubmit={onCreate} />
      </MemoryRouter>,
    );
    expect(screen.queryByLabelText(i18n.t('employment-profile:fields.employeeCode'))).toBeNull();
    expect(
      screen.getByText(i18n.t('employment-profile:generatedCode.description')),
    ).toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText(i18n.t('employment-profile:fields.employmentKind')),
      'EMPLOYEE',
    );
    await user.type(
      screen.getByLabelText(i18n.t('employment-profile:fields.legalName')),
      'Selector Person',
    );
    await user.type(
      screen.getByLabelText(i18n.t('employment-profile:fields.displayName')),
      'Selector Person',
    );
    await user.type(
      screen.getByLabelText(i18n.t('employment-profile:fields.jobTitle')),
      'Operator',
    );
    await user.type(
      screen.getByLabelText(i18n.t('employment-profile:fields.externalRef')),
      'EXT-EMP',
    );
    await selectPickerOption(user, 'employment-profile-org-unit', /OU-SALES/);
    await user.type(
      screen.getByLabelText(i18n.t('employment-profile:fields.employmentStartDate')),
      '2026-05-12',
    );
    await selectPickerOption(user, 'employment-profile-manager', /Manager Display/);
    await selectPickerOption(user, 'employment-profile-recruiter', /Manager Display/);
    await selectPickerOption(user, 'employment-profile-hr-owner', /Manager Display/);
    await selectPickerOption(user, 'employment-profile-onboarding-owner', /Manager Display/);
    await user.type(
      screen.getByLabelText(i18n.t('employment-profile:fields.hiredAt')),
      '2026-05-13',
    );
    await user.type(
      screen.getByLabelText(i18n.t('employment-profile:fields.onboardedAt')),
      '2026-05-14',
    );
    await selectPickerOption(user, 'employment-profile-linked-user', /Admin User/);
    expect(loadUnlinkedUserReferenceOptions).toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('employment-profile:mutations.create.submit'),
      }),
    );
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        employmentKind: 'EMPLOYEE',
        orgUnitId: 'ou-sales',
        managerEmploymentProfileId: 'ep-manager',
        linkedUserId: 'user-admin',
        recruiterEmploymentProfileId: 'ep-manager',
        hrOwnerEmploymentProfileId: 'ep-manager',
        onboardingOwnerEmploymentProfileId: 'ep-manager',
        sourcedByEmploymentProfileId: null,
        hiredAt: '2026-05-13',
        onboardedAt: '2026-05-14',
        externalRef: 'EXT-EMP',
      }),
    );
    expect(onCreate.mock.calls[0][0]).not.toHaveProperty('employeeCode');
    createRender.unmount();

    const orgAssignRender = renderAppWithProviders(
      <MemoryRouter>
        <EmploymentProfileOrgAssignmentSurface
          initialOrgUnitId=""
          onCancel={() => undefined}
          onSubmit={onOrgAssign}
        />
      </MemoryRouter>,
    );
    await selectPickerOption(user, 'employment-profile-new-org-unit', /OU-SALES/);
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('employment-profile:mutations.assignOrgUnit.submit'),
      }),
    );
    expect(onOrgAssign).toHaveBeenCalledWith({ newOrgUnitId: 'ou-sales' });
    orgAssignRender.unmount();

    const managerRender = renderAppWithProviders(
      <MemoryRouter>
        <EmploymentProfileManagerAssignmentSurface
          currentEmploymentProfileId="ep-current"
          currentManagerEmploymentProfileId={null}
          onCancel={() => undefined}
          onSubmit={onManagerAssign}
        />
      </MemoryRouter>,
    );
    await selectPickerOption(user, 'employment-profile-new-manager', /Manager Display/);
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('employment-profile:mutations.assignManager.submit'),
      }),
    );
    expect(onManagerAssign).toHaveBeenCalledWith({
      newManagerEmploymentProfileId: 'ep-manager',
    });
    managerRender.unmount();

    renderAppWithProviders(
      <MemoryRouter>
        <EmploymentProfileUserLinkSurface onCancel={() => undefined} onSubmit={onUserLink} />
      </MemoryRouter>,
    );
    await selectPickerOption(user, 'employment-profile-link-user', /Admin User/);
    expect(loadUnlinkedUserReferenceOptions).toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('employment-profile:mutations.linkUser.submit'),
      }),
    );
    expect(onUserLink).toHaveBeenCalledWith({ linkedUserId: 'user-admin' });
  }, 20_000);

  it('submits HR attribution from the edit surface and validates date order', async () => {
    await setLocale(DEFAULT_LOCALE);
    const user = userEvent.setup();
    const onEdit = vi.fn();

    const editRender = renderAppWithProviders(
      <MemoryRouter>
        <EmploymentProfileEditSurface
          initialValues={{
            legalName: 'Edit Legal',
            displayName: 'Edit Display',
            employmentKind: 'EMPLOYEE',
            jobTitle: 'Producer',
            recruiterEmploymentProfileId: null,
            hrOwnerEmploymentProfileId: null,
            onboardingOwnerEmploymentProfileId: null,
            sourcedByEmploymentProfileId: null,
            hiredAt: null,
            onboardedAt: null,
            externalRef: null,
            titleDescription: null,
          }}
          onCancel={() => undefined}
          onSubmit={onEdit}
        />
      </MemoryRouter>,
    );

    await selectPickerOption(user, 'employment-profile-edit-recruiter', /Manager Display/);
    await selectPickerOption(user, 'employment-profile-edit-hr-owner', /Manager Display/);
    await selectPickerOption(user, 'employment-profile-edit-onboarding-owner', /Manager Display/);
    await user.type(
      screen.getByLabelText(i18n.t('employment-profile:fields.hiredAt')),
      '2026-05-20',
    );
    await user.type(
      screen.getByLabelText(i18n.t('employment-profile:fields.onboardedAt')),
      '2026-05-19',
    );
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('employment-profile:mutations.edit.submit'),
      }),
    );

    expect(
      await screen.findByText(i18n.t('employment-profile:validation.onboardedBeforeHired')),
    ).toBeInTheDocument();
    expect(onEdit).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(i18n.t('employment-profile:fields.onboardedAt')));
    await user.type(
      screen.getByLabelText(i18n.t('employment-profile:fields.onboardedAt')),
      '2026-05-21',
    );
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('employment-profile:mutations.edit.submit'),
      }),
    );

    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        recruiterEmploymentProfileId: 'ep-manager',
        hrOwnerEmploymentProfileId: 'ep-manager',
        onboardingOwnerEmploymentProfileId: 'ep-manager',
        sourcedByEmploymentProfileId: null,
        hiredAt: '2026-05-20',
        onboardedAt: '2026-05-21',
      }),
    );
    expect(onEdit.mock.calls[0][0]).not.toHaveProperty('recruiterUserId');
    expect(onEdit.mock.calls[0][0]).not.toHaveProperty('recruiterTalentId');
    editRender.unmount();
  }, 20_000);

  it('hides attribution mutation affordance when update permission is missing', async () => {
    await setLocale(DEFAULT_LOCALE);
    const restricted = getMockCurrentActorCapabilities();
    setMockCurrentActorCapabilities({
      ...restricted,
      roles: ['role-viewer-auditor'],
      permissions: ['employmentProfile.read'],
      scopeGrants: {},
    });

    renderRoute('/employment-profiles/ep-001');

    expect(
      await screen.findByText(i18n.t('employment-profile:actionRail.title')),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('employment-profile:actions.edit') }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('employment-profile:actions.linkUser') }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('employment-profile:actions.terminate') }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('employment-profile:detail.hrAttributionTitle')),
    ).toBeInTheDocument();
  });

  it('denies self-service-only and team-manager actors from the People Hub route', async () => {
    await setLocale(DEFAULT_LOCALE);
    const base = getMockCurrentActorCapabilities();

    setMockCurrentActorCapabilities({
      ...base,
      id: 'user-staff',
      roles: ['role-talent-staff-self'],
      permissions: [
        'employmentProfile.read',
        'talent.read',
        'workSchedule.read',
        'event.read',
        'talentKpi.read',
        'kpi.readProgress',
      ],
      scopeGrants: {
        workSchedule: ['self'],
        kpi: ['self'],
      },
    });
    renderRoute('/employment-profiles/ep-001');
    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('employment-profile:detail.hubTitle')),
    ).not.toBeInTheDocument();

    cleanup();
    setMockCurrentActorCapabilities({
      ...base,
      roles: ['role-team-manager'],
      permissions: [
        'workSchedule.read',
        'event.read',
        'talent.read',
        'talentGroup.read',
        'kpi.read',
      ],
      scopeGrants: {
        workSchedule: ['self', 'team'],
        eventAssignment: ['managedGroup'],
        kpi: ['managedGroup'],
      },
    });
    renderRoute('/employment-profiles/ep-001');
    expect(await screen.findByText(i18n.t('errors:permission.title'))).toBeInTheDocument();
  });

  it('keeps contract-status action fail-closed when no transition is supported', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/employment-profiles/ep-004');

    expect(
      await screen.findByText(i18n.t('employment-profile:actionRail.title')),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: i18n.t('employment-profile:actions.updateContractStatus'),
      }),
    ).toBeDisabled();
  });
});
