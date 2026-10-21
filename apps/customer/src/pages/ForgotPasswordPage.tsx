import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Mail, Send } from 'lucide-react';
import { motion } from 'motion/react';
import { ApiError, api } from '../lib/api';
import { AuthShell } from '../components/AuthShell';

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
    <AuthShell>
      <motion.div
        className="auth-card card"
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >        <h1>Forgot your password?</h1>
        {sent ? (
          <div className="auth-success" role="status">
            <span className="auth-success-mark" aria-hidden="true">
              <CheckCircle2 size={30} />
            </span>
            <p className="form-success">
              If an account exists for that email, a reset link has been sent. Check your inbox
              (and spam folder).
            </p>
            <p className="muted">
              The reset link opens the <Link to={`/reset-password?token=…`}>reset page</Link>. In
              development the token is also printed in the API logs.
            </p>
          </div>
        ) : (
          <>
            <p className="muted auth-subtitle">
              Enter the email on your account and we&apos;ll send a secure reset link.
            </p>
            <form onSubmit={onSubmit} noValidate>
              {error ? (
                <p className="form-error" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="field">
                <label htmlFor="forgot-email">Email</label>
                <div className="input-wrap">
                  <span className="input-icon" aria-hidden="true">
                    <Mail size={16} />
                  </span>
                  <input
                    id="forgot-email"
                    className={`input ${fieldError ? 'input-invalid' : ''}`}
                    type="email"
                    autoComplete="email"
                    value={email}
                    aria-invalid={Boolean(fieldError)}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                {fieldError ? <p className="field-error">{fieldError}</p> : null}
              </div>
              <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="spin" size={16} aria-hidden="true" /> Sending…
                  </>
                ) : (
                  <>
                    Send reset link <Send size={15} aria-hidden="true" />
                  </>
                )}
              </button>
            </form>
          </>
        )}
        <div className="auth-links">
          <Link to="/login">
            <ArrowLeft size={14} aria-hidden="true" /> Back to sign in
          </Link>
        </div>
      </motion.div>
    </AuthShell>
  );
}
