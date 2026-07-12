import i18n from 'i18next';

import { setLocale } from '@shared/i18n/i18n';

const responsibilityKeys = [
  'form.helper',
  'form.subject',
  'form.responsible',
  'form.required',
  'form.optional',
  'form.conditional',
  'actions.review',
  'actions.create',
  'feedback.created',
  'actions.assignAnother',
  'feedback.createFailed',
  'form.selectedReferenceUnavailable',
  'summary.unavailableRole',
  'list.emptyTitle',
  'list.loadErrorTitle',
] as const;

const resolve = (key: (typeof responsibilityKeys)[number]): string =>
  i18n.t(`responsibility:${key}`);

describe('Responsibility locale semantics', () => {
  afterEach(async () => {
    await setLocale('en');
  });

  it.each(['en', 'vi', 'zh'] as const)(
    'resolves the workflow, outcome, picker, and fallback copy in %s',
    async (locale) => {
      await setLocale(locale);

      for (const key of responsibilityKeys) {
        const copy = resolve(key);
        expect(copy).not.toBe(`responsibility:${key}`);
        expect(copy.trim()).not.toHaveLength(0);
      }

      if (locale !== 'en') {
        for (const key of responsibilityKeys) {
          expect(resolve(key)).not.toBe(i18n.getFixedT('en', 'responsibility')(key));
        }
      }
      expect(resolve('feedback.created')).not.toBe(resolve('feedback.createFailed'));
      expect(resolve('form.selectedReferenceUnavailable')).not.toMatch(
        /3fa85f64-5717-4562-b3fc-2c963f66afa6|UNKNOWN_RESPONSIBILITY_ROLE/iu,
      );
      expect(resolve('summary.unavailableRole')).not.toContain('UNKNOWN_RESPONSIBILITY_ROLE');
    },
  );
});
