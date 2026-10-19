import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { validateLogin, type FieldErrors } from '../lib/validation';
import { hasErrors } from '../lib/validation';
import { errorMessage } from '../lib/api';
import { useToast } from '../components/Toast';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    const values = { email, password };
    const validation = validateLogin(values);
    setErrors(validation);
    if (hasErrors(validation)) return;

    setSubmitting(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name.split(' ')[0] ?? user.name}!`);
      navigate(safeNext, { replace: true });
    } catch (error) {
      setFormError(errorMessage(error, 'Sign in failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-card card">
        <div className="auth-card__brand">
          <span className="shell__brand-mark" aria-hidden="true">
            BMW
          </span>
          <div>
            <strong>BookMyWarehouse</strong>
            <span>Partner console</span>
          </div>
        </div>
        <h1 className="auth-card__title">Sign in to your partner account</h1>
        <p className="auth-card__subtitle">
          Manage listings, bookings, payouts and messages. New here?{' '}
          <Link to={next ? `/register?next=${encodeURIComponent(safeNext)}` : '/register'}>Create a partner account</Link>.
        </p>

        <form onSubmit={(event) => void onSubmit(event)} noValidate>
          {formError ? (
            <div className="alert alert--error" role="alert">
              {formError}
            </div>
          ) : null}

          <div className="field">
            <label className="field__label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              className={`input ${errors.email ? 'input--invalid' : ''}`}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="partner@bookmywarehouse.dev"
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email ? <span className="field__error">{errors.email}</span> : null}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              className={`input ${errors.password ? 'input--invalid' : ''}`}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              aria-invalid={Boolean(errors.password)}
            />
            {errors.password ? <span className="field__error">{errors.password}</span> : null}
          </div>

          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth-card__footer">
          Want to book warehouses instead? <a href="http://localhost:5173">Customer app ↗</a>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
