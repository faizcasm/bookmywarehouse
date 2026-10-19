import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api } from '../lib/api';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!EMAIL_PATTERN.test(email.trim())) {
      setFieldError('Enter a valid email address');
      return;
    }
    setFieldError(null);
    setBusy(true);
    setError(null);
    try {
      await api.post<{ message: string }>('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldError(err.issueFor('email') ?? null);
      } else {
        setError('Unable to send the reset request right now.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page auth-page">
      <div className="card auth-card">
        <h1>Forgot your password?</h1>
        {sent ? (
          <>
            <p className="form-success" role="status">
              If an account exists for that email, a reset link has been sent. Check your inbox
              (and spam folder).
            </p>
            <p className="muted">
              The reset link opens the <Link to={`/reset-password?token=…`}>reset page</Link>. In
              development the token is also printed in the API logs.
            </p>
          </>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="field">
              <label htmlFor="forgot-email">Email</label>
              <input
                id="forgot-email"
                className={`input ${fieldError ? 'input-invalid' : ''}`}
                type="email"
                autoComplete="email"
                value={email}
                aria-invalid={Boolean(fieldError)}
                onChange={(event) => setEmail(event.target.value)}
              />
              {fieldError ? <p className="field-error">{fieldError}</p> : null}
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
        <div className="auth-links">
          <Link to="/login">← Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
