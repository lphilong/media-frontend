import i18n from 'i18next';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom';

import { appRoutes } from '@app/router/router';
import {
  EmploymentProfileCreateSurface,
  EmploymentProfileManagerAssignmentSurface,
  EmploymentProfileOrgAssignmentSurface,
  EmploymentProfileUserLinkSurface,
} from '@modules/employment-profile/forms/employment-profile-mutation-forms';
import { DEFAULT_LOCALE, setLocale } from '@shared/i18n/i18n';
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
      label: 'Manager One - EMPMGR',
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
}));

const renderRoute = (path: string) => {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: [path],
  });

  renderAppWithProviders(<RouterProvider router={router} />);
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

describe('employment profile wave 3 surfaces', () => {
  it('renders filtered list rows for query-driven Employment Profile routes', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/employment-profiles?employmentStatus=ON_LEAVE&search=Bao&hasLinkedUser=false');

    expect(
      await screen.findByRole('heading', { name: i18n.t('employment-profile:page.title') }),
    ).toBeInTheDocument();
    expect(await screen.findByText('EP-000002', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByText('Bao', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('renders detail direct-reports and lifecycle gating', async () => {
    await setLocale(DEFAULT_LOCALE);
    renderRoute('/employment-profiles/ep-001');

    expect(
      await screen.findByText(i18n.t('employment-profile:actionRail.title')),
    ).toBeInTheDocument();
    expect(await screen.findByText('EP-000002')).toBeInTheDocument();
    expect(screen.getByText('EP-000003')).toBeInTheDocument();

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
    await user.type(
      screen.getByLabelText(i18n.t('employment-profile:fields.employmentKind')),
      'FULL_TIME',
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
    await selectPickerOption(user, 'employment-profile-manager', /EMPMGR/);
    await selectPickerOption(user, 'employment-profile-linked-user', /Admin User/);
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('employment-profile:mutations.create.submit'),
      }),
    );
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        orgUnitId: 'ou-sales',
        managerEmploymentProfileId: 'ep-manager',
        linkedUserId: 'user-admin',
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
    await selectPickerOption(user, 'employment-profile-new-manager', /EMPMGR/);
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
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('employment-profile:mutations.linkUser.submit'),
      }),
    );
    expect(onUserLink).toHaveBeenCalledWith({ linkedUserId: 'user-admin' });
  }, 20_000);

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
