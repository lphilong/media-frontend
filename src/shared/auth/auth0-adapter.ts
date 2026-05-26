import { createAuth0Client, type Auth0Client } from '@auth0/auth0-spa-js';

import { env } from '@shared/config/env';
import type { AuthAdapter } from '@shared/auth/auth-types';
import { resolveReturnTarget } from '@shared/auth/return-target';

const AUTH_SCOPE = 'openid profile email offline_access';
const AUTH_CALLBACK_PATH = '/auth/callback';
const SILENT_RESTORE_UNAUTHENTICATED_ERRORS = new Set([
  'login_required',
  'consent_required',
  'interaction_required',
]);

const requireAuth0Config = (): { domain: string; clientId: string; audience: string } => {
  if (!env.VITE_AUTH0_DOMAIN || !env.VITE_AUTH0_CLIENT_ID || !env.VITE_AUTH0_AUDIENCE) {
    throw new Error(
      'Auth0 config is missing. Set VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID, and VITE_AUTH0_AUDIENCE.',
    );
  }

  return {
    domain: env.VITE_AUTH0_DOMAIN,
    clientId: env.VITE_AUTH0_CLIENT_ID,
    audience: env.VITE_AUTH0_AUDIENCE,
  };
};

const resolveUserName = (user: Awaited<ReturnType<Auth0Client['getUser']>>): string | undefined => {
  if (!user) {
    return undefined;
  }

  if (typeof user.name === 'string' && user.name.length > 0) {
    return user.name;
  }

  if (typeof user.email === 'string' && user.email.length > 0) {
    return user.email;
  }

  return undefined;
};

const readAuthErrorCode = (error: unknown): string | null => {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const { error: errorCode } = error as { error?: unknown };
  return typeof errorCode === 'string' ? errorCode : null;
};

const isSilentRestoreUnauthenticatedError = (error: unknown): boolean => {
  const errorCode = readAuthErrorCode(error);
  return errorCode !== null && SILENT_RESTORE_UNAUTHENTICATED_ERRORS.has(errorCode);
};

const isAuthCallbackRoute = (): boolean => {
  return window.location.pathname === AUTH_CALLBACK_PATH;
};

export const createAuth0Adapter = (): AuthAdapter => {
  const config = requireAuth0Config();
  let clientPromise: Promise<Auth0Client> | null = null;

  const getClient = (): Promise<Auth0Client> => {
    if (clientPromise) {
      return clientPromise;
    }

    clientPromise = createAuth0Client({
      domain: config.domain,
      clientId: config.clientId,
      authorizationParams: {
        audience: config.audience,
        scope: AUTH_SCOPE,
      },
      cacheLocation: 'memory',
      useRefreshTokens: true,
      useRefreshTokensFallback: true,
    });
    return clientPromise;
  };

  const getSession = async (client: Auth0Client) => {
    const token = await client.getTokenSilently({ detailedResponse: true });
    const user = await client.getUser();
    const expiresAt = Date.now() + token.expires_in * 1000;

    return {
      userName: resolveUserName(user),
      capabilityHints: [],
      expiresAt,
    };
  };

  return {
    async initialize() {
      const client = await getClient();
      const isAuthenticated = await client.isAuthenticated();
      if (!isAuthenticated) {
        if (!isAuthCallbackRoute()) {
          try {
            return {
              isAuthenticated: true,
              session: await getSession(client),
            };
          } catch (error) {
            if (!isSilentRestoreUnauthenticatedError(error)) {
              throw error;
            }
          }
        }

        return {
          isAuthenticated: false,
        };
      }

      try {
        return {
          isAuthenticated: true,
          session: await getSession(client),
        };
      } catch {
        return {
          isAuthenticated: false,
        };
      }
    },
    async getAccessToken() {
      const client = await getClient();

      try {
        const token = await client.getTokenSilently({ detailedResponse: true });
        return token.access_token;
      } catch {
        return null;
      }
    },
    async loginRedirect(returnTo = '/') {
      const client = await getClient();
      await client.loginWithRedirect({
        appState: {
          returnTo: resolveReturnTarget(returnTo),
        },
        authorizationParams: {
          redirect_uri: `${window.location.origin}/auth/callback`,
        },
      });
    },
    async logoutRedirect(returnTo = '/') {
      const client = await getClient();
      await client.logout({
        logoutParams: {
          returnTo: `${window.location.origin}${resolveReturnTarget(returnTo, '/')}`,
        },
      });
    },
    async handleCallback(url) {
      const client = await getClient();
      const { appState } = await client.handleRedirectCallback(url.toString());
      return resolveReturnTarget(typeof appState?.returnTo === 'string' ? appState.returnTo : null);
    },
  };
};
