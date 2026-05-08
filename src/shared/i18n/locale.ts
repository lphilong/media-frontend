import {
  DEFAULT_LOCALE,
  I18N_STORAGE_KEY,
  type AppLocale,
  SUPPORTED_LOCALES,
} from '@shared/i18n/constants';

export const isSupportedLocale = (value: string): value is AppLocale => {
  return SUPPORTED_LOCALES.includes(value as AppLocale);
};

export const getStoredLocale = (): AppLocale => {
  const value = localStorage.getItem(I18N_STORAGE_KEY);
  if (value && isSupportedLocale(value)) {
    return value;
  }

  return DEFAULT_LOCALE;
};

export const persistLocale = (locale: AppLocale): void => {
  localStorage.setItem(I18N_STORAGE_KEY, locale);
};
