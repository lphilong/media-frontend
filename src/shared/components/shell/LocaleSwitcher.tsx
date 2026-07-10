import { useTranslation } from 'react-i18next';

import type { AppLocale } from '@shared/i18n/constants';

const localeOrder: AppLocale[] = ['vi', 'en', 'zh'];

type LocaleSwitcherProps = {
  locale: AppLocale;
  onLocaleChange: (locale: AppLocale) => void | Promise<void>;
};

export const LocaleSwitcher = ({ locale, onLocaleChange }: LocaleSwitcherProps): JSX.Element => {
  const { t } = useTranslation('common');

  const onChange = async (nextLocale: AppLocale): Promise<void> => {
    await onLocaleChange(nextLocale);
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
