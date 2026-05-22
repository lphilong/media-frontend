import { createAuth0Adapter } from '@shared/auth/auth0-adapter';
import { createMockAuthAdapter } from '@shared/auth/mock-auth-adapter';
import type { AuthAdapter } from '@shared/auth/auth-types';
import { env, getAuth0ConfigIssue } from '@shared/config/env';

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthConfigurationError';
  }
}

export const isAuthConfigurationError = (error: unknown): error is AuthConfigurationError => {
  return error instanceof AuthConfigurationError;
};

const createConfigurationErrorAdapter = (message: string): AuthAdapter => {
  const reject = async (): Promise<never> => {
    throw new AuthConfigurationError(message);
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
    const configIssue = getAuth0ConfigIssue(env);
    if (configIssue) {
      return createConfigurationErrorAdapter(configIssue);
    }

    return createAuth0Adapter();
  }

  return createMockAuthAdapter();
};
