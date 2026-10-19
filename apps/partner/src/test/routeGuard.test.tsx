import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { RequireAuth } from '../auth/RouteGuard';
import type { UserDTO } from '../lib/types';

const authState: { user: UserDTO | null; loading: boolean } = { user: null, loading: false };

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => authState,
}));

function renderGuarded(): void {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          element={
            <RequireAuth roles={['PARTNER', 'ADMIN']}>
              <Outlet />
            </RequireAuth>
          }
        >
          <Route path="/" element={<div>dashboard content</div>} />
        </Route>
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const partner: UserDTO = {
  id: 'p1',
  email: 'partner@bookmywarehouse.dev',
  name: 'Partner',
  role: 'PARTNER',
  emailVerified: true,
  status: 'ACTIVE',
  createdAt: new Date().toISOString(),
};

describe('RequireAuth route guard', () => {
  it('shows a loader while the session is being restored', () => {
    authState.user = null;
    authState.loading = true;
    renderGuarded();
    expect(screen.getByRole('status')).toHaveTextContent(/restoring your session/i);
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to /login with a next param', () => {
    authState.user = null;
    authState.loading = false;
    renderGuarded();
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('dashboard content')).not.toBeInTheDocument();
  });

  it('redirects users with the wrong role (CUSTOMER) to /login', () => {
    authState.user = { ...partner, role: 'CUSTOMER' };
    authState.loading = false;
    renderGuarded();
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('dashboard content')).not.toBeInTheDocument();
  });

  it('allows PARTNER users through', () => {
    authState.user = partner;
    authState.loading = false;
    renderGuarded();
    expect(screen.getByText('dashboard content')).toBeInTheDocument();
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
  });

  it('allows ADMIN users through', () => {
    authState.user = { ...partner, role: 'ADMIN' };
    authState.loading = false;
    renderGuarded();
    expect(screen.getByText('dashboard content')).toBeInTheDocument();
  });
});
