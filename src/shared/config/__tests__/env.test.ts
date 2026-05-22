import { getAuth0ConfigIssue, parseFrontendEnv } from '@shared/config/env';

describe('frontend auth env config', () => {
  it('does not require Auth0 fields in mock mode', () => {
    const parsed = parseFrontendEnv({
      VITE_AUTH_MODE: 'mock',
      VITE_API_BASE_URL: 'http://localhost:10000',
    });

    expect(getAuth0ConfigIssue(parsed)).toBeNull();
  });

  it('requires Auth0 domain, client ID, and audience in Auth0 mode', () => {
    const parsed = parseFrontendEnv({
      VITE_AUTH_MODE: 'auth0',
      VITE_API_BASE_URL: 'http://localhost:10000',
      VITE_AUTH0_DOMAIN: 'auth.example.test',
    });

    expect(getAuth0ConfigIssue(parsed)).toContain('VITE_AUTH0_CLIENT_ID, VITE_AUTH0_AUDIENCE');
  });

  it('treats blank Auth0 values as missing', () => {
    const parsed = parseFrontendEnv({
      VITE_AUTH_MODE: 'auth0',
      VITE_API_BASE_URL: 'http://localhost:10000',
      VITE_AUTH0_DOMAIN: '   ',
      VITE_AUTH0_CLIENT_ID: 'client-id',
      VITE_AUTH0_AUDIENCE: '',
    });

    expect(getAuth0ConfigIssue(parsed)).toContain('VITE_AUTH0_DOMAIN, VITE_AUTH0_AUDIENCE');
  });
});
