import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  I18N_NAMESPACES,
  SUPPORTED_LOCALES,
  type AppLocale,
} from '@shared/i18n/constants';
import { getStoredLocale, persistLocale } from '@shared/i18n/locale';
import { loadLocaleResources } from '@shared/i18n/resources';

const initialLocale = getStoredLocale();
let initPromise: Promise<typeof i18n> | null = null;

export const initializeI18n = async (): Promise<typeof i18n> => {
  initPromise ??= i18n
    .use(initReactI18next)
    .init({
      resources: {},
      lng: initialLocale,
      fallbackLng: FALLBACK_LOCALE,
      supportedLngs: [...SUPPORTED_LOCALES],
      defaultNS: 'common',
      ns: I18N_NAMESPACES,
      showSupportNotice: false,
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    })
    .then(async () => {
      await loadLocaleResources(i18n, initialLocale);
      return i18n;
    });

  return initPromise;
};

void initializeI18n();

i18n.on('languageChanged', (lng) => {
  persistLocale(lng as AppLocale);
});

export const setLocale = async (locale: AppLocale): Promise<void> => {
  await initializeI18n();
  await loadLocaleResources(i18n, locale);
  await i18n.changeLanguage(locale);
};

export { DEFAULT_LOCALE };
export default i18n;
