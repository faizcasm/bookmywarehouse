import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, api } from '../lib/api';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string; form?: string }>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      nextErrors.password = 'Password must be at least 8 characters with a letter and a number';
    }
    if (confirmPassword !== password) nextErrors.confirmPassword = 'Passwords do not match';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    setErrors({});
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors({
          form: error.message,
          password: error.issueFor('password'),
        });
      } else {
        setErrors({ form: 'Unable to reset the password right now.' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page auth-page">
      <div className="card auth-card">
        <h1>Reset your password</h1>
        {!token ? (
          <p className="form-error" role="alert">
            This reset link is missing its token. Request a new link from the{' '}
            <Link to="/forgot-password">forgot password page</Link>.
          </p>
        ) : done ? (
          <>
            <p className="form-success" role="status">
              Your password has been updated. You can sign in now.
            </p>
            <Link to="/login" className="btn btn-primary btn-block">
              Go to sign in
            </Link>
          </>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            {errors.form ? (
              <p className="form-error" role="alert">
                {errors.form}
              </p>
            ) : null}
            <div className="field">
              <label htmlFor="reset-password">New password</label>
              <input
                id="reset-password"
                className={`input ${errors.password ? 'input-invalid' : ''}`}
                type="password"
                autoComplete="new-password"
                value={password}
                aria-invalid={Boolean(errors.password)}
                onChange={(event) => setPassword(event.target.value)}
              />
              {errors.password ? <p className="field-error">{errors.password}</p> : null}
              <p className="field-hint">At least 8 characters, with a letter and a number.</p>
            </div>
            <div className="field">
              <label htmlFor="reset-confirm">Confirm new password</label>
              <input
                id="reset-confirm"
                className={`input ${errors.confirmPassword ? 'input-invalid' : ''}`}
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                aria-invalid={Boolean(errors.confirmPassword)}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              {errors.confirmPassword ? <p className="field-error">{errors.confirmPassword}</p> : null}
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Updating…' : 'Update password'}
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
