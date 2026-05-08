export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'configurationError';

export type AuthSession = {
  userName?: string;
  capabilityHints: string[];
  expiresAt?: number;
};

export interface AuthAdapter {
  initialize(): Promise<{ isAuthenticated: boolean; session?: AuthSession }>;
  getAccessToken(): Promise<string | null>;
  loginRedirect(returnTo?: string): Promise<void>;
  logoutRedirect(returnTo?: string): Promise<void>;
  handleCallback(url: URL): Promise<string | null>;
}
