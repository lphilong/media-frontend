import i18n from 'i18next';

import { I18N_STORAGE_KEY } from '@shared/i18n/constants';
import { setLocale } from '@shared/i18n/i18n';
import { resources } from '@shared/i18n/resources';

const supportedLocales = ['en', 'vi', 'zh'] as const;
const translatedLocales = ['vi', 'zh'] as const;

const flattenLeaves = (value: unknown, prefix = ''): Array<[string, unknown]> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [[prefix, value]];
  }

  return Object.entries(value).flatMap(([key, child]) =>
    flattenLeaves(child, prefix ? `${prefix}.${key}` : key),
  );
};

const interpolationTokens = (value: string): string[] =>
  Array.from(value.matchAll(/\{\{\s*[\w.]+\s*\}\}/g), ([token]) => token.trim()).sort();

const canonicalLiteralPattern = /\b[a-z][a-z0-9-]*:[a-z][a-z0-9-]*\b/g;

const canonicalLiterals = (value: string): string[] =>
  Array.from(
    new Set(Array.from(value.matchAll(canonicalLiteralPattern), ([literal]) => literal)),
  ).sort();

type LocaleIssue = {
  locale: (typeof translatedLocales)[number];
  namespace: string;
  keyPath: string;
  pattern: string;
  value: string;
};

type LocalePattern = {
  label: string;
  pattern: RegExp;
};

const obviousEnglishPlaceholders = new Set([
  'Actions',
  'Activate',
  'Archive',
  'Cancel',
  'Create',
  'Dashboard',
  'Deactivate',
  'Edit',
  'Employment Profiles',
  'Filters',
  'Finalize',
  'Org Units',
  'Reconcile',
  'Refresh',
  'Retry',
  'Revenue Ledger',
  'Roles',
  'Save',
  'Search',
  'Status',
  'Users',
  'Void',
]);

const obviousEnglishPlaceholderPatterns: LocalePattern[] = Array.from(
  obviousEnglishPlaceholders,
  (placeholder) => ({
    label: `exact English placeholder "${placeholder}"`,
    pattern: new RegExp(`^${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
  }),
);

const intentionalDomainTermPattern =
  /\b(?:Talent|KPI|Livestream|Auth0|AUTH0|Email|Handle|ID|UTC|JSON|Wave|Backend|backend|token|scope|scopeGrants|mock auth|YYYY-MM-DD|API|URL|YouTube|SPACE|EQUIPMENT|DEPARTMENT|VITE_[A-Z0-9_]+|payload|permissions|rules|conditions|null)\b/g;

const routeOrCodeLikePattern =
  /(?:\/[a-z0-9/_:-]+|[a-z]+:[*a-z-]+|[A-Z][A-Z0-9_]{2,}|[a-z0-9-]+Id|{{\s*[\w.]+\s*}}|`[^`]+`|\{[^{}]*"[^{}]*\})/g;

const corruptionPatterns: LocalePattern[] = [
  { label: 'literal question-mark corruption', pattern: /\?{2,}/ },
  {
    label: 'question mark glued between letters',
    pattern: /[A-Za-z]\?[A-Za-z]/,
  },
];

const gluedEnglishPatterns: LocalePattern[] = [
  {
    label: 'glued English placeholder wording',
    pattern:
      /\b(?:Unableto|Createsa|Activatethis|Archivethis|Finalizethis|datacouldnot|businessflows|areintentionally|Adjustfilters|Textistoolong|Changeatleast)\b/i,
  },
];

const mixedEnglishPhrasePatterns: LocalePattern[] = [
  { label: 'English phrase "greater than"', pattern: /\bgreater than\b/i },
  { label: 'English phrase "at most"', pattern: /\bat most\b/i },
  { label: 'English phrase "Enter a"', pattern: /\bEnter a\b/i },
  { label: 'English phrase "Provide exactly"', pattern: /\bProvide exactly\b/i },
  { label: 'English phrase "Only"', pattern: /\bOnly\b/i },
  { label: 'English phrase "can change"', pattern: /\bcan change\b/i },
  { label: 'English phrase "match the current"', pattern: /\bmatch the current\b/i },
  { label: 'English phrase "Derived amounts"', pattern: /\bDerived amounts\b/i },
  { label: 'English phrase "backend-owned"', pattern: /\bbackend-owned\b/i },
  { label: 'English phrase "read-only"', pattern: /\bread-only\b/i },
  { label: 'English phrase "Exact"', pattern: /\bExact\b/i },
  { label: 'English phrase "prefix"', pattern: /\bprefix\b/i },
  { label: 'English phrase "Any"', pattern: /\bAny\b/i },
  { label: 'English phrase "Has"', pattern: /\bHas\b/i },
  { label: 'English phrase "Unable"', pattern: /\bUnable\b/i },
  { label: 'English phrase "successfully"', pattern: /\bsuccessfully\b/i },
  { label: 'English phrase "replaced"', pattern: /\breplaced\b/i },
  { label: 'English phrase "revoked"', pattern: /\brevoked\b/i },
  { label: 'English phrase "Creating"', pattern: /\bCreating\b/i },
  { label: 'English phrase "Updating"', pattern: /\bUpdating\b/i },
  { label: 'English phrase "Replacing"', pattern: /\bReplacing\b/i },
  { label: 'English phrase "Assign"', pattern: /\bAssign\b/i },
  { label: 'English phrase "Revoke"', pattern: /\bRevoke\b/i },
  { label: 'English phrase "The backend"', pattern: /\bThe backend\b/i },
  { label: 'English phrase "Set the"', pattern: /\bSet the\b/i },
  { label: 'English phrase "Use exactly"', pattern: /\bUse exactly\b/i },
  { label: 'English phrase "Use a positive"', pattern: /\bUse a positive\b/i },
  { label: 'English phrase "not compatible"', pattern: /\bnot compatible\b/i },
  { label: 'English phrase "File reference"', pattern: /\bFile reference\b/i },
  { label: 'English phrase "display name"', pattern: /\bdisplay name\b/i },
  { label: 'English phrase "Permission matrix"', pattern: /\bPermission matrix\b/i },
  { label: 'English phrase "not available"', pattern: /\bnot available\b/i },
  { label: 'English mixed placeholder "Unable to ..."', pattern: /\bUnable\s+to\b/i },
  { label: 'English mixed placeholder "Select a ..."', pattern: /\bSelect\s+a\b/i },
  { label: 'English mixed placeholder "could not be loaded"', pattern: /\bcould not be loaded\b/i },
  { label: 'English mixed placeholder "data could not"', pattern: /\bdata could not\b/i },
  {
    label: 'English action phrase with article',
    pattern:
      /\b(?:create|creates|update|updates|change|submit|replace|retry|archive|activate|deactivate|finalize|reconcile|void|cancel|search|filters)\s+(?:a|an|the|this)\b/i,
  },
];

const englishActionPlaceholderPatterns: LocalePattern[] = [
  {
    label: 'English action/status placeholder',
    pattern:
      /\b(?:Actions?|Activate|Archive|Cancel|Create|Deactivate|Edit|Finalize|Filters?|Refresh|Retry|Reconcile|Save|Search|Status|Void)\b/,
  },
];

const blockedTranslatedLocalePatterns: LocalePattern[] = [
  ...corruptionPatterns,
  ...gluedEnglishPatterns,
  ...mixedEnglishPhrasePatterns,
  ...obviousEnglishPlaceholderPatterns,
];

const strippedEnglishActionPatterns: LocalePattern[] = [...englishActionPlaceholderPatterns];

// Keep this list narrow and explicit. These are intentional product, locale, or code-example
// strings that are allowed to remain English in translated runtime resources.
const translatedLocaleAllowlist: Array<{
  locale: (typeof translatedLocales)[number] | 'all';
  namespace: string;
  keyPath: RegExp;
  value?: RegExp;
  reason: string;
}> = [
  {
    locale: 'all',
    namespace: 'common',
    keyPath: /^app\.name$/,
    value: /^Livestream Admin$/,
    reason: 'product name',
  },
  {
    locale: 'all',
    namespace: 'common',
    keyPath: /^locales\.en$/,
    value: /^English$/,
    reason: 'language self-name',
  },
];

const isAllowedTranslatedLocaleValue = (
  locale: (typeof translatedLocales)[number],
  namespace: string,
  keyPath: string,
  value: string,
): boolean =>
  translatedLocaleAllowlist.some(
    (entry) =>
      (entry.locale === 'all' || entry.locale === locale) &&
      entry.namespace === namespace &&
      entry.keyPath.test(keyPath) &&
      (!entry.value || entry.value.test(value)),
  );

const withoutAllowedTechnicalText = (value: string): string =>
  value.replace(intentionalDomainTermPattern, '').replace(routeOrCodeLikePattern, '');

const translatedLocaleValueIssues = (
  locale: (typeof translatedLocales)[number],
  namespace: string,
  value: unknown,
  englishLeaves: Map<string, unknown>,
): LocaleIssue[] => {
  const issues: LocaleIssue[] = [];

  for (const [keyPath, leafValue] of flattenLeaves(value)) {
    if (typeof leafValue !== 'string') {
      continue;
    }

    const trimmedValue = leafValue.trim();
    if (trimmedValue === '') {
      issues.push({
        locale,
        namespace,
        keyPath,
        pattern: 'empty or whitespace-only visible string',
        value: leafValue,
      });
      continue;
    }

    if (/\b(?:TODO|TBD|Translate me)\b/i.test(trimmedValue)) {
      issues.push({
        locale,
        namespace,
        keyPath,
        pattern: 'translation placeholder marker',
        value: trimmedValue,
      });
    }

    const englishValue = englishLeaves.get(keyPath);
    if (
      typeof englishValue === 'string' &&
      interpolationTokens(trimmedValue).join('\n') !== interpolationTokens(englishValue).join('\n')
    ) {
      issues.push({
        locale,
        namespace,
        keyPath,
        pattern: `interpolation token mismatch: expected ${JSON.stringify(
          interpolationTokens(englishValue),
        )} but received ${JSON.stringify(interpolationTokens(trimmedValue))}`,
        value: trimmedValue,
      });
    }

    if (typeof englishValue === 'string') {
      for (const literal of canonicalLiterals(englishValue)) {
        if (!trimmedValue.includes(literal)) {
          issues.push({
            locale,
            namespace,
            keyPath,
            pattern: `missing canonical permission/code literal ${JSON.stringify(literal)}`,
            value: trimmedValue,
          });
        }
      }
    }

    if (isAllowedTranslatedLocaleValue(locale, namespace, keyPath, trimmedValue)) {
      continue;
    }

    for (const { label, pattern } of blockedTranslatedLocalePatterns) {
      if (pattern.test(trimmedValue)) {
        issues.push({ locale, namespace, keyPath, pattern: label, value: trimmedValue });
      }
    }

    const valueWithoutAllowedTerms = withoutAllowedTechnicalText(trimmedValue);
    for (const { label, pattern } of strippedEnglishActionPatterns) {
      if (pattern.test(valueWithoutAllowedTerms)) {
        issues.push({
          locale,
          namespace,
          keyPath,
          pattern: `${label} after allowed technical terms are stripped`,
          value: trimmedValue,
        });
      }
    }
  }

  return issues;
};

const formatLocaleIssues = (issues: LocaleIssue[]): string =>
  issues
    .map(
      ({ locale, namespace, keyPath, pattern, value }) =>
        `${locale}/${namespace}.${keyPath} matched ${pattern}: ${JSON.stringify(value)}`,
    )
    .join('\n');

const expectNoLocaleIssues = (issues: LocaleIssue[]): void => {
  expect(issues, formatLocaleIssues(issues)).toEqual([]);
};

describe('locale foundation', () => {
  it('persists selected locale to localStorage', async () => {
    await setLocale('zh');

    expect(i18n.language).toBe('zh');
    expect(localStorage.getItem(I18N_STORAGE_KEY)).toBe('zh');
  });

  it('keeps supported locale namespaces and keys in parity', () => {
    const typedResources = resources as Record<string, Record<string, unknown>>;
    const englishNamespaces = Object.keys(typedResources.en).sort();

    for (const locale of supportedLocales) {
      expect(Object.keys(typedResources[locale]).sort()).toEqual(englishNamespaces);

      for (const namespace of englishNamespaces) {
        expect(
          flattenLeaves(typedResources[locale][namespace])
            .map(([key]) => key)
            .sort(),
        ).toEqual(
          flattenLeaves(typedResources.en[namespace])
            .map(([key]) => key)
            .sort(),
        );
      }
    }
  });

  it('preserves interpolation tokens and avoids empty or placeholder-like visible strings', () => {
    const typedResources = resources as Record<string, Record<string, unknown>>;
    const localeIssues: LocaleIssue[] = [];

    for (const locale of translatedLocales) {
      for (const namespace of Object.keys(typedResources.en)) {
        const englishLeaves = new Map(flattenLeaves(typedResources.en[namespace]));

        localeIssues.push(
          ...translatedLocaleValueIssues(
            locale,
            namespace,
            typedResources[locale][namespace],
            englishLeaves,
          ),
        );
      }
    }

    expectNoLocaleIssues(localeIssues);
  });
});
