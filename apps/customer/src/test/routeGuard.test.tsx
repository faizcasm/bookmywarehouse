import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { RequireAuth } from '../components/RouteGuard';
import { api, getAccessToken } from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      get: vi.fn(),
      post: vi.fn(),
    },
    getAccessToken: vi.fn(() => null),
  };
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={['/bookings?tab=upcoming']}>
      <AuthProvider>
        <LocationProbe />
        <Routes>
          <Route
            path="/bookings"
            element={
              <RequireAuth>
                <div>Protected Bookings</div>
              </RequireAuth>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('RequireAuth route guard', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
  });

  it('redirects unauthenticated users to /login with a next param', async () => {
    vi.mocked(getAccessToken).mockReturnValue(null);
    renderGuarded();

    expect(await screen.findByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Bookings')).not.toBeInTheDocument();
    expect(screen.getByTestId('location').textContent).toBe('/login?next=%2Fbookings%3Ftab%3Dupcoming');
  });

  it('renders protected content for an authenticated user', async () => {
    vi.mocked(getAccessToken).mockReturnValue('token-123');
    vi.mocked(api.get).mockResolvedValue({
      user: {
        id: 'u1',
        email: 'customer@bookmywarehouse.dev',
        name: 'Meera Shah',
        role: 'CUSTOMER',
        emailVerified: true,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
      platform: null,
    });
    renderGuarded();

    expect(await screen.findByText('Protected Bookings')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/auth/me');
  });

  it('shows a loader while the session is booting', async () => {
    vi.mocked(getAccessToken).mockReturnValue('token-123');
    let resolveMe: (value: unknown) => void = () => undefined;
    vi.mocked(api.get).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMe = resolve;
        }) as never,
    );
    renderGuarded();

    expect(await screen.findByText('Checking your session…')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();

    resolveMe({ user: null });
    // after boot resolves with no user the guard must redirect
    expect(await screen.findByText('Login Page', {}, { timeout: 2000 })).toBeInTheDocument();
  });
});
