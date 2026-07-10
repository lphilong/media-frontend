import i18n from 'i18next';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import {
  activeLinkedEmploymentProfileFixture,
  continueGuidedAssignment,
  findRolePicker,
  getProgressCard,
  openGuidedAssignment,
  selectAliceForAssignment,
} from '@modules/role/__tests__/role-integration-test-helpers';
import { server } from '@test/msw/server';

const accessLabel = (key: string) => i18n.t(`role:accessAssignment.displayLabels.${key}`);

describe('Role guided assignment integration', () => {
  it('blocks a review-required manager target in Step 3 until scope, reason, and review date exist', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/admin/employment-profiles', () =>
        HttpResponse.json({ data: [activeLinkedEmploymentProfileFixture], meta: {} }),
      ),
      http.get('*/admin/reference/talent-groups', ({ request }) => {
        const search = new URL(request.url).searchParams.get('search') ?? '';
        return HttpResponse.json({
          data: {
            items: search
              ? [
                  {
                    id: 'group-create',
                    label: 'Creators A',
                    secondaryLabel: 'Talent group',
                    code: 'TG-CREATE',
                    status: 'ACTIVE',
                  },
                ]
              : [],
          },
        });
      }),
    );

    await openGuidedAssignment(user);
    await selectAliceForAssignment(user);
    await continueGuidedAssignment(user);
    await user.click(
      screen.getByRole('button', { name: i18n.t('role:accessAssignment.roleMode') }),
    );
    await user.selectOptions(
      screen.getByLabelText(i18n.t('role:accessAssignment.targetLabel')),
      'ROLE_TEMPLATE:TALENT_GROUP_MANAGER:',
    );
    await continueGuidedAssignment(user);

    const reasonInput = screen.getByPlaceholderText(
      i18n.t('role:accessAssignment.reasonPlaceholder'),
    );
    const continueToPreview = screen.getByRole('button', {
      name: i18n.t('role:accessAssignment.footer.continueToPreview'),
    });
    expect(continueToPreview).toBeDisabled();
    expect(getProgressCard('condition')).toHaveAttribute('data-status-tone', 'danger');
    expect(
      screen.getByText(i18n.t('role:accessAssignment.guardrail.missingScope')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('role:accessAssignment.guardrail.missingReason')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(i18n.t('role:accessAssignment.guardrail.missingReviewDate')),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('role-assignment-step-preview')).not.toBeInTheDocument();

    const scopePicker = await findRolePicker('role-access-assignment-scope-managedTalentGroup');
    await user.type(
      within(scopePicker).getByPlaceholderText(
        i18n.t('role:accessAssignment.scopeSearchPlaceholder'),
      ),
      'Creators',
    );
    await user.click(await within(scopePicker).findByText('Creators A'));
    await user.type(reasonInput, 'Scoped manager guardrail coverage');

    expect(continueToPreview).toBeDisabled();
    expect(
      screen.getByText(i18n.t('role:accessAssignment.guardrail.missingReviewDate')),
    ).toBeInTheDocument();
    expect(getProgressCard('preview')).toHaveAttribute('data-status-tone', 'neutral');

    await user.type(
      screen.getByLabelText(i18n.t('role:accessAssignment.reviewAtLabel')),
      '2026-08-01',
    );
    await waitFor(() => expect(continueToPreview).toBeEnabled());
    expect(getProgressCard('condition')).toHaveAttribute('data-status-tone', 'success');
    await user.click(continueToPreview);

    expect(screen.getByTestId('role-assignment-step-preview')).toBeInTheDocument();
    expect(
      await screen.findByText(i18n.t('role:accessAssignment.previewCanApply')),
    ).toBeInTheDocument();
  }, 25_000);

  it('requires explicit sensitive confirmation before apply', async () => {
    const user = userEvent.setup();
    let applyRequests = 0;
    server.use(
      http.get('*/admin/employment-profiles', () =>
        HttpResponse.json({ data: [activeLinkedEmploymentProfileFixture], meta: {} }),
      ),
      http.post('*/admin/access-assignments/preview', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          data: {
            previewOnly: true,
            canApply: true,
            blockers: [],
            warnings: [],
            normalizedScope: [{ scopeType: 'global' }],
            proposedAssignments: [{ roleCode: 'OWNER_ADMIN' }],
            effectiveAccessDelta: { addedPermissions: ['role.view'] },
            sensitiveAccess: {
              sensitiveOrGlobal: true,
              isSensitive: true,
              isGlobalLike: true,
              isHighRisk: true,
              requiresReason: true,
              requiresReview: true,
              reviewAt: Date.parse(String(body.reviewAt)),
              globalScopes: [{ scopeType: 'global' }],
              reviewPolicy: 'REVIEW_REQUIRED',
            },
          },
        });
      }),
      http.post('*/admin/access-assignments/apply', () => {
        applyRequests += 1;
        return HttpResponse.json({
          data: {
            applied: true,
            canApply: true,
            applyStatus: 'APPLIED',
            blockers: [],
            warnings: [],
            normalizedScope: [{ scopeType: 'global' }],
            appliedAssignments: [{ assignmentId: 'assignment-owner-confirmed' }],
            auditTrace: { assignmentIds: ['assignment-owner-confirmed'] },
            effectiveAccessAfterApply: { permissions: ['role.view'] },
          },
        });
      }),
    );

    await openGuidedAssignment(user);
    await selectAliceForAssignment(user);
    await continueGuidedAssignment(user);
    await user.selectOptions(
      screen.getByLabelText(i18n.t('role:accessAssignment.targetLabel')),
      'BUNDLE:OWNER_ADMIN_BUNDLE:2026-05-20',
    );
    expect(getProgressCard('target')).toHaveAttribute('data-status-tone', 'warning');
    await continueGuidedAssignment(user);

    await user.type(
      screen.getByPlaceholderText(i18n.t('role:accessAssignment.reasonPlaceholder')),
      'Sensitive access confirmation coverage',
    );
    await user.type(
      screen.getByLabelText(i18n.t('role:accessAssignment.reviewAtLabel')),
      '2026-08-01',
    );
    await user.type(
      screen.getByLabelText(i18n.t('role:accessAssignment.expiresAtLabel')),
      '2026-08-10',
    );

    const continueToPreview = screen.getByRole('button', {
      name: i18n.t('role:accessAssignment.footer.continueToPreview'),
    });
    await waitFor(() => expect(continueToPreview).toBeEnabled());
    await user.click(continueToPreview);
    expect(
      await screen.findByText(i18n.t('role:accessAssignment.previewCanApply')),
    ).toBeInTheDocument();

    const applyButton = screen.getByRole('button', {
      name: i18n.t('role:accessAssignment.applyButton'),
    });
    await waitFor(() => expect(applyButton).toBeEnabled());
    await user.click(applyButton);
    expect(applyRequests).toBe(0);

    const dialog = screen.getByRole('dialog', {
      name: i18n.t('role:accessAssignment.sensitiveConfirm.title'),
    });
    expect(within(dialog).getByText(/Alice Linked/u)).toBeInTheDocument();
    expect(within(dialog).getByText(accessLabel('ownerAdmin'))).toBeInTheDocument();
    expect(
      within(dialog).getByText(i18n.t('role:accessAssignment.scopeTypes.global')),
    ).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole('button', {
        name: i18n.t('role:accessAssignment.sensitiveConfirm.cancel'),
      }),
    );
    expect(applyRequests).toBe(0);

    await user.click(applyButton);
    await user.click(
      screen.getByRole('button', {
        name: i18n.t('role:accessAssignment.sensitiveConfirm.confirm'),
      }),
    );
    await waitFor(() => expect(applyRequests).toBe(1));
    expect(
      await screen.findByText(i18n.t('role:accessAssignment.resultApplied')),
    ).toBeInTheDocument();
  }, 25_000);
});
