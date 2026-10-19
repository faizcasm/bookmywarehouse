import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage, isApiError } from '../lib/api';
import { formatDate, formatNumber } from '../lib/format';
import type { PartnerProfileDTO, UserDTO } from '../lib/types';
import { issuesToErrors, validateRegister, type FieldErrors } from '../lib/validation';
import { BusinessForm } from '../components/BusinessForm';
import { FileUpload } from '../components/FileUpload';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, Skeleton } from '../components/States';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';

function AccountSection({ user, onUpdated }: { user: UserDTO; onUpdated: () => Promise<void> }) {
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    const validation = validateRegister({ name, email: user.email, password: 'placeholder1' , phone });
    const { password: _password, email: _email, ...rest } = validation;
    setErrors(rest);
    if (Object.keys(rest).length > 0) return;

    setSaving(true);
    try {
      await api.patch('/me', {
        name: name.trim(),
        phone: phone.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
      });
      toast.success('Profile updated.');
      setErrors({});
      await onUpdated();
    } catch (error) {
      if (isApiError(error) && error.issues.length > 0) {
        setErrors(issuesToErrors(error.issues));
        setFormError(error.message);
      } else {
        setFormError(errorMessage(error, 'Could not update the profile'));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card" aria-labelledby="account-heading">
      <div className="card__header">
        <h2 className="card__title" id="account-heading">
          Account
        </h2>
        {user.emailVerified ? <span className="badge badge--success">Email verified</span> : null}
      </div>
      <p className="muted">
        {user.email} · member since {formatDate(user.createdAt)}
      </p>
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="stack">
        {formError ? (
          <div className="alert alert--error" role="alert">
            {formError}
          </div>
        ) : null}
        <div className="field-row">
          <div className="field">
            <label className="field__label" htmlFor="account-name">
              Full name *
            </label>
            <input id="account-name" className={`input ${errors.name ? 'input--invalid' : ''}`} value={name} onChange={(event) => setName(event.target.value)} />
            {errors.name ? <span className="field__error">{errors.name}</span> : null}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="account-phone">
              Phone
            </label>
            <input id="account-phone" className={`input ${errors.phone ? 'input--invalid' : ''}`} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" />
            {errors.phone ? <span className="field__error">{errors.phone}</span> : null}
          </div>
        </div>
        <FileUpload
          folder="avatars"
          label="Profile photo"
          initialUrls={avatarUrl ? [avatarUrl] : []}
          initialNames={['Current photo']}
          maxFiles={1}
          onChange={(urls) => setAvatarUrl(urls[0] ?? '')}
        />
        <div>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save account details'}
          </button>
        </div>
      </form>
    </section>
  );
}

export function ProfilePage() {
  const { refreshUser } = useAuth();
  const [user, setUser] = useState<UserDTO | null>(null);
  const [profile, setProfile] = useState<PartnerProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [me, partnerProfile] = await Promise.all([
        api.get<{ user: UserDTO }>('/auth/me'),
        api.get<PartnerProfileDTO>('/partner/profile'),
      ]);
      setUser(me.user);
      setProfile(partnerProfile);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="page stack">
        <div className="card">
          <Skeleton height="2rem" />
          <Skeleton height="1rem" style={{ marginTop: '1rem' }} />
        </div>
      </div>
    );
  }
  if (error || !user || !profile) {
    return (
      <div className="page">
        <ErrorState error={error} onRetry={() => void load()} title="Could not load your profile" />
      </div>
    );
  }

  return (
    <div className="page">
      <AccountSection
        user={user}
        onUpdated={async () => {
          await load();
          await refreshUser();
        }}
      />

      <section className="card" aria-labelledby="business-summary-heading">
        <div className="card__header">
          <h2 className="card__title" id="business-summary-heading">
            Business profile
          </h2>
          <StatusBadge value={profile.verificationStatus} kind="verification" />
        </div>
        <dl className="detail-list detail-list--inline">
          <div>
            <dt>Business name</dt>
            <dd>{profile.businessName}</dd>
          </div>
          <div>
            <dt>Business type</dt>
            <dd>{profile.businessType ?? '—'}</dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd>
              {profile.address ? `${profile.address.city}, ${profile.address.state}` : '—'}
            </dd>
          </div>
          <div>
            <dt>Website</dt>
            <dd>
              {profile.website ? (
                <a href={profile.website} target="_blank" rel="noreferrer">
                  {profile.website}
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt>Active listings</dt>
            <dd>{formatNumber(profile.activeListings)}</dd>
          </div>
          <div>
            <dt>Total bookings</dt>
            <dd>{formatNumber(profile.totalBookings)}</dd>
          </div>
          <div>
            <dt>Joined</dt>
            <dd>{formatDate(profile.joinedAt)}</dd>
          </div>
        </dl>
        <p className="muted">
          Update your business details, KYC documents and payout account on the{' '}
          <Link to="/onboarding">Onboarding & KYC page</Link>.
        </p>
      </section>

      <section className="card" aria-labelledby="business-edit-heading">
        <div className="card__header">
          <h2 className="card__title" id="business-edit-heading">
            Edit business information
          </h2>
        </div>
        <BusinessForm
          profile={profile}
          submitLabel="Save business information"
          submit={async (values) => {
            await api.post('/partner/onboarding', {
              businessName: values.businessName.trim(),
              businessType: values.businessType,
              description: values.description?.trim() || null,
              address: {
                addressLine1: values.address.addressLine1.trim(),
                addressLine2: values.address.addressLine2?.trim() || null,
                landmark: values.address.landmark?.trim() || null,
                city: values.address.city.trim(),
                state: values.address.state.trim(),
                postalCode: values.address.postalCode.trim(),
                country: values.address.country?.trim() || 'India',
                region: values.address.region?.trim() || null,
              },
              website: values.website?.trim() || '',
              logoUrl: values.logoUrl?.trim() || '',
              supportedTypes: values.supportedTypes,
            });
            await load();
          }}
        />
      </section>
    </div>
  );
}

export default ProfilePage;
