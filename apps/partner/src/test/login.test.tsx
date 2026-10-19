import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/Login';
import { ToastProvider } from '../components/Toast';

const loginMock = vi.fn();

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false, login: loginMock }),
}));

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      get: vi.fn().mockResolvedValue({}),
      post: vi.fn().mockResolvedValue({}),
    },
  };
});

function renderLogin(): void {
  render(
    <MemoryRouter>
      <ToastProvider>
        <LoginPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('LoginPage validation', () => {
  beforeEach(() => {
    loginMock.mockReset();
    loginMock.mockResolvedValue({ name: 'Asha Verma', role: 'PARTNER' });
  });

  it('shows required errors and does not call the API when fields are empty', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid email format', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/password/i), 'Demo@1234');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('submits valid credentials to auth.login', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), 'partner@bookmywarehouse.dev');
    await user.type(screen.getByLabelText(/password/i), 'Demo@1234');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/welcome back/i)).toBeInTheDocument();
    expect(loginMock).toHaveBeenCalledWith('partner@bookmywarehouse.dev', 'Demo@1234');
  });

  it('surfaces API error messages', async () => {
    loginMock.mockRejectedValueOnce(new Error('Invalid email or password'));
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/email/i), 'partner@bookmywarehouse.dev');
    await user.type(screen.getByLabelText(/password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });
});
