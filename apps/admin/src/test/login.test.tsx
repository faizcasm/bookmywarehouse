import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { AuthProvider } from '../auth/AuthContext';
import { ToastProvider } from '../components/Toast';
import { ApiError } from '../lib/api';

const apiSendMock = vi.fn();
const apiGetMock = vi.fn();

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    apiSend: (...args: unknown[]) => apiSendMock(...args),
    apiGet: (...args: unknown[]) => apiGetMock(...args),
    getAccessToken: () => null,
    setAccessToken: vi.fn(),
    setUnauthorizedHandler: vi.fn(),
  };
});

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <ToastProvider>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('LoginPage validation', () => {
  beforeEach(() => {
    apiSendMock.mockReset();
    apiGetMock.mockReset();
  });

  it('shows validation errors for empty fields and does not call the API', async () => {
    renderLogin();
    const submit = screen.getByRole('button', { name: /sign in/i });
    await userEvent.click(submit);

    expect(await screen.findByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(apiSendMock).not.toHaveBeenCalled();
  });

  it('rejects malformed emails', async () => {
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), 'not-an-email');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(apiSendMock).not.toHaveBeenCalled();
  });

  it('submits valid credentials through the API client', async () => {
    apiSendMock.mockResolvedValue({
      user: { id: 'a1', email: 'admin@bookmywarehouse.dev', name: 'Admin', role: 'ADMIN', status: 'ACTIVE', emailVerified: true, createdAt: new Date().toISOString() },
      accessToken: 'tok',
    });

    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), 'admin@bookmywarehouse.dev');
    await userEvent.type(screen.getByLabelText(/password/i), 'Demo@1234');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(apiSendMock).toHaveBeenCalledTimes(1));
    expect(apiSendMock).toHaveBeenCalledWith('POST', '/auth/login', {
      email: 'admin@bookmywarehouse.dev',
      password: 'Demo@1234',
    });
  });

  it('surfaces INVALID_CREDENTIALS as a form-level error', async () => {
    apiSendMock.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'));

    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), 'admin@bookmywarehouse.dev');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument();
  });
});
