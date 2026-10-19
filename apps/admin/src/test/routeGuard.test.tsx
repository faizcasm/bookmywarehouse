import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { RequireAdmin } from '../auth/RouteGuard';
import type { AuthUser } from '../lib/types';

const apiGetMock = vi.fn();
let accessToken: string | null = null;

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    apiGet: (...args: unknown[]) => apiGetMock(...args),
    apiSend: vi.fn(),
    getAccessToken: () => accessToken,
    setAccessToken: vi.fn((t: string | null) => {
      accessToken = t;
    }),
    setUnauthorizedHandler: vi.fn(),
  };
});

const ADMIN: AuthUser = {
  id: 'admin-1',
  email: 'admin@bookmywarehouse.dev',
  name: 'Demo Administrator',
  role: 'ADMIN',
  emailVerified: true,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const CUSTOMER: AuthUser = {
  ...ADMIN,
  id: 'cust-1',
  email: 'customer@bookmywarehouse.dev',
  name: 'Demo Customer',
  role: 'CUSTOMER',
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={['/users?page=2']}>
      <AuthProvider>
        <Routes>
          <Route element={<RequireAdmin />}>
            <Route
              path="/users"
              element={
                <>
                  <div>Users area</div>
                  <LocationProbe />
                </>
              }
            />
          </Route>
          <Route
            path="/login"
            element={
              <>
                <div>Login page</div>
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('RequireAdmin route guard', () => {
  it('renders the guarded route for an ADMIN session', async () => {
    accessToken = 'tok';
    apiGetMock.mockResolvedValue({ user: ADMIN, profile: null, platform: null });
    renderGuarded();

    expect(await screen.findByText('Users area')).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated visitors to /login with a next param', async () => {
    accessToken = null;
    apiGetMock.mockReset();
    renderGuarded();

    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(screen.getByTestId('location').textContent).toBe('/login?next=%2Fusers%3Fpage%3D2');
    expect(screen.queryByText('Users area')).not.toBeInTheDocument();
  });

  it('redirects non-ADMIN users to /login', async () => {
    accessToken = 'tok';
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue({ user: CUSTOMER, profile: null, platform: null });
    renderGuarded();

    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Users area')).not.toBeInTheDocument();
  });
});
