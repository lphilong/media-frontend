import { useShellStore } from '@app/store/shell-store';
import { LocaleSwitcher } from '@shared/components/shell/LocaleSwitcher';
import { setLocale } from '@shared/i18n/i18n';
import type { AppLocale } from '@shared/i18n/constants';

export const AppLocaleSwitcher = (): JSX.Element => {
  const locale = useShellStore((state) => state.locale);
  const updateLocale = useShellStore((state) => state.setLocale);

  const onLocaleChange = async (nextLocale: AppLocale): Promise<void> => {
    updateLocale(nextLocale);
    await setLocale(nextLocale);
  };

  return <LocaleSwitcher locale={locale} onLocaleChange={onLocaleChange} />;
};
