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
import { setLocale } from '@shared/i18n/i18n';
import { server } from '@test/msw/server';

const outcomeKeys = ['conflict', 'noOp', 'stale', 'validation', 'retryable', 'unexpected'] as const;

const applyBlocked = (code: string) => ({
  applied: false,
  canApply: false,
  applyStatus: 'BLOCKED',
  blockers: [{ severity: 'BLOCKER', code, summary: 'UNSAFE_BACKEND_MESSAGE' }],
  warnings: [],
  normalizedScope: [{ scopeType: 'self' }],
  appliedAssignments: [],
  auditTrace: { written: false },
});

const applySuccess = () => ({
  applied: true,
  canApply: true,
  applyStatus: 'APPLIED',
  blockers: [],
  warnings: [],
  normalizedScope: [{ scopeType: 'self' }],
  appliedAssignments: [{ assignmentId: 'assignment-created' }],
  auditTrace: { assignmentIds: ['assignment-created'] },
  effectiveAccessAfterApply: { permissions: ['role.view'] },
});

const reachApply = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
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
    'Outcome semantics coverage',
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
  await user.click(
    await screen.findByRole('button', { name: i18n.t('role:accessAssignment.applyButton') }),
  );
};

describe('Role assignment outcome locale semantics', () => {
  afterEach(async () => {
    await setLocale('en');
  });

  it.each(['en', 'vi', 'zh'] as const)(
    'has distinct, localized outcome copy and actions in %s',
    async (locale) => {
      await setLocale(locale);
      const translate = i18n.getFixedT(locale, 'role');
      const messages = outcomeKeys.map((outcome) =>
        translate(`accessAssignment.applyOutcomes.${outcome}.message`),
      );

      for (const outcome of outcomeKeys) {
        const title = translate(`accessAssignment.applyOutcomes.${outcome}.title`);
        expect(title).not.toBe(`accessAssignment.applyOutcomes.${outcome}.title`);
        expect(title.trim()).not.toHaveLength(0);
      }
      expect(new Set(messages).size).toBe(messages.length);
      expect(translate('accessAssignment.completion.assignAnother')).not.toMatch(/assignAnother/u);
      expect(translate('accessAssignment.completion.viewEffectiveAccess')).not.toMatch(
        /viewEffectiveAccess/u,
      );
      if (locale !== 'en') {
        expect(messages).not.toContain(
          i18n.getFixedT('en', 'role')('accessAssignment.applyOutcomes.conflict.message'),
        );
      }
    },
  );

  it.each([
    ['no-op duplicate', 'DUPLICATE_ACTIVE_ASSIGNMENT', 'noOp'],
    ['stale preview', 'SOURCE_CHANGED_AFTER_PREVIEW', 'stale'],
    ['validation failure', 'REASON_REQUIRED', 'validation'],
  ] as const)(
    'maps %s to its specific rendered outcome',
    async (_name, code, outcome) => {
      const user = userEvent.setup();
      server.use(
        http.get('*/admin/employment-profiles', () =>
          HttpResponse.json({ data: [activeLinkedEmploymentProfileFixture], meta: {} }),
        ),
        http.post('*/admin/access-assignments/apply', () =>
          HttpResponse.json({ data: applyBlocked(code) }),
        ),
      );

      await reachApply(user);

      expect(
        await screen.findByText(i18n.t(`role:accessAssignment.applyOutcomes.${outcome}.title`)),
      ).toBeInTheDocument();
      expect(
        screen.getByText(i18n.t(`role:accessAssignment.applyOutcomes.${outcome}.message`)),
      ).toBeInTheDocument();
      expect(document.body).not.toHaveTextContent(
        /UNSAFE_BACKEND_MESSAGE|DUPLICATE_ACTIVE_ASSIGNMENT|SOURCE_CHANGED_AFTER_PREVIEW|REASON_REQUIRED/u,
      );
    },
    25_000,
  );

  it.each(
    (['en', 'vi', 'zh'] as const).flatMap((locale) => [
      [locale, 'conflict', 'CURRENT_STATE_CONFLICT'] as const,
      [locale, 'noOp', 'DUPLICATE_ACTIVE_ASSIGNMENT'] as const,
      [locale, 'stale', 'SOURCE_CHANGED_AFTER_PREVIEW'] as const,
      [locale, 'validation', 'REASON_REQUIRED'] as const,
      [locale, 'retryable', 'HTTP_503'] as const,
    ]),
  )(
    'renders the structured %s outcome in %s without backend leakage',
    async (locale, outcome, code) => {
      await setLocale(locale);
      const user = userEvent.setup();
      server.use(
        http.get('*/admin/employment-profiles', () =>
          HttpResponse.json({ data: [activeLinkedEmploymentProfileFixture], meta: {} }),
        ),
        http.post('*/admin/access-assignments/apply', () =>
          code === 'HTTP_503'
            ? HttpResponse.json({ message: 'UNSAFE_BACKEND_MESSAGE' }, { status: 503 })
            : HttpResponse.json({ data: applyBlocked(code) }),
        ),
      );

      await reachApply(user);
      const translate = i18n.getFixedT(locale, 'role');
      expect(
        await screen.findByText(translate(`accessAssignment.applyOutcomes.${outcome}.title`)),
      ).toBeInTheDocument();
      expect(
        screen.getByText(translate(`accessAssignment.applyOutcomes.${outcome}.message`)),
      ).toBeInTheDocument();
      expect(document.body).not.toHaveTextContent(
        /UNSAFE_BACKEND_MESSAGE|CURRENT_STATE_CONFLICT|DUPLICATE_ACTIVE_ASSIGNMENT|SOURCE_CHANGED_AFTER_PREVIEW|REASON_REQUIRED/u,
      );
      if (locale !== 'en') {
        expect(translate(`accessAssignment.applyOutcomes.${outcome}.title`)).not.toBe(
          i18n.getFixedT('en', 'role')(`accessAssignment.applyOutcomes.${outcome}.title`),
        );
      }
    },
    25_000,
  );

  it.each(['en', 'vi', 'zh'] as const)(
    'renders successful assignment completion and localized next actions in %s',
    async (locale) => {
      await setLocale(locale);
      const user = userEvent.setup();
      server.use(
        http.get('*/admin/employment-profiles', () =>
          HttpResponse.json({ data: [activeLinkedEmploymentProfileFixture], meta: {} }),
        ),
        http.post('*/admin/access-assignments/apply', () =>
          HttpResponse.json({ data: applySuccess() }),
        ),
      );

      await reachApply(user);
      const translate = i18n.getFixedT(locale, 'role');
      expect(
        await screen.findByText(translate('accessAssignment.completion.title')),
      ).toBeInTheDocument();
      expect(screen.getByText(translate('accessAssignment.resultApplied'))).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: translate('accessAssignment.completion.assignAnother'),
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: translate('accessAssignment.completion.viewEffectiveAccess'),
        }),
      ).toBeInTheDocument();
    },
    25_000,
  );
});
