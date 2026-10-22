import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../auth/AuthContext';
import { ApiError, api } from '../lib/api';
import { formatDate, humanize } from '../lib/format';
import type { UserDTO } from '../lib/types';
import { useToast } from '../components/Toast';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { fadeUp, stagger } from '@bmw/ui';

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

  useDocumentMeta({
    title: 'Profile — BookMyWarehouse',
    description: 'Manage your account details and preferences.',
  });

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
      <motion.div className="page-head reveal" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1>Profile</h1>
        <p className="muted">
          {humanize(user.role)} account · Member since {formatDate(user.createdAt)}
          {user.emailVerified ? ' · ✓ Email verified' : ''}
        </p>
      </motion.div>

      <motion.div className="profile-layout reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }} variants={stagger(0.1)}>
        <motion.section className="card section-card" aria-labelledby="avatar-heading" variants={fadeUp}>
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
              {/* Visually-hidden native input keeps the keyboard/AT contract;
                  the label renders the button surface. */}
              <input
                ref={fileRef}
                id="avatar-file"
                className="avatar-file-input"
                type="file"
                accept="image/*"
                onChange={(event) => void onAvatarChange(event)}
                disabled={avatarBusy}
              />
              <label htmlFor="avatar-file" className={`btn btn-outline avatar-file-btn${avatarBusy ? ' is-busy' : ''}`}>
                {avatarBusy ? 'Uploading…' : 'Choose photo'}
              </label>
              <p className="field-hint">JPG or PNG, up to 2 MB. Uploaded to /avatars via the API.</p>
            </div>
          </div>
        </motion.section>

        <motion.section className="card section-card" aria-labelledby="details-heading" variants={fadeUp}>
          <h2 id="details-heading">Account details</h2>
          <form onSubmit={onProfileSubmit} noValidate>
            <AnimatePresence>
              {profileErrors.form ? (
                <motion.p className="form-error" role="alert" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  {profileErrors.form}
                </motion.p>
              ) : null}
            </AnimatePresence>
            <div className="field">
              <label htmlFor="profile-email">Email</label>
              <input id="profile-email" className="input" type="email" value={user.email} readOnly disabled />
            </div>
            <motion.div className="field" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <label htmlFor="profile-name">Full name</label>
              <input
                id="profile-name"
                className={`input ${profileErrors.name ? 'input-invalid' : ''}`}
                type="text"
                value={name}
                aria-invalid={Boolean(profileErrors.name)}
                onChange={(event) => setName(event.target.value)}
              />
              <AnimatePresence>
                {profileErrors.name ? (
                  <motion.p className="field-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    {profileErrors.name}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </motion.div>
            <motion.div className="field" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
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
              <AnimatePresence>
                {profileErrors.phone ? (
                  <motion.p className="field-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    {profileErrors.phone}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </motion.div>
            <motion.button
              type="submit"
              className="btn btn-primary"
              disabled={profileBusy}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              {profileBusy ? 'Saving…' : 'Save changes'}
            </motion.button>
          </form>
        </motion.section>

        <motion.section className="card section-card" aria-labelledby="password-heading" variants={fadeUp}>
          <h2 id="password-heading">Change password</h2>
          <AnimatePresence mode="wait">
            {passwordDone ? (
              <motion.p key="done" className="form-success" role="status" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                Password updated.
              </motion.p>
            ) : (
              <motion.form key="form" onSubmit={onPasswordSubmit} noValidate initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <AnimatePresence>
                  {passwordErrors.form ? (
                    <motion.p className="form-error" role="alert" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                      {passwordErrors.form}
                    </motion.p>
                  ) : null}
                </AnimatePresence>
                <motion.div className="field" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
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
                  <AnimatePresence>
                    {passwordErrors.currentPassword ? (
                      <motion.p className="field-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        {passwordErrors.currentPassword}
                      </motion.p>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
                <motion.div className="field" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
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
                  <AnimatePresence>
                    {passwordErrors.newPassword ? (
                      <motion.p className="field-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        {passwordErrors.newPassword}
                      </motion.p>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
                <motion.div className="field" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
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
                  <AnimatePresence>
                    {passwordErrors.confirmPassword ? (
                      <motion.p className="field-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        {passwordErrors.confirmPassword}
                      </motion.p>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
                <motion.button
                  type="submit"
                  className="btn btn-primary"
                  disabled={passwordBusy}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.15 }}
                >
                  {passwordBusy ? 'Updating…' : 'Change password'}
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.section>
      </motion.div>
    </div>
  );
}