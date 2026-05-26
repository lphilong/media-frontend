import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { createAuthAdapter, isAuthConfigurationError } from '@shared/auth/auth-adapter';
import type { AuthSession, AuthStatus } from '@shared/auth/auth-types';
import { setAccessTokenProvider } from '@shared/api/token-provider';

const DEFAULT_AUTH_RETURN_TO = '/';

type AuthContextValue = {
  status: AuthStatus;
  session: AuthSession | null;
  authError: string | null;
  login: (returnTo?: string) => Promise<void>;
  logout: (returnTo?: string) => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  handleCallback: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const adapter = useMemo(() => createAuthAdapter(), []);

  const initialize = useCallback(async () => {
    setStatus('loading');
    try {
      const result = await adapter.initialize();
      if (result.isAuthenticated) {
        setAuthError(null);
        setSession(result.session ?? null);
        setStatus('authenticated');
        return;
      }

      setAuthError(null);
      setSession(null);
      setStatus('unauthenticated');
    } catch (error) {
      setSession(null);
      if (isAuthConfigurationError(error)) {
        setAuthError(error.message);
        setStatus('configurationError');
        return;
      }

      setAuthError(null);
      setStatus('unauthenticated');
      return;
    }
  }, [adapter]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    setAccessTokenProvider(async () => adapter.getAccessToken());
    return () => setAccessTokenProvider(null);
  }, [adapter]);

  const login = useCallback(
    async (returnTo?: string) => {
      await adapter.loginRedirect(returnTo ?? DEFAULT_AUTH_RETURN_TO);
    },
    [adapter],
  );

  const logout = useCallback(
    async (returnTo?: string) => {
      await adapter.logoutRedirect(returnTo ?? '/auth/login');
      setSession(null);
      setStatus('unauthenticated');
    },
    [adapter],
  );

  const handleCallback = useCallback(async () => {
    const returnTo = await adapter.handleCallback(new URL(window.location.href));
    await initialize();
    return returnTo;
  }, [adapter, initialize]);

  const value: AuthContextValue = {
    status,
    session,
    authError,
    login,
    logout,
    getAccessToken: () => adapter.getAccessToken(),
    handleCallback,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
