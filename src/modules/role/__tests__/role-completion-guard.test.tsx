import i18n from 'i18next';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import {
  activeLinkedEmploymentProfileFixture,
  continueGuidedAssignment,
  openGuidedAssignment,
  selectAliceForAssignment,
} from '@modules/role/__tests__/role-integration-test-helpers';
import { server } from '@test/msw/server';

describe('Role assignment completion guard', () => {
  it('blocks same-tick duplicate apply attempts and unlocks correction after a retryable failure', async () => {
    const user = userEvent.setup();
    let applyRequests = 0;
    let respondToApply: ((response: Response) => void) | undefined;
    server.use(
      http.get('*/admin/employment-profiles', () =>
        HttpResponse.json({ data: [activeLinkedEmploymentProfileFixture], meta: {} }),
      ),
      http.post('*/admin/access-assignments/apply', () => {
        applyRequests += 1;
        return new Promise<Response>((resolve) => {
          respondToApply = resolve;
        });
      }),
    );

    await openGuidedAssignment(user);
    await selectAliceForAssignment(user);
    await continueGuidedAssignment(user);
    await user.selectOptions(
      screen.getByLabelText(i18n.t('role:accessAssignment.targetLabel')),
      'BUNDLE:STAFF_CONSOLE_BUNDLE:2026-05-20',
    );
    await continueGuidedAssignment(user);
    await user.type(
      screen.getByPlaceholderText(i18n.t('role:accessAssignment.reasonPlaceholder')),
      'Same-tick completion guard coverage',
    );
    await user.type(
      screen.getByLabelText(i18n.t('role:accessAssignment.reviewAtLabel')),
      '2026-08-01',
    );
    const preview = screen.getByRole('button', {
      name: i18n.t('role:accessAssignment.footer.continueToPreview'),
    });
    await waitFor(() => expect(preview).toBeEnabled());
    await user.click(preview);

    const apply = await screen.findByRole('button', {
      name: i18n.t('role:accessAssignment.applyButton'),
    });
    await waitFor(() => expect(apply).toBeEnabled());
    apply.click();
    apply.click();
    await waitFor(() => expect(applyRequests).toBe(1));

    respondToApply?.(HttpResponse.json({ message: 'retry' }, { status: 503 }));
    await waitFor(() => expect(apply).toBeEnabled());
  }, 25_000);
});
