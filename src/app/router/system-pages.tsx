import { useEffect, useMemo, useRef, useState } from 'react';
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

const AUTH_UI_TIMEOUT_MS = 15_000;
const AUTH_ERROR_DETAIL_MAX_LENGTH = 180;

const sanitizeAuthErrorDetail = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value
    .replace(/[\r\n\t]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, AUTH_ERROR_DETAIL_MAX_LENGTH);
};

const formatAuthMessage = (baseMessage: string, detail: string | null): string => {
  const safeDetail = sanitizeAuthErrorDetail(detail);
  const normalizedBaseMessage = baseMessage.trim().replace(/[.:]\s*$/u, '');
  return safeDetail ? `${normalizedBaseMessage}: ${safeDetail}` : baseMessage;
};

const withAuthUiTimeout = async <T,>(task: Promise<T>, message: string): Promise<T> => {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), AUTH_UI_TIMEOUT_MS);
  });

  try {
    return await Promise.race([task, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
};

export const LoginPage = (): JSX.Element => {
  const { t } = useTranslation(['common', 'errors']);
  const location = useLocation();
  const { status, login } = useAuth();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const returnTo = useMemo(() => {
    return resolveReturnTarget(params.get('returnTo'), APP_PATHS.root);
  }, [params]);

  const callbackError = useMemo(() => {
    if (params.get('authError') !== 'callback') {
      return null;
    }

    return formatAuthMessage(t('errors:auth.callbackFailed'), params.get('authErrorDetail'));
  }, [params, t]);

  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

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
    setIsRedirecting(true);
    try {
      await withAuthUiTimeout(login(returnTo), t('errors:auth.loginFailed'));
    } catch (loginError) {
      setError(
        formatAuthMessage(
          t('errors:auth.loginFailed'),
          loginError instanceof Error ? loginError.message : null,
        ),
      );
    } finally {
      setIsRedirecting(false);
    }
  };

  const visibleError = error ?? callbackError;

  return (
    <PageContainer className="max-w-xl pt-16">
      <PageHeader title={t('common:auth.loginTitle')} subtitle={t('common:auth.loginSubtitle')} />
      {visibleError ? <ErrorState title={t('errors:auth.title')} message={visibleError} /> : null}
      <button
        type="button"
        onClick={() => void onLogin()}
        disabled={isRedirecting}
        aria-busy={isRedirecting}
        className="rounded bg-accent px-4 py-2 text-sm font-medium text-white"
      >
        {t('common:actions.login')}
      </button>
    </PageContainer>
  );
};

export const AuthCallbackPage = (): JSX.Element => {
  const { t } = useTranslation(['common', 'errors']);
  const location = useLocation();
  const navigate = useNavigate();
  const { handleCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const hasProcessedCallbackRef = useRef(false);

  useEffect(() => {
    const run = async (): Promise<void> => {
      if (hasProcessedCallbackRef.current) {
        return;
      }
      hasProcessedCallbackRef.current = true;

      const params = new URLSearchParams(location.search);
      const auth0Error = params.get('error');
      if (auth0Error) {
        const loginParams = new URLSearchParams({
          authError: 'callback',
          returnTo: resolveReturnTarget(params.get('returnTo'), APP_PATHS.root),
        });
        const safeDetail = sanitizeAuthErrorDetail(params.get('error_description') ?? auth0Error);
        if (safeDetail) {
          loginParams.set('authErrorDetail', safeDetail);
        }
        navigate(`${APP_PATHS.login}?${loginParams.toString()}`, { replace: true });
        return;
      }

      try {
        const returnTo = await handleCallback();
        navigate(returnTo ?? APP_PATHS.root, { replace: true });
      } catch (callbackError) {
        setError(
          formatAuthMessage(
            t('errors:auth.callbackFailed'),
            callbackError instanceof Error ? callbackError.message : null,
          ),
        );
      }
    };

    void run();
  }, [handleCallback, location.search, navigate, t]);

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
