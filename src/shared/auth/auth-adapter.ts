import { createAuth0Adapter } from '@shared/auth/auth0-adapter';
import { createMockAuthAdapter } from '@shared/auth/mock-auth-adapter';
import type { AuthAdapter } from '@shared/auth/auth-types';
import { env } from '@shared/config/env';

export class AuthConfigurationError extends Error {
  constructor() {
    super('Auth0 config is missing. Set VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID.');
    this.name = 'AuthConfigurationError';
  }
}

export const isAuthConfigurationError = (error: unknown): error is AuthConfigurationError => {
  return error instanceof AuthConfigurationError;
};

const hasAuth0Config = (): boolean => {
  return Boolean(env.VITE_AUTH0_DOMAIN?.trim() && env.VITE_AUTH0_CLIENT_ID?.trim());
};

const createConfigurationErrorAdapter = (): AuthAdapter => {
  const reject = async (): Promise<never> => {
    throw new AuthConfigurationError();
  };

  return {
    initialize: reject,
    async getAccessToken() {
      return null;
    },
    loginRedirect: reject,
    async logoutRedirect(returnTo = '/auth/login') {
      window.location.assign(returnTo);
    },
    handleCallback: reject,
  };
};

export const createAuthAdapter = (): AuthAdapter => {
  if (env.VITE_AUTH_MODE === 'auth0') {
    if (!hasAuth0Config()) {
      return createConfigurationErrorAdapter();
    }

    return createAuth0Adapter();
  }

  return createMockAuthAdapter();
};
