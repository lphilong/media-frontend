export const SUPPORTED_LOCALES = ['vi', 'en', 'zh'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'vi';
export const FALLBACK_LOCALE: AppLocale = 'en';

export const I18N_STORAGE_KEY = 'admin.locale';

export const I18N_NAMESPACES = [
  'common',
  'nav',
  'errors',
  'dashboard-lite',
  'user',
  'role',
  'org-unit',
  'employment-profile',
  'talent',
  'talent-group',
  'platform-account',
  'studio-resource',
  'work-schedule',
  'event-assignment',
  'contract-registry',
  'talent-kpi',
  'revenue-ledger',
  'commission',
] as const;

export type I18nNamespace = (typeof I18N_NAMESPACES)[number];
