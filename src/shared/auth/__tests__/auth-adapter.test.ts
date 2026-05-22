import { createAuth0Client } from '@auth0/auth0-spa-js';
import { vi } from 'vitest';

vi.mock('@auth0/auth0-spa-js', () => ({
  createAuth0Client: vi.fn(),
}));

const importAuthModulesWithEnv = async (source: Record<string, string>) => {
  vi.resetModules();
  vi.unstubAllEnvs();

  for (const [key, value] of Object.entries(source)) {
    vi.stubEnv(key, value);
  }

  const [authAdapterModule, auth0AdapterModule] = await Promise.all([
    import('@shared/auth/auth-adapter'),
    import('@shared/auth/auth0-adapter'),
  ]);

  return {
    createAuthAdapter: authAdapterModule.createAuthAdapter,
    createAuth0Adapter: auth0AdapterModule.createAuth0Adapter,
  };
};

describe('auth adapter configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(createAuth0Client).mockReset();
    window.history.pushState({}, '', '/');
  });

  it('refuses to create the Auth0 adapter when the audience is missing', async () => {
    const { createAuth0Adapter } = await importAuthModulesWithEnv({
      VITE_AUTH_MODE: 'auth0',
      VITE_AUTH0_DOMAIN: 'tenant.example.test',
      VITE_AUTH0_CLIENT_ID: 'client-id',
      VITE_AUTH0_AUDIENCE: '',
    });

    expect(() => createAuth0Adapter()).toThrow(/VITE_AUTH0_AUDIENCE/);
    expect(createAuth0Client).not.toHaveBeenCalled();
  });

  it('returns a configuration-error adapter when Auth0 mode is missing the audience', async () => {
    const { createAuthAdapter } = await importAuthModulesWithEnv({
      VITE_AUTH_MODE: 'auth0',
      VITE_AUTH0_DOMAIN: 'tenant.example.test',
      VITE_AUTH0_CLIENT_ID: 'client-id',
      VITE_AUTH0_AUDIENCE: '',
    });

    const adapter = createAuthAdapter();

    await expect(adapter.initialize()).rejects.toMatchObject({
      name: 'AuthConfigurationError',
      message: expect.stringContaining('VITE_AUTH0_AUDIENCE'),
    });
    expect(createAuth0Client).not.toHaveBeenCalled();
  });

  it('does not require Auth0 audience in mock mode', async () => {
    const { createAuthAdapter } = await importAuthModulesWithEnv({
      VITE_AUTH_MODE: 'mock',
      VITE_AUTH0_DOMAIN: '',
      VITE_AUTH0_CLIENT_ID: '',
      VITE_AUTH0_AUDIENCE: '',
    });

    const adapter = createAuthAdapter();

    await expect(adapter.loginRedirect('/dashboard')).resolves.toBeUndefined();
    expect(createAuth0Client).not.toHaveBeenCalled();
  });

  it('passes the full callback URL to the Auth0 SDK and returns safe appState returnTo', async () => {
    const { createAuth0Adapter } = await importAuthModulesWithEnv({
      VITE_AUTH_MODE: 'auth0',
      VITE_AUTH0_DOMAIN: 'tenant.example.test',
      VITE_AUTH0_CLIENT_ID: 'client-id',
      VITE_AUTH0_AUDIENCE: 'https://api.example.test',
    });
    const handleRedirectCallback = vi
      .fn()
      .mockResolvedValue({ appState: { returnTo: '/users?status=ACTIVE' } });
    vi.mocked(createAuth0Client).mockResolvedValue({
      handleRedirectCallback,
    } as never);

    const adapter = createAuth0Adapter();
    const returnTo = await adapter.handleCallback(
      new URL('http://localhost:5173/auth/callback?code=redacted&state=redacted'),
    );

    expect(handleRedirectCallback).toHaveBeenCalledWith(
      'http://localhost:5173/auth/callback?code=redacted&state=redacted',
    );
    expect(returnTo).toBe('/users?status=ACTIVE');
  });

  it('falls back when Auth0 appState contains an unsafe returnTo', async () => {
    const { createAuth0Adapter } = await importAuthModulesWithEnv({
      VITE_AUTH_MODE: 'auth0',
      VITE_AUTH0_DOMAIN: 'tenant.example.test',
      VITE_AUTH0_CLIENT_ID: 'client-id',
      VITE_AUTH0_AUDIENCE: 'https://api.example.test',
    });
    vi.mocked(createAuth0Client).mockResolvedValue({
      handleRedirectCallback: vi
        .fn()
        .mockResolvedValue({ appState: { returnTo: 'https://example.com/hijack' } }),
    } as never);

    const adapter = createAuth0Adapter();

    await expect(
      adapter.handleCallback(
        new URL('http://localhost:5173/auth/callback?code=redacted&state=redacted'),
      ),
    ).resolves.toBe('/dashboard');
  });

  it('attempts silent restore during initialization when the memory cache is empty', async () => {
    window.history.pushState({}, '', '/dashboard');
    const { createAuth0Adapter } = await importAuthModulesWithEnv({
      VITE_AUTH_MODE: 'auth0',
      VITE_AUTH0_DOMAIN: 'tenant.example.test',
      VITE_AUTH0_CLIENT_ID: 'client-id',
      VITE_AUTH0_AUDIENCE: 'https://api.example.test',
    });
    const getTokenSilently = vi.fn().mockResolvedValue({
      access_token: 'redacted-access-token',
      expires_in: 3600,
    });
    const getUser = vi.fn().mockResolvedValue({ name: 'Auth0 Admin' });
    vi.mocked(createAuth0Client).mockResolvedValue({
      isAuthenticated: vi.fn().mockResolvedValue(false),
      getTokenSilently,
      getUser,
    } as never);

    const adapter = createAuth0Adapter();

    await expect(adapter.initialize()).resolves.toMatchObject({
      isAuthenticated: true,
      session: {
        userName: 'Auth0 Admin',
        capabilityHints: [],
      },
    });
    expect(getTokenSilently).toHaveBeenCalledWith({ detailedResponse: true });
    expect(getUser).toHaveBeenCalled();
  });

  it('treats login_required from silent restore as unauthenticated', async () => {
    window.history.pushState({}, '', '/dashboard');
    const { createAuth0Adapter } = await importAuthModulesWithEnv({
      VITE_AUTH_MODE: 'auth0',
      VITE_AUTH0_DOMAIN: 'tenant.example.test',
      VITE_AUTH0_CLIENT_ID: 'client-id',
      VITE_AUTH0_AUDIENCE: 'https://api.example.test',
    });
    const getUser = vi.fn();
    vi.mocked(createAuth0Client).mockResolvedValue({
      isAuthenticated: vi.fn().mockResolvedValue(false),
      getTokenSilently: vi.fn().mockRejectedValue({
        error: 'login_required',
        error_description: 'Login required',
      }),
      getUser,
    } as never);

    const adapter = createAuth0Adapter();

    await expect(adapter.initialize()).resolves.toEqual({ isAuthenticated: false });
    expect(getUser).not.toHaveBeenCalled();
  });

  it('leaves callback initialization to the callback flow instead of explicit silent restore', async () => {
    window.history.pushState({}, '', '/auth/callback?code=abc&state=def');
    const { createAuth0Adapter } = await importAuthModulesWithEnv({
      VITE_AUTH_MODE: 'auth0',
      VITE_AUTH0_DOMAIN: 'tenant.example.test',
      VITE_AUTH0_CLIENT_ID: 'client-id',
      VITE_AUTH0_AUDIENCE: 'https://api.example.test',
    });
    const getTokenSilently = vi.fn();
    vi.mocked(createAuth0Client).mockResolvedValue({
      isAuthenticated: vi.fn().mockResolvedValue(false),
      getTokenSilently,
    } as never);

    const adapter = createAuth0Adapter();

    await expect(adapter.initialize()).resolves.toEqual({ isAuthenticated: false });
    expect(getTokenSilently).not.toHaveBeenCalled();
  });
});
