import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PARTNER_APP_URL, useAuth } from '../auth/AuthContext';
import { ApiError } from '../lib/api';
import { useToast } from '../components/Toast';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+0-9][0-9 -]{7,16}$/;

interface FieldErrors {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  businessName?: string;
  form?: string;
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');
  const [role, setRole] = useState<'CUSTOMER' | 'PARTNER'>(
    searchParams.get('role') === 'PARTNER' ? 'PARTNER' : 'CUSTOMER',
  );

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (!name.trim() || name.trim().length < 2) nextErrors.name = 'Name must be at least 2 characters';
    if (!EMAIL_PATTERN.test(email.trim())) nextErrors.email = 'Enter a valid email address';
    if (phone.trim() && !PHONE_PATTERN.test(phone.trim())) nextErrors.phone = 'Enter a valid phone number';
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      nextErrors.password = 'Password must be at least 8 characters with a letter and a number';
    }
    if (confirmPassword !== password) nextErrors.confirmPassword = 'Passwords do not match';
    if (role === 'PARTNER' && businessName.trim().length < 2) {
      nextErrors.businessName = 'Business name is required';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    setErrors({});
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        phone: phone.trim() || null,
        businessName: role === 'PARTNER' ? businessName.trim() : null,
      });
      if (role === 'PARTNER') {
        toast.push('Partner account created! Finish onboarding in the partner portal.', 'success');
        window.location.assign(PARTNER_APP_URL);
        return;
      }
      toast.push('Account created — welcome aboard!', 'success');
      navigate(next || '/', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors({
          form: error.message,
          name: error.issueFor('name'),
          email: error.issueFor('email'),
          phone: error.issueFor('phone'),
          password: error.issueFor('password'),
          businessName: error.issueFor('businessName'),
        });
      } else {
        setErrors({ form: 'Unable to create the account right now. Please try again.' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page auth-page">
      <div className="card auth-card">
        <h1>Create your account</h1>
        <p className="muted">Book warehouses, hire equipment and request logistics services.</p>

        <fieldset className="role-picker">
          <legend>I am joining as</legend>
          <label className={`role-option ${role === 'CUSTOMER' ? 'is-active' : ''}`}>
            <input
              type="radio"
              name="role"
              value="CUSTOMER"
              checked={role === 'CUSTOMER'}
              onChange={() => setRole('CUSTOMER')}
            />
            <span>
              <strong>Customer</strong>
              <small>Find and book space, equipment &amp; services</small>
            </span>
          </label>
          <label className={`role-option ${role === 'PARTNER' ? 'is-active' : ''}`}>
            <input
              type="radio"
              name="role"
              value="PARTNER"
              checked={role === 'PARTNER'}
              onChange={() => setRole('PARTNER')}
            />
            <span>
              <strong>Partner</strong>
              <small>List your warehouse, equipment or services</small>
            </span>
          </label>
        </fieldset>

        <form onSubmit={onSubmit} noValidate>
          {errors.form ? (
            <p className="form-error" role="alert">
              {errors.form}
            </p>
          ) : null}
          {role === 'PARTNER' ? (
            <div className="field">
              <label htmlFor="reg-business">Business name</label>
              <input
                id="reg-business"
                className={`input ${errors.businessName ? 'input-invalid' : ''}`}
                type="text"
                value={businessName}
                aria-invalid={Boolean(errors.businessName)}
                onChange={(event) => setBusinessName(event.target.value)}
              />
              {errors.businessName ? <p className="field-error">{errors.businessName}</p> : null}
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="reg-name">Full name</label>
            <input
              id="reg-name"
              className={`input ${errors.name ? 'input-invalid' : ''}`}
              type="text"
              autoComplete="name"
              value={name}
              aria-invalid={Boolean(errors.name)}
              onChange={(event) => setName(event.target.value)}
            />
            {errors.name ? <p className="field-error">{errors.name}</p> : null}
          </div>
          <div className="field">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              className={`input ${errors.email ? 'input-invalid' : ''}`}
              type="email"
              autoComplete="email"
              value={email}
              aria-invalid={Boolean(errors.email)}
              onChange={(event) => setEmail(event.target.value)}
            />
            {errors.email ? <p className="field-error">{errors.email}</p> : null}
          </div>
          <div className="field">
            <label htmlFor="reg-phone">Phone (optional)</label>
            <input
              id="reg-phone"
              className={`input ${errors.phone ? 'input-invalid' : ''}`}
              type="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={phone}
              aria-invalid={Boolean(errors.phone)}
              onChange={(event) => setPhone(event.target.value)}
            />
            {errors.phone ? <p className="field-error">{errors.phone}</p> : null}
          </div>
          <div className="field">
            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
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
            <label htmlFor="reg-confirm">Confirm password</label>
            <input
              id="reg-confirm"
              className={`input ${errors.confirmPassword ? 'input-invalid' : ''}`}
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              aria-invalid={Boolean(errors.confirmPassword)}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            {errors.confirmPassword ? <p className="field-error">{errors.confirmPassword}</p> : null}
          </div>
          {role === 'PARTNER' ? (
            <p className="field-hint">
              After registering you&apos;ll continue onboarding in the partner portal.
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <div className="auth-links">
          <span>
            Already registered? <Link to="/login">Sign in</Link>
          </span>
        </div>
      </div>
    </div>
  );
}
