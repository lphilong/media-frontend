import { useTranslation } from 'react-i18next';

import { useShellStore } from '@app/store/shell-store';
import { setLocale } from '@shared/i18n/i18n';
import type { AppLocale } from '@shared/i18n/constants';

const localeOrder: AppLocale[] = ['vi', 'en', 'zh'];

export const LocaleSwitcher = (): JSX.Element => {
  const { t } = useTranslation('common');
  const locale = useShellStore((state) => state.locale);
  const updateLocale = useShellStore((state) => state.setLocale);

  const onChange = async (nextLocale: AppLocale): Promise<void> => {
    updateLocale(nextLocale);
    await setLocale(nextLocale);
  };

  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <span>{t('labels.locale')}</span>
      <select
        aria-label={t('labels.locale')}
        value={locale}
        onChange={(event) => void onChange(event.target.value as AppLocale)}
        className="rounded border border-border bg-panel px-2 py-1 text-xs text-text"
      >
        {localeOrder.map((value) => (
          <option key={value} value={value}>
            {t(`locales.${value}`)}
          </option>
        ))}
      </select>
    </label>
  );
};
