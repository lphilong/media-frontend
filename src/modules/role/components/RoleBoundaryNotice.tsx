import { useTranslation } from 'react-i18next';

export const RoleBoundaryNotice = (): JSX.Element => {
  const { t } = useTranslation('role');

  return (
    <div className="rounded border border-border bg-panel px-3 py-2 text-sm text-muted">
      {t('role:detail.boundaryNotice')}
    </div>
  );
};
