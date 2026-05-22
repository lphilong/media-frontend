import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi } from 'vitest';

import { AuthCallbackPage, LoginPage } from '@app/router/system-pages';
import { setLocale } from '@shared/i18n/i18n';

const useAuthMock = vi.fn();

vi.mock('@shared/auth/auth-context', () => ({
  useAuth: () => useAuthMock(),
}));

const LocationProbe = (): JSX.Element => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

describe('auth system pages', () => {
  beforeEach(async () => {
    await setLocale('en');
  });

  afterEach(() => {
    useAuthMock.mockReset();
  });

  it('preserves a safe returnTo when login redirect fails', async () => {
    const login = vi.fn().mockRejectedValue(new Error('network unavailable'));
    useAuthMock.mockReturnValue({
      status: 'unauthenticated',
      login,
    });

    render(
      <MemoryRouter initialEntries={['/auth/login?returnTo=%2Fusers%3Fstatus%3DACTIVE']}>
        <Routes>
          <Route path="/auth/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: /login/i }));

    expect(login).toHaveBeenCalledWith('/users?status=ACTIVE');
    expect(await screen.findByText(/Login redirect failed: network unavailable/i)).toBeVisible();
  });

  it('shows the required Auth0 audience in the login configuration diagnostic', () => {
    useAuthMock.mockReturnValue({
      status: 'configurationError',
      login: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <Routes>
          <Route path="/auth/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/VITE_AUTH0_AUDIENCE/)).toBeVisible();
  });

  it('processes a successful callback once and navigates to the safe return target', async () => {
    const handleCallback = vi.fn().mockResolvedValue('/users?status=ACTIVE');
    useAuthMock.mockReturnValue({ handleCallback });

    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/auth/callback?code=abc&state=def']}>
          <Routes>
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/users" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/users?status=ACTIVE');
    });
    expect(handleCallback).toHaveBeenCalledTimes(1);
  });

  it('redirects Auth0 callback URL errors to login without calling the SDK callback handler', async () => {
    const handleCallback = vi.fn();
    useAuthMock.mockReturnValue({
      status: 'unauthenticated',
      login: vi.fn(),
      handleCallback,
    });

    render(
      <MemoryRouter
        initialEntries={[
          '/auth/callback?error=access_denied&error_description=Callback%20URL%20mismatch',
        ]}
      >
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/auth/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Unable to process auth callback: Callback URL mismatch/i),
    ).toBeVisible();
    expect(handleCallback).not.toHaveBeenCalled();
  });

  it('sanitizes callback error returnTo before routing back to login', async () => {
    const handleCallback = vi.fn();
    useAuthMock.mockReturnValue({
      status: 'unauthenticated',
      login: vi.fn(),
      handleCallback,
    });

    render(
      <MemoryRouter
        initialEntries={[
          '/auth/callback?error=access_denied&error_description=Login%20cancelled&returnTo=https%3A%2F%2Fexample.com%2Fhijack',
        ]}
      >
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/auth/login" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/auth/login?');
    });
    expect(screen.getByTestId('location')).toHaveTextContent('returnTo=%2Fdashboard');
    expect(screen.getByTestId('location')).not.toHaveTextContent('example.com');
    expect(handleCallback).not.toHaveBeenCalled();
  });

  it('keeps callback failures on the callback page instead of silently looping', async () => {
    const handleCallback = vi.fn().mockRejectedValue(new Error('invalid state'));
    useAuthMock.mockReturnValue({ handleCallback });

    render(
      <MemoryRouter initialEntries={['/auth/callback?code=abc&state=def']}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/dashboard" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(handleCallback).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(/Unable to process auth callback: invalid state/i),
    ).toBeVisible();
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
  });
});
