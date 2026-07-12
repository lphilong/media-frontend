import i18n from 'i18next';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';

import { ResponsibilityAssignmentPage } from '@modules/responsibility/pages/ResponsibilityAssignmentPage';
import type { ResponsibilityAssignment } from '@modules/responsibility/types/responsibility.types';
import { setMockCurrentActorCapabilities } from '@test/msw/identity-access-handlers';
import { server } from '@test/msw/server';
import { renderModuleSurface } from '@test/render-app-route';
import { setLocale } from '@shared/i18n/i18n';

const { loadEmploymentProfiles, loadTalentGroups } = vi.hoisted(() => ({
  loadEmploymentProfiles: vi.fn(),
  loadTalentGroups: vi.fn(),
}));

const subjectId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const profileId = '8f14e45f-ea1b-4a9d-8c11-0c1a2b3c4d5e';
const forbiddenPickerValues = [
  subjectId,
  profileId,
  'TALENT_GROUP',
  'ACTIVE',
  'INTERNAL_LOADER_DESCRIPTION',
  'PROFILE_INTERNAL_DESCRIPTION',
] as const;

vi.mock('@modules/employment-profile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@modules/employment-profile')>()),
  loadEmploymentProfileReferenceOptions: loadEmploymentProfiles,
}));
vi.mock('@modules/talent-group', () => ({
  loadTalentGroupReferenceOptions: loadTalentGroups,
}));

const assignment = (): ResponsibilityAssignment => ({
  id: 'responsibility-001',
  subjectType: 'TALENT_GROUP',
  subjectId,
  responsibleEmploymentProfileId: profileId,
  responsibilityType: 'TALENT_GROUP_MANAGER',
  responsibilityRole: 'GROUP_MANAGER',
  includeDescendants: null,
  actionMask: [],
  isPrimary: true,
  status: 'ACTIVE',
  effectiveAt: '2026-07-12',
  expiresAt: null,
  revokedAt: null,
  reason: 'Operational ownership',
  createdBy: 'admin-001',
  createdAt: '2026-07-12T00:00:00.000Z',
  updatedBy: 'admin-001',
  updatedAt: '2026-07-12T00:00:00.000Z',
  revokedBy: null,
  revokedReason: null,
  reviewNeeded: false,
  reviewReason: null,
  subjectRef: { id: subjectId, displayName: 'Creator Group', code: 'TG-001' },
  responsibleEmploymentProfileRef: {
    id: profileId,
    displayName: 'Responsible Person',
    code: 'EP-001',
  },
});

const configureActor = (): void => {
  setMockCurrentActorCapabilities({
    id: 'responsibility-admin',
    type: 'admin',
    context: 'ADMIN',
    isActive: true,
    roles: ['ADMIN'],
    permissions: ['talentGroup.update'],
    scopeGrants: {},
    accountContexts: ['ADMIN_CONSOLE'],
    generatedAt: '2026-07-12T00:00:00.000Z',
  });
};

const renderWorkflow = (): void => {
  configureActor();
  loadTalentGroups.mockResolvedValue([
    {
      id: subjectId,
      label: 'Creator Group',
      code: 'TG-001',
      description: 'INTERNAL_LOADER_DESCRIPTION',
      status: 'ACTIVE',
    },
  ]);
  loadEmploymentProfiles.mockResolvedValue([
    {
      id: profileId,
      label: 'Responsible Person',
      code: 'EP-001',
      description: 'PROFILE_INTERNAL_DESCRIPTION',
      status: 'ACTIVE',
    },
  ]);
  renderModuleSurface(<ResponsibilityAssignmentPage />);
};

const selectWorkflowReferences = async (user: ReturnType<typeof userEvent.setup>) => {
  const subjectPicker = screen
    .getAllByTestId('picker-surface')
    .find((element) => element.getAttribute('data-picker-id') === 'responsibility-subject');
  if (!subjectPicker) {
    throw new Error('Subject picker did not render');
  }
  expect(subjectPicker).toHaveAttribute('data-picker-id', 'responsibility-subject');
  await user.click(
    within(subjectPicker).getByRole('button', { name: i18n.t('common:actions.search') }),
  );
  await user.click(await within(subjectPicker).findByRole('option', { name: /Creator Group/i }));

  const responsiblePicker = screen
    .getAllByTestId('picker-surface')
    .find(
      (element) => element.getAttribute('data-picker-id') === 'responsibility-responsible-profile',
    );
  if (!responsiblePicker) {
    throw new Error('Responsible profile picker did not render');
  }
  await user.click(
    within(responsiblePicker).getByRole('button', { name: i18n.t('common:actions.search') }),
  );
  await user.click(
    await within(responsiblePicker).findByRole('option', { name: /Responsible Person/i }),
  );
};

describe('Responsibility assignment workflow', () => {
  beforeEach(async () => {
    await setLocale('en');
    loadEmploymentProfiles.mockReset();
    loadTalentGroups.mockReset();
  });

  it('requires a subject before the responsible profile and keeps technical identifiers out of normal workflow content', async () => {
    const user = userEvent.setup();
    renderWorkflow();

    const pickers = await screen.findAllByTestId('picker-surface');
    const responsiblePicker = pickers.find(
      (element) => element.getAttribute('data-picker-id') === 'responsibility-responsible-profile',
    );
    expect(responsiblePicker).toBeDefined();
    expect(
      within(responsiblePicker!).getByText(/Choose the managed subject before selecting/i),
    ).toBeInTheDocument();

    await selectWorkflowReferences(user);
    expect(screen.getAllByText('Creator Group').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Responsible Person').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/TG-001|EP-001/u).length).toBeGreaterThan(0);
    for (const forbiddenValue of forbiddenPickerValues) {
      expect(screen.queryByText(forbiddenValue)).not.toBeInTheDocument();
    }
    await user.click(screen.getByRole('button', { name: /Review assignment/i }));
    const review = screen.getByTestId('responsibility-review');
    expect(within(review).getByText('Creator Group')).toBeInTheDocument();
    expect(within(review).getByText('Responsible Person')).toBeInTheDocument();
    expect(within(review).getByText('Talent Group Manager')).toBeInTheDocument();
    expect(within(review).getByText(/does not grant access/i)).toBeInTheDocument();
    for (const forbiddenValue of forbiddenPickerValues) {
      expect(within(review).queryByText(forbiddenValue)).not.toBeInTheDocument();
    }
  });

  it('sends one request for two same-tick confirms, releases after failure, and resets only through Assign another', async () => {
    const user = userEvent.setup();
    let requests = 0;
    let rejectRequest: (() => void) | undefined;
    server.use(
      http.get('*/admin/responsibilities', () => HttpResponse.json({ data: [] })),
      http.post('*/admin/responsibilities', () => {
        requests += 1;
        return new Promise<Response>((resolve) => {
          rejectRequest = () => resolve(HttpResponse.json({ message: 'retry' }, { status: 503 }));
        });
      }),
    );
    renderWorkflow();
    await selectWorkflowReferences(user);
    await user.click(screen.getByRole('button', { name: /Review assignment/i }));

    const confirm = screen.getByRole('button', { name: /^Assign responsibility$/i });
    confirm.click();
    confirm.click();
    await waitFor(() => expect(requests).toBe(1));

    rejectRequest?.();
    await waitFor(() => expect(confirm).toBeEnabled());
    expect(screen.getAllByText('Creator Group').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Responsible Person').length).toBeGreaterThan(0);

    server.use(
      http.post('*/admin/responsibilities', () => HttpResponse.json({ data: assignment() })),
    );
    await user.click(confirm);
    expect(await screen.findByRole('button', { name: /Assign another/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Assign responsibility$/i }),
    ).not.toBeInTheDocument();
    const completion = screen
      .getByText('Responsibility assignment complete')
      .closest('[role="status"]');
    if (!(completion instanceof HTMLElement)) {
      throw new Error('Responsibility completion status did not render');
    }
    expect(completion).toHaveTextContent('Creator Group');
    expect(completion).toHaveTextContent('Responsible Person');
    for (const forbiddenValue of forbiddenPickerValues) {
      expect(within(completion).queryByText(forbiddenValue)).not.toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: /Assign another/i }));
    expect(screen.queryByRole('button', { name: /Assign another/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Review assignment/i })).toBeDisabled();
  });

  it('keeps unavailable selected references safe in the module summary, review, and completion after reload', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/admin/responsibilities', () => HttpResponse.json({ data: assignment() })),
    );
    renderWorkflow();
    await selectWorkflowReferences(user);

    loadTalentGroups.mockResolvedValue([]);
    loadEmploymentProfiles.mockResolvedValue([]);
    const subjectPicker = screen
      .getAllByTestId('picker-surface')
      .find((element) => element.getAttribute('data-picker-id') === 'responsibility-subject');
    const responsiblePicker = screen
      .getAllByTestId('picker-surface')
      .find(
        (element) =>
          element.getAttribute('data-picker-id') === 'responsibility-responsible-profile',
      );
    if (!subjectPicker || !responsiblePicker) {
      throw new Error('Responsibility reference pickers did not render');
    }

    await user.click(within(subjectPicker).getByRole('button', { name: 'Search' }));
    await user.click(within(responsiblePicker).getByRole('button', { name: 'Search' }));
    const unavailable = 'Selected record is not available in the current result set.';
    await waitFor(() => expect(screen.getAllByText(unavailable)).toHaveLength(2));
    for (const forbiddenValue of forbiddenPickerValues) {
      expect(screen.queryByText(forbiddenValue)).not.toBeInTheDocument();
    }
    expect(screen.queryByText('Creator Group')).not.toBeInTheDocument();
    expect(screen.queryByText('Responsible Person')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Review assignment/i }));
    const review = screen.getByTestId('responsibility-review');
    expect(within(review).getAllByText(unavailable)).toHaveLength(2);
    for (const forbiddenValue of forbiddenPickerValues) {
      expect(within(review).queryByText(forbiddenValue)).not.toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: /^Assign responsibility$/i }));
    const completionTitle = await screen.findByText('Responsibility assignment complete');
    const completion = completionTitle.closest('[role="status"]');
    if (!(completion instanceof HTMLElement)) {
      throw new Error('Responsibility completion status did not render');
    }
    expect(completion).toHaveTextContent(new RegExp(`${unavailable}.*${unavailable}`, 'u'));
    for (const forbiddenValue of forbiddenPickerValues) {
      expect(within(completion).queryByText(forbiddenValue)).not.toBeInTheDocument();
    }
  });

  it.each(['en', 'vi', 'zh'] as const)(
    'renders the responsibility workflow, review, completion, and localized actions in %s',
    async (locale) => {
      await setLocale(locale);
      const user = userEvent.setup();
      const translate = i18n.getFixedT(locale, 'responsibility');
      server.use(
        http.post('*/admin/responsibilities', () => HttpResponse.json({ data: assignment() })),
      );
      renderWorkflow();

      expect(await screen.findByText(translate('form.helper'))).toBeInTheDocument();
      expect(
        screen.getAllByText(translate('form.subject'), { exact: false }).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText(translate('form.responsible'), { exact: false }).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText(translate('form.required'), { exact: false }).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText(translate('form.optional'), { exact: false }).length,
      ).toBeGreaterThan(0);
      expect(screen.getByText(translate('form.conditional'), { exact: false })).toBeInTheDocument();
      if (locale !== 'en') {
        expect(translate('form.helper')).not.toBe(
          i18n.getFixedT('en', 'responsibility')('form.helper'),
        );
      }

      await selectWorkflowReferences(user);
      await user.click(screen.getByRole('button', { name: translate('actions.review') }));
      const review = screen.getByTestId('responsibility-review');
      expect(within(review).getByText(translate('review.title'))).toBeInTheDocument();
      expect(within(review).getByText(translate('review.subject'))).toBeInTheDocument();
      expect(within(review).getByText(translate('review.responsible'))).toBeInTheDocument();
      expect(
        within(review).getByRole('button', { name: translate('actions.create') }),
      ).toBeInTheDocument();

      await user.click(within(review).getByRole('button', { name: translate('actions.create') }));
      expect(await screen.findByText(translate('completion.title'))).toBeInTheDocument();
      expect(screen.getByText(translate('completion.message'))).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: translate('actions.assignAnother') }),
      ).toBeInTheDocument();
    },
  );
});
