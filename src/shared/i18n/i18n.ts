import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  I18N_NAMESPACES,
  type AppLocale,
} from '@shared/i18n/constants';
import { getStoredLocale, persistLocale } from '@shared/i18n/locale';
import { resources } from '@shared/i18n/resources';

void i18n.use(initReactI18next).init({
  resources,
  lng: getStoredLocale(),
  fallbackLng: FALLBACK_LOCALE,
  defaultNS: 'common',
  ns: I18N_NAMESPACES,
  showSupportNotice: false,
  interpolation: {
    escapeValue: false,
  },
});

i18n.on('languageChanged', (lng) => {
  persistLocale(lng as AppLocale);
});

export const setLocale = async (locale: AppLocale): Promise<void> => {
  await i18n.changeLanguage(locale);
};

export { DEFAULT_LOCALE };
export default i18n;
