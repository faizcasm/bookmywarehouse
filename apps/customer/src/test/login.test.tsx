import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { ToastProvider } from '../components/Toast';
import { LoginPage } from '../pages/LoginPage';
import { api } from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
    getAccessToken: vi.fn(() => null),
  };
});

function renderLogin(initialEntry = '/login') {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/bookings" element={<div>Bookings Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </ToastProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
    vi.mocked(api.get).mockResolvedValue(null as never);
  });

  it('shows inline validation errors for an empty form and does not call the API', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('rejects an invalid email address before submitting', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('submits valid credentials to /auth/login and follows the next param', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValue({
      user: {
        id: 'u1',
        email: 'customer@bookmywarehouse.dev',
        name: 'Meera Shah',
        role: 'CUSTOMER',
        emailVerified: true,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
      accessToken: 'test-token',
    });
    renderLogin('/login?next=%2Fbookings');

    await user.type(screen.getByLabelText('Email'), 'customer@bookmywarehouse.dev');
    await user.type(screen.getByLabelText('Password'), 'Demo@1234');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Bookings Page')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      email: 'customer@bookmywarehouse.dev',
      password: 'Demo@1234',
    });
  });

  it('surfaces API error messages on failure', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('../lib/api');
    vi.mocked(api.post).mockRejectedValue(
      new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'),
    );
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'customer@bookmywarehouse.dev');
    await user.type(screen.getByLabelText('Password'), 'wrongpass1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });
});
