import { useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { motion } from 'motion/react';
import { ApiError, api } from '../lib/api';
import { AuthShell } from '../components/AuthShell';

/** Visual-only password strength signal (0–4). Validation stays in onSubmit. */
function scorePassword(value: string): { score: number; label: string } {
  if (!value) return { score: 0, label: '' };
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value) && /\W/.test(value)) score += 1;
  else if (/\d/.test(value) && /[a-zA-Z]/.test(value)) score = Math.min(score, 2);
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score, label: labels[score] };
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [revealPassword, setRevealPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string; form?: string }>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const strength = useMemo(() => scorePassword(password), [password]);

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
    <AuthShell>
      <motion.div
        className="auth-card card"
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >        <h1>Reset your password</h1>
        {!token ? (
          <p className="form-error" role="alert">
            This reset link is missing its token. Request a new link from the{' '}
            <Link to="/forgot-password">forgot password page</Link>.
          </p>
        ) : done ? (
          <div className="auth-success" role="status">
            <span className="auth-success-mark" aria-hidden="true">
              <CheckCircle2 size={30} />
            </span>
            <p className="form-success">Your password has been updated. You can sign in now.</p>
            <Link to="/login" className="btn btn-primary btn-block auth-submit">
              Go to sign in
            </Link>
          </div>
        ) : (
          <>
            <p className="muted auth-subtitle">Choose a strong password — you&apos;ll use it next time you sign in.</p>
            <form onSubmit={onSubmit} noValidate>
              {errors.form ? (
                <p className="form-error" role="alert">
                  {errors.form}
                </p>
              ) : null}
              <div className="field">
                <label htmlFor="reset-password">New password</label>
                <div className="input-wrap">
                  <span className="input-icon" aria-hidden="true">
                    <Lock size={16} />
                  </span>
                  <input
                    id="reset-password"
                    className={`input ${errors.password ? 'input-invalid' : ''}`}
                    type={revealPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    aria-invalid={Boolean(errors.password)}
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
                {errors.password ? <p className="field-error">{errors.password}</p> : null}
                <div className="pw-meter" aria-hidden="true">
                  {[1, 2, 3, 4].map((seg) => (
                    <span
                      key={seg}
                      className={`pw-seg ${strength.score >= seg ? `pw-seg--on pw-strength-${strength.score}` : ''}`}
                    />
                  ))}
                </div>
                {strength.label ? (
                  <span className={`pw-label pw-strength-${strength.score}`}>{strength.label}</span>
                ) : (
                  <p className="field-hint">At least 8 characters, with a letter and a number.</p>
                )}
              </div>
              <div className="field">
                <label htmlFor="reset-confirm">Confirm new password</label>
                <div className="input-wrap">
                  <span className="input-icon" aria-hidden="true">
                    <Lock size={16} />
                  </span>
                  <input
                    id="reset-confirm"
                    className={`input ${errors.confirmPassword ? 'input-invalid' : ''}`}
                    type={revealPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    aria-invalid={Boolean(errors.confirmPassword)}
                    onChange={(event) => setConfirmPassword(event.target.value)}
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
                {errors.confirmPassword ? <p className="field-error">{errors.confirmPassword}</p> : null}
              </div>
              <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="spin" size={16} aria-hidden="true" /> Updating…
                  </>
                ) : (
                  <>Update password</>
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
