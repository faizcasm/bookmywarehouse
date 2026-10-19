import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../lib/api';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!email.trim()) nextErrors.email = 'Email is required';
    else if (!EMAIL_PATTERN.test(email.trim())) nextErrors.email = 'Enter a valid email address';
    if (!password) nextErrors.password = 'Password is required';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    setErrors({});
    try {
      await login(email.trim(), password);
      navigate(next || '/', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors({
          form: error.message,
          email: error.issueFor('email'),
          password: error.issueFor('password'),
        });
      } else {
        setErrors({ form: 'Unable to sign in right now. Please try again.' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page auth-page">
      <div className="card auth-card">
        <h1>Sign in</h1>
        <p className="muted">
          Welcome back. Demo account: customer@bookmywarehouse.dev / Demo@1234
        </p>
        <form onSubmit={onSubmit} noValidate>
          {errors.form ? (
            <p className="form-error" role="alert">
              {errors.form}
            </p>
          ) : null}
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className={`input ${errors.email ? 'input-invalid' : ''}`}
              type="email"
              autoComplete="email"
              value={email}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
              onChange={(event) => setEmail(event.target.value)}
            />
            {errors.email ? (
              <p id="login-email-error" className="field-error">
                {errors.email}
              </p>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className={`input ${errors.password ? 'input-invalid' : ''}`}
              type="password"
              autoComplete="current-password"
              value={password}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
              onChange={(event) => setPassword(event.target.value)}
            />
            {errors.password ? (
              <p id="login-password-error" className="field-error">
                {errors.password}
              </p>
            ) : null}
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span>Keep me signed in</span>
          </label>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="auth-links">
          <Link to="/forgot-password">Forgot password?</Link>
          <span>
            New here? <Link to={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}>Create an account</Link>
          </span>
        </div>
        <p className="field-hint">
          <Link to={`/register?role=PARTNER${next ? `&next=${encodeURIComponent(next)}` : ''}`}>
            Are you a partner? List your space →
          </Link>
        </p>
      </div>
    </div>
  );
}
