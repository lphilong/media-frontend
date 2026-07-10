import i18n from 'i18next';
import { screen, waitFor, within } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';

import { PERMISSIONS } from '@shared/auth/current-actor-capabilities';
import { createActorCapabilities } from '@test/factories/access';
import { renderRouteWithAccess } from '@test/render-app-route';

export const roleAdminCapabilities = createActorCapabilities({
  accountContexts: ['ADMIN_CONSOLE'],
  permissions: [
    PERMISSIONS.ROLE_LIST,
    PERMISSIONS.ROLE_VIEW,
    PERMISSIONS.ROLE_CREATE,
    PERMISSIONS.ROLE_UPDATE,
    PERMISSIONS.ROLE_ACTIVATE,
    PERMISSIONS.ROLE_DEACTIVATE,
    PERMISSIONS.ROLE_ARCHIVE,
    PERMISSIONS.ROLE_ASSIGN_TO_USER,
    PERMISSIONS.ROLE_REVOKE_FROM_USER,
    PERMISSIONS.TALENT_GROUP_UPDATE,
    PERMISSIONS.ORG_UNIT_UPDATE,
    'role:assignment:view',
  ],
});

export const activeLinkedEmploymentProfileFixture = {
  id: 'ep-linked-active',
  employeeCode: 'EP-LINKED-ACTIVE',
  legalName: 'Alice Nguyen',
  displayName: 'Alice Linked',
  employmentKind: 'FULL_TIME',
  jobTitle: 'Director',
  orgUnitId: 'ou-sales',
  orgUnitRef: { id: 'ou-sales', code: 'OU-SALES', name: 'Sales', status: 'ACTIVE' },
  recruiterEmploymentProfileId: null,
  recruiterEmploymentProfileRef: null,
  hrOwnerEmploymentProfileId: null,
  hrOwnerEmploymentProfileRef: null,
  onboardingOwnerEmploymentProfileId: null,
  onboardingOwnerEmploymentProfileRef: null,
  sourcedByEmploymentProfileId: null,
  sourcedByEmploymentProfileRef: null,
  linkedUserId: 'user-alice',
  linkedUserRef: {
    id: 'user-alice',
    displayName: 'Alice User',
    name: 'alice@example.test',
    status: 'ACTIVE',
  },
  employmentStatus: 'ACTIVE',
  contractStatus: 'ACTIVE',
  hiredAt: Date.UTC(2024, 0, 1),
  onboardedAt: Date.UTC(2024, 0, 8),
  createdAt: Date.UTC(2024, 0, 1),
};

export const renderRoleRoute = (path = '/roles') =>
  renderRouteWithAccess(path, { capabilities: roleAdminCapabilities });

export const findRolePicker = async (pickerId: string): Promise<HTMLElement> => {
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

export const openGuidedAssignment = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> => {
  renderRoleRoute();
  expect(
    await screen.findByRole('heading', { name: i18n.t('role:page.title') }),
  ).toBeInTheDocument();
  await user.click(await screen.findByRole('tab', { name: i18n.t('role:tabs.assignments') }));
  expect(
    await screen.findByRole('heading', { name: i18n.t('role:accessAssignment.userTitle') }),
  ).toBeInTheDocument();
};

export const selectAliceForAssignment = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> => {
  const picker = await findRolePicker('role-access-assignment-linked-user');
  await user.type(
    within(picker).getByPlaceholderText(i18n.t('role:accessAssignment.userSearchPlaceholder')),
    'Al',
  );
  await user.click(await within(picker).findByText(/Alice/u));
};

export const continueGuidedAssignment = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> => {
  const button = screen.getByRole('button', {
    name: i18n.t('role:accessAssignment.footer.continue'),
  });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
};

export const getProgressCard = (stepId: 'user' | 'target' | 'condition' | 'preview'): HTMLElement =>
  screen.getByTestId(`role-assignment-progress-card-${stepId}`);
