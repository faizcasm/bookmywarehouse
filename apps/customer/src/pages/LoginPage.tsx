import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, Lock, Mail } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../lib/api';
import { AuthShell } from '../components/AuthShell';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [revealPassword, setRevealPassword] = useState(false);
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
    <AuthShell>
      <motion.div
        className="auth-card card"
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >        <h1>Sign in</h1>
        <p className="muted auth-subtitle">
          Welcome back — your quotes, bookings and invoices are one tap away.
        </p>
        <form onSubmit={onSubmit} noValidate>
          {errors.form ? (
            <p className="form-error" role="alert">
              {errors.form}
            </p>
          ) : null}
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <div className="input-wrap">
              <span className="input-icon" aria-hidden="true">
                <Mail size={16} />
              </span>
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
            </div>
            {errors.email ? (
              <p id="login-email-error" className="field-error">
                {errors.email}
              </p>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <div className="input-wrap">
              <span className="input-icon" aria-hidden="true">
                <Lock size={16} />
              </span>
              <input
                id="login-password"
                className={`input ${errors.password ? 'input-invalid' : ''}`}
                type={revealPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'login-password-error' : undefined}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className="input-action"
                aria-label={revealPassword ? 'Hide password' : 'Show password'}
                onClick={() => setRevealPassword((v) => !v)}
              >
                {revealPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
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
          <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="spin" size={16} aria-hidden="true" /> Signing in…
              </>
            ) : (
              <>
                Sign in <ArrowRight size={16} aria-hidden="true" />
              </>
            )}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/forgot-password">
            <KeyRound size={14} aria-hidden="true" /> Forgot password?
          </Link>
          <span>
            New here?{' '}
            <Link to={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}>
              Create an account
            </Link>
          </span>
        </div>
        <p className="field-hint">
          <Link to={`/register?role=PARTNER${next ? `&next=${encodeURIComponent(next)}` : ''}`}>
            Are you a partner? List your space →
          </Link>
        </p>
      </motion.div>
    </AuthShell>
  );
}
