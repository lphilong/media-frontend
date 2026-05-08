import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { APP_PATHS } from '@app/router/paths';
import { useAuth } from '@shared/auth/auth-context';
import { resolveReturnTarget } from '@shared/auth/return-target';
import {
  ErrorState,
  LoadingState,
  NotFoundState,
  PageContainer,
  PageHeader,
  PermissionDeniedState,
} from '@shared/components/primitives';

export const LoginPage = (): JSX.Element => {
  const { t } = useTranslation(['common', 'errors']);
  const location = useLocation();
  const { status, login } = useAuth();

  const returnTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return resolveReturnTarget(params.get('returnTo'), APP_PATHS.dashboard);
  }, [location.search]);

  const [error, setError] = useState<string | null>(null);

  if (status === 'authenticated') {
    return <Navigate to={returnTo} replace />;
  }

  if (status === 'configurationError') {
    return (
      <PageContainer className="max-w-xl pt-16">
        <PageHeader title={t('common:auth.loginTitle')} subtitle={t('common:auth.loginSubtitle')} />
        <ErrorState title={t('errors:auth.title')} message={t('errors:auth.configMissing')} />
      </PageContainer>
    );
  }

  const onLogin = async (): Promise<void> => {
    setError(null);
    try {
      await login(returnTo);
    } catch {
      setError(t('errors:auth.loginFailed'));
    }
  };

  return (
    <PageContainer className="max-w-xl pt-16">
      <PageHeader title={t('common:auth.loginTitle')} subtitle={t('common:auth.loginSubtitle')} />
      {error ? <ErrorState title={t('errors:auth.title')} message={error} /> : null}
      <button
        type="button"
        onClick={() => void onLogin()}
        className="rounded bg-accent px-4 py-2 text-sm font-medium text-white"
      >
        {t('common:actions.login')}
      </button>
    </PageContainer>
  );
};

export const AuthCallbackPage = (): JSX.Element => {
  const { t } = useTranslation(['common', 'errors']);
  const navigate = useNavigate();
  const { handleCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async (): Promise<void> => {
      try {
        const returnTo = await handleCallback();
        navigate(returnTo ?? APP_PATHS.dashboard, { replace: true });
      } catch {
        setError(t('errors:auth.callbackFailed'));
      }
    };

    void run();
  }, [handleCallback, navigate, t]);

  if (error) {
    return (
      <PageContainer className="max-w-xl pt-16">
        <ErrorState title={t('errors:auth.title')} message={error} />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-xl pt-16">
      <LoadingState lines={4} />
    </PageContainer>
  );
};

export const ForbiddenPage = (): JSX.Element => {
  return (
    <PageContainer>
      <PermissionDeniedState />
    </PageContainer>
  );
};

export const NotFoundPage = (): JSX.Element => {
  return (
    <PageContainer>
      <NotFoundState />
    </PageContainer>
  );
};
