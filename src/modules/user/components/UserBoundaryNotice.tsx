import { useTranslation } from 'react-i18next';

export const UserBoundaryNotice = (): JSX.Element => {
  const { t } = useTranslation('user');

  return (
    <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
      {t('user:detail.boundaryNotice')}
    </div>
  );
};
