import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../auth/AuthContext';
import { validateRegister, hasErrors, type FieldErrors } from '../lib/validation';
import { errorMessage } from '../lib/api';
import { CUSTOMER_APP_URL } from '../lib/app-links';
import { useToast } from '../components/Toast';
import { AuthShell } from '../components/AuthShell';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    const values = { name, email, password, phone, businessName };
    const validation = validateRegister(values);
    setErrors(validation);
    if (hasErrors(validation)) return;

    setSubmitting(true);
    try {
      await register({ name, email, password, phone: phone || undefined, businessName: businessName || undefined });
      toast.success('Partner account created — finish onboarding next.');
      navigate(safeNext === '/' ? '/onboarding' : safeNext, { replace: true });
    } catch (error) {
      setFormError(errorMessage(error, 'Registration failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <motion.div
        className="auth-card card"
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="auth-card__brand">
          <span className="shell__brand-mark" aria-hidden="true">
            BMW
          </span>
          <div>
            <strong>BookMyWarehouse</strong>
            <span>Partner console</span>
          </div>
        </div>
        <h1 className="auth-card__title">Create a partner account</h1>
        <p className="auth-card__subtitle">
          List your warehouses, equipment or services on the marketplace. Already registered?{' '}
          <Link to={next ? `/login?next=${encodeURIComponent(safeNext)}` : '/login'}>Sign in</Link>.
        </p>

        <form onSubmit={(event) => void onSubmit(event)} noValidate>
          {formError ? (
            <div className="alert alert--error" role="alert">
              {formError}
            </div>
          ) : null}

          <div className="field">
            <label className="field__label" htmlFor="reg-name">
              Full name
            </label>
            <input
              id="reg-name"
              className={`input ${errors.name ? 'input--invalid' : ''}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name ? <span className="field__error">{errors.name}</span> : null}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="reg-email">
              Email
            </label>
            <input
              id="reg-email"
              type="email"
              className={`input ${errors.email ? 'input--invalid' : ''}`}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email ? <span className="field__error">{errors.email}</span> : null}
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field__label" htmlFor="reg-password">
                Password
              </label>
              <input
                id="reg-password"
                type="password"
                className={`input ${errors.password ? 'input--invalid' : ''}`}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
              />
              {errors.password ? <span className="field__error">{errors.password}</span> : <span className="field__hint">8+ characters with a letter and a number</span>}
            </div>
            <div className="field">
              <label className="field__label" htmlFor="reg-phone">
                Phone (optional)
              </label>
              <input
                id="reg-phone"
                className={`input ${errors.phone ? 'input--invalid' : ''}`}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+91 98765 43210"
                aria-invalid={Boolean(errors.phone)}
              />
              {errors.phone ? <span className="field__error">{errors.phone}</span> : null}
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="reg-business">
              Business name (optional)
            </label>
            <input
              id="reg-business"
              className={`input ${errors.businessName ? 'input--invalid' : ''}`}
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              placeholder="SwiftStow Logistics"
              aria-invalid={Boolean(errors.businessName)}
            />
            {errors.businessName ? <span className="field__error">{errors.businessName}</span> : null}
          </div>

          <div className="alert alert--info">
            You are registering as a <strong>warehouse partner</strong>. You can complete KYC verification after signing up.
          </div>

          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create partner account'}
          </button>
        </form>

        <p className="auth-card__footer">
          Want to book warehouses instead? <a href={CUSTOMER_APP_URL}>Customer app ↗</a>
        </p>
      </motion.div>
    </AuthShell>
  );
}

export default RegisterPage;