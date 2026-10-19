import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ApiError, api } from '../lib/api';
import { formatDate, humanize } from '../lib/format';
import type { UserDTO } from '../lib/types';
import { useToast } from '../components/Toast';

const PHONE_PATTERN = /^[+0-9][0-9 -]{7,16}$/;

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the selected file'));
    reader.readAsDataURL(file);
  });
}

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [profileErrors, setProfileErrors] = useState<{ name?: string; phone?: string; form?: string }>({});
  const [profileBusy, setProfileBusy] = useState(false);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<{ currentPassword?: string; newPassword?: string; confirmPassword?: string; form?: string }>({});
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordDone, setPasswordDone] = useState(false);

  const onProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const errors: typeof profileErrors = {};
    if (!name.trim() || name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
    if (phone.trim() && !PHONE_PATTERN.test(phone.trim())) errors.phone = 'Enter a valid phone number';
    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setProfileBusy(true);
    setProfileErrors({});
    try {
      const result = await api.patch<{ user: UserDTO }>('/auth/me', {
        name: name.trim(),
        phone: phone.trim() || null,
      });
      if (result?.user) updateUser(result.user);
      toast.push('Profile updated', 'success');
    } catch (error) {
      if (error instanceof ApiError) {
        setProfileErrors({
          form: error.message,
          name: error.issueFor('name'),
          phone: error.issueFor('phone'),
        });
      } else {
        setProfileErrors({ form: 'Could not update the profile.' });
      }
    } finally {
      setProfileBusy(false);
    }
  };

  const onAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.push('Please choose an image file.', 'error');
      return;
    }
    if (file.size > 2_000_000) {
      toast.push('Image is too large (max 2 MB).', 'error');
      return;
    }
    setAvatarBusy(true);
    try {
      const dataUri = await fileToDataUri(file);
      const upload = await api.post<{ url: string }>('/uploads', { file: dataUri, folder: 'avatars' });
      const result = await api.patch<{ user: UserDTO }>('/auth/me', { avatarUrl: upload.url });
      if (result?.user) updateUser(result.user);
      toast.push('Avatar updated', 'success');
    } catch (error) {
      toast.push(error instanceof ApiError ? error.message : 'Could not upload the avatar.', 'error');
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onPasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const errors: typeof passwordErrors = {};
    if (!currentPassword) errors.currentPassword = 'Current password is required';
    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      errors.newPassword = 'New password must be at least 8 characters with a letter and a number';
    }
    if (confirmPassword !== newPassword) errors.confirmPassword = 'Passwords do not match';
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPasswordBusy(true);
    setPasswordErrors({});
    setPasswordDone(false);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setPasswordDone(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.push('Password changed', 'success');
    } catch (error) {
      if (error instanceof ApiError) {
        setPasswordErrors({
          form: error.message,
          currentPassword: error.issueFor('currentPassword'),
          newPassword: error.issueFor('newPassword'),
        });
      } else {
        setPasswordErrors({ form: 'Could not change the password.' });
      }
    } finally {
      setPasswordBusy(false);
    }
  };

  if (!user) return null;

  return (
    <div className="container page">
      <div className="page-head">
        <h1>Profile</h1>
        <p className="muted">
          {humanize(user.role)} account · Member since {formatDate(user.createdAt)}
          {user.emailVerified ? ' · ✓ Email verified' : ''}
        </p>
      </div>

      <div className="profile-layout">
        <section className="card section-card" aria-labelledby="avatar-heading">
          <h2 id="avatar-heading">Avatar</h2>
          <div className="avatar-editor">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={`${user.name}'s avatar`} className="avatar avatar-xl" />
            ) : (
              <span className="avatar avatar-fallback avatar-xl" aria-hidden="true">
                {user.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div>
              <input
                ref={fileRef}
                id="avatar-file"
                type="file"
                accept="image/*"
                onChange={(event) => void onAvatarChange(event)}
                disabled={avatarBusy}
              />
              <p className="field-hint">JPG or PNG, up to 2 MB. Uploaded to /avatars via the API.</p>
            </div>
          </div>
        </section>

        <section className="card section-card" aria-labelledby="details-heading">
          <h2 id="details-heading">Account details</h2>
          <form onSubmit={onProfileSubmit} noValidate>
            {profileErrors.form ? (
              <p className="form-error" role="alert">
                {profileErrors.form}
              </p>
            ) : null}
            <div className="field">
              <label htmlFor="profile-email">Email</label>
              <input id="profile-email" className="input" type="email" value={user.email} readOnly disabled />
            </div>
            <div className="field">
              <label htmlFor="profile-name">Full name</label>
              <input
                id="profile-name"
                className={`input ${profileErrors.name ? 'input-invalid' : ''}`}
                type="text"
                value={name}
                aria-invalid={Boolean(profileErrors.name)}
                onChange={(event) => setName(event.target.value)}
              />
              {profileErrors.name ? <p className="field-error">{profileErrors.name}</p> : null}
            </div>
            <div className="field">
              <label htmlFor="profile-phone">Phone</label>
              <input
                id="profile-phone"
                className={`input ${profileErrors.phone ? 'input-invalid' : ''}`}
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                aria-invalid={Boolean(profileErrors.phone)}
                onChange={(event) => setPhone(event.target.value)}
              />
              {profileErrors.phone ? <p className="field-error">{profileErrors.phone}</p> : null}
            </div>
            <button type="submit" className="btn btn-primary" disabled={profileBusy}>
              {profileBusy ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </section>

        <section className="card section-card" aria-labelledby="password-heading">
          <h2 id="password-heading">Change password</h2>
          {passwordDone ? (
            <p className="form-success" role="status">
              Password updated.
            </p>
          ) : null}
          <form onSubmit={onPasswordSubmit} noValidate>
            {passwordErrors.form ? (
              <p className="form-error" role="alert">
                {passwordErrors.form}
              </p>
            ) : null}
            <div className="field">
              <label htmlFor="current-password">Current password</label>
              <input
                id="current-password"
                className={`input ${passwordErrors.currentPassword ? 'input-invalid' : ''}`}
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                aria-invalid={Boolean(passwordErrors.currentPassword)}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
              {passwordErrors.currentPassword ? <p className="field-error">{passwordErrors.currentPassword}</p> : null}
            </div>
            <div className="field">
              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                className={`input ${passwordErrors.newPassword ? 'input-invalid' : ''}`}
                type="password"
                autoComplete="new-password"
                value={newPassword}
                aria-invalid={Boolean(passwordErrors.newPassword)}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              {passwordErrors.newPassword ? <p className="field-error">{passwordErrors.newPassword}</p> : null}
            </div>
            <div className="field">
              <label htmlFor="confirm-new-password">Confirm new password</label>
              <input
                id="confirm-new-password"
                className={`input ${passwordErrors.confirmPassword ? 'input-invalid' : ''}`}
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                aria-invalid={Boolean(passwordErrors.confirmPassword)}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
              {passwordErrors.confirmPassword ? <p className="field-error">{passwordErrors.confirmPassword}</p> : null}
            </div>
            <button type="submit" className="btn btn-primary" disabled={passwordBusy}>
              {passwordBusy ? 'Updating…' : 'Change password'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
