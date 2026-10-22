import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { fadeUp, transition } from '@bmw/ui';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../lib/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const next = params.get('next');

  const validate = (): boolean => {
    const nextErrors: typeof errors = {};
    if (!email.trim()) nextErrors.email = 'Email is required.';
    else if (!EMAIL_RE.test(email.trim())) nextErrors.email = 'Enter a valid email address.';
    if (!password) nextErrors.password = 'Password is required.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setErrors({});
    try {
      await login(email.trim(), password);
      navigate(next && next.startsWith('/') ? next : '/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        const field = err.fieldErrors();
        setErrors({
          form: err.code === 'INVALID_CREDENTIALS' ? 'Incorrect email or password.' : err.message,
          email: field.email,
          password: field.password,
        });
      } else {
        setErrors({ form: err instanceof Error ? err.message : 'Sign in failed.' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <motion.form
        className="login-card"
        onSubmit={onSubmit}
        noValidate
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={transition(0.5)}
      >
        <div className="login-card__brand">
          <span className="sidebar__logo" aria-hidden="true">
            BMW
          </span>
          <div>
            <p className="login-card__sub">BookMyWarehouse operations</p>
          </div>
        </div>

        <h1 className="login-card__title">Sign in to the admin console</h1>
        <p className="login-card__lead">
          Restricted access — every sign-in is logged for audit.
        </p>

        {errors.form ? (
          <div className="alert alert--error" role="alert">
            {errors.form}
          </div>
        ) : null}

        <div className="field">
          <label className="field__label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'login-email-error' : undefined}
          />
          {errors.email ? (
            <p id="login-email-error" className="field__error" role="alert">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'login-password-error' : undefined}
          />
          {errors.password ? (
            <p id="login-password-error" className="field__error" role="alert">
              {errors.password}
            </p>
          ) : null}
        </div>

        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </motion.form>
    </div>
  );
}
