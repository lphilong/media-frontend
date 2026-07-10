import { vi } from 'vitest';

import { setLocale } from '@shared/i18n/i18n';
import i18n from '@shared/i18n/i18n';
import type { AppLocale } from '@shared/i18n/constants';

type RestoreLocale = () => Promise<void>;
type RestoreTime = () => void;

export const setupLocale = async (locale: AppLocale = 'en'): Promise<RestoreLocale> => {
  const previousLocale = i18n.language as AppLocale;
  await setLocale(locale);

  return async () => {
    await setLocale(previousLocale);
  };
};

export const installFakeTime = (now: string | Date | number): RestoreTime => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now instanceof Date ? now : new Date(now));
  let restored = false;

  return () => {
    if (restored) {
      return;
    }
    restored = true;
    vi.useRealTimers();
  };
};
