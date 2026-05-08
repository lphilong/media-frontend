import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { vi } from 'vitest';

import { RequireAuth } from '@app/guards/RequireAuth';

const useAuthMock = vi.fn();

vi.mock('@shared/auth/auth-context', () => ({
  useAuth: () => useAuthMock(),
}));

const LocationProbe = (): JSX.Element => {
  const location = useLocation();

  return (
    <div data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</div>
  );
};

describe('RequireAuth', () => {
  afterEach(() => {
    useAuthMock.mockReset();
  });

  it('redirects unauthenticated users to login with a safe return target', async () => {
    useAuthMock.mockReturnValue({ status: 'unauthenticated' });

    render(
      <MemoryRouter initialEntries={['/revenue-ledger?status=DRAFT#current']}>
        <Routes>
          <Route path="/auth/login" element={<LocationProbe />} />
          <Route
            path="*"
            element={
              <RequireAuth>
                <div>protected content</div>
              </RequireAuth>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/auth/login?returnTo=%2Frevenue-ledger%3Fstatus%3DDRAFT%23current',
      );
    });
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });
});
