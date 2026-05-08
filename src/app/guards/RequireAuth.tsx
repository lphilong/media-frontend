import type { PropsWithChildren } from 'react';

import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { ErrorState, LoadingState, PageContainer } from '@shared/components/primitives';
import { useAuth } from '@shared/auth/auth-context';
import { resolveReturnTarget } from '@shared/auth/return-target';

export const RequireAuth = ({ children }: PropsWithChildren): JSX.Element => {
  const { t } = useTranslation(['common', 'errors']);
  const location = useLocation();
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <PageContainer>
        <LoadingState lines={5} />
      </PageContainer>
    );
  }

  if (status === 'unauthenticated') {
    const returnTo = encodeURIComponent(
      resolveReturnTarget(`${location.pathname}${location.search}${location.hash}`),
    );
    return <Navigate to={`${APP_PATHS.login}?returnTo=${returnTo}`} replace />;
  }

  if (status === 'configurationError') {
    return (
      <PageContainer className="max-w-xl pt-16">
        <ErrorState title={t('errors:auth.title')} message={t('errors:auth.configMissing')} />
      </PageContainer>
    );
  }

  if (!children) {
    return (
      <PageContainer>
        <LoadingState lines={5} className="mt-4" />
        <p className="mt-2 text-sm text-muted">{t('states.loading')}</p>
      </PageContainer>
    );
  }

  return <>{children}</>;
};
