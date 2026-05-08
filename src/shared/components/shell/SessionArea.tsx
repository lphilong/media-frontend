import { useTranslation } from 'react-i18next';

import { useAuth } from '@shared/auth/auth-context';

export const SessionArea = (): JSX.Element => {
  const { t } = useTranslation('common');
  const { session, logout } = useAuth();

  return (
    <div className="flex items-center gap-3 rounded border border-border bg-panel px-2 py-1 text-xs shadow-shell">
      <div className="text-right">
        <p className="font-medium text-text">{session?.userName ?? t('session.placeholderUser')}</p>
        <p className="text-muted">{t('session.statusActive')}</p>
      </div>
      <button
        type="button"
        onClick={() => void logout('/')}
        className="rounded border border-border px-2 py-1 text-xs text-text hover:bg-slate-50"
      >
        {t('actions.logout')}
      </button>
    </div>
  );
};
