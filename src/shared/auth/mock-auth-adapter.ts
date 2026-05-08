import type { AuthAdapter } from '@shared/auth/auth-types';
import { clearStoredToken, readStoredToken, writeStoredToken } from '@shared/auth/storage';

export const createMockAuthAdapter = (): AuthAdapter => {
  return {
    async initialize() {
      const token = readStoredToken();
      if (!token || token.expiresAt < Date.now()) {
        const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
        writeStoredToken({
          accessToken: 'mock-access-token',
          expiresAt,
        });
        return {
          isAuthenticated: true,
          session: {
            capabilityHints: [],
            expiresAt,
          },
        };
      }

      return {
        isAuthenticated: true,
        session: {
          capabilityHints: [],
          expiresAt: token.expiresAt,
        },
      };
    },
    async getAccessToken() {
      const token = readStoredToken();
      if (!token || token.expiresAt < Date.now()) {
        return null;
      }
      return token.accessToken;
    },
    async loginRedirect() {
      return;
    },
    async logoutRedirect(returnTo = '/auth/login') {
      clearStoredToken();
      window.location.assign(returnTo);
    },
    async handleCallback() {
      return null;
    },
  };
};
