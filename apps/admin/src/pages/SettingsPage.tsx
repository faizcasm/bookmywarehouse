import { useEffect, useState, type FormEvent } from 'react';
import { ErrorState, PageHeader, Skeleton } from '../components/States';
import { useToast } from '../components/Toast';
import { apiSend, ApiError } from '../lib/api';
import { errorMessage, useFetch } from '../lib/hooks';
import { formatMoney } from '../lib/format';
import type { PlatformSettingsDTO } from '../lib/types';
import { motion } from 'motion/react';
import { fadeUp } from '@bmw/ui';

interface SettingsForm {
  currency: string;
  platformFeePercent: string;
  customerFeePercent: string;
  taxPercent: string;
  /** entered in rupees; converted to minor units on submit (API stores paise) */
  minPayoutAmount: string;
  supportEmail: string;
  allowSelfServiceListings: boolean;
  requirePartnerVerification: boolean;
  maintenanceMode: boolean;
  announcement: string;
}

function toForm(s: PlatformSettingsDTO): SettingsForm {
  return {
    currency: s.currency ?? 'INR',
    platformFeePercent: String(s.platformFeePercent ?? 0),
    customerFeePercent: String(s.customerFeePercent ?? 0),
    taxPercent: String(s.taxPercent ?? 0),
    minPayoutAmount: String((s.minPayoutAmount ?? 0) / 100),
    supportEmail: s.supportEmail ?? '',
    allowSelfServiceListings: Boolean(s.allowSelfServiceListings),
    requirePartnerVerification: Boolean(s.requirePartnerVerification),
    maintenanceMode: Boolean(s.maintenanceMode),
    announcement: s.announcement ?? '',
  };
}

function validate(form: SettingsForm): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!/^[A-Za-z]{3}$/.test(form.currency.trim())) errs.currency = 'Currency must be a 3-letter code (e.g. INR).';
  for (const key of ['platformFeePercent', 'customerFeePercent', 'taxPercent'] as const) {
    const n = Number(form[key]);
    if (!Number.isFinite(n) || n < 0 || n > 50) errs[key] = 'Must be between 0 and 50 (%).';
  }
  const payout = Number(form.minPayoutAmount);
  if (!Number.isFinite(payout) || payout < 0) errs.minPayoutAmount = 'Enter a non-negative amount.';
  if (form.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.supportEmail.trim()))
    errs.supportEmail = 'Enter a valid email address.';
  if (form.announcement.length > 600) errs.announcement = 'Announcement must be under 600 characters.';
  return errs;
}

export function SettingsPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch<PlatformSettingsDTO>('/admin/settings');

  const [form, setForm] = useState<SettingsForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(toForm(data));
  }, [data]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    try {
      const updated = await apiSend<PlatformSettingsDTO>('PATCH', '/admin/settings', {
        currency: form.currency.trim().toUpperCase(),
        platformFeePercent: Number(form.platformFeePercent),
        customerFeePercent: Number(form.customerFeePercent),
        taxPercent: Number(form.taxPercent),
        minPayoutAmount: Math.round(Number(form.minPayoutAmount) * 100), // minor units
        supportEmail: form.supportEmail.trim(),
        allowSelfServiceListings: form.allowSelfServiceListings,
        requirePartnerVerification: form.requirePartnerVerification,
        maintenanceMode: form.maintenanceMode,
        announcement: form.announcement.trim() || null,
      });
      setForm(toForm(updated));
      toast.success('Platform settings saved.');
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors());
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    if (error) return <ErrorState error={error} onRetry={reload} />;
    return (
      <>
        <PageHeader title="Settings" subtitle="Platform-wide configuration" />
        <Skeleton rows={8} />
      </>
    );
  }

  const set = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => setForm({ ...form, [key]: value });

  return (
    <>
      <motion.header variants={fadeUp} initial="hidden" animate="show">
        <PageHeader title="Settings" subtitle="Platform-wide configuration — applies to all apps immediately" />
      </motion.header>
      <motion.form className="card settings-form" onSubmit={onSubmit} noValidate variants={fadeUp} initial="hidden" animate="show">
        <h2 className="card__title">Fees & taxes</h2>
        <div className="field-row">
          <div className="field">
            <label className="field__label" htmlFor="st-currency">
              Currency *
            </label>
            <input id="st-currency" className="input" maxLength={3} value={form.currency} onChange={(e) => set('currency', e.target.value)} />
            {errors.currency ? (
              <p className="field__error" role="alert">
                {errors.currency}
              </p>
            ) : null}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="st-platform-fee">
              Platform fee (%) *
            </label>
            <input id="st-platform-fee" className="input" type="number" step="0.01" min={0} max={50} value={form.platformFeePercent} onChange={(e) => set('platformFeePercent', e.target.value)} />
            {errors.platformFeePercent ? (
              <p className="field__error" role="alert">
                {errors.platformFeePercent}
              </p>
            ) : null}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="st-customer-fee">
              Customer fee (%)
            </label>
            <input id="st-customer-fee" className="input" type="number" step="0.01" min={0} max={50} value={form.customerFeePercent} onChange={(e) => set('customerFeePercent', e.target.value)} />
            {errors.customerFeePercent ? (
              <p className="field__error" role="alert">
                {errors.customerFeePercent}
              </p>
            ) : null}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="st-tax">
              Tax (%)
            </label>
            <input id="st-tax" className="input" type="number" step="0.01" min={0} max={50} value={form.taxPercent} onChange={(e) => set('taxPercent', e.target.value)} />
            {errors.taxPercent ? (
              <p className="field__error" role="alert">
                {errors.taxPercent}
              </p>
            ) : null}
          </div>
        </div>

        <h2 className="card__title">Payouts & support</h2>
        <div className="field-row">
          <div className="field">
            <label className="field__label" htmlFor="st-payout">
              Minimum payout (₹) *
            </label>
            <input id="st-payout" className="input" type="number" min={0} step="1" value={form.minPayoutAmount} onChange={(e) => set('minPayoutAmount', e.target.value)} />
            {errors.minPayoutAmount ? (
              <p className="field__error" role="alert">
                {errors.minPayoutAmount}
              </p>
            ) : null}
            {data ? <p className="field__hint">Currently {formatMoney(data.minPayoutAmount, data.currency)}.</p> : null}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="st-email">
              Support email *
            </label>
            <input id="st-email" className="input" type="email" value={form.supportEmail} onChange={(e) => set('supportEmail', e.target.value)} />
            {errors.supportEmail ? (
              <p className="field__error" role="alert">
                {errors.supportEmail}
              </p>
            ) : null}
          </div>
        </div>

        <h2 className="card__title">Marketplace controls</h2>
        <div className="switch-list">
          <label className="switch-row">
            <input type="checkbox" checked={form.allowSelfServiceListings} onChange={(e) => set('allowSelfServiceListings', e.target.checked)} />
            <span>
              <strong>Allow self-service listings</strong>
              <span className="muted">Partners can create and publish listings without staff help.</span>
            </span>
          </label>
          <label className="switch-row">
            <input type="checkbox" checked={form.requirePartnerVerification} onChange={(e) => set('requirePartnerVerification', e.target.checked)} />
            <span>
              <strong>Require partner verification</strong>
              <span className="muted">Partners must pass KYC before listings go live.</span>
            </span>
          </label>
          <label className="switch-row switch-row--danger">
            <input type="checkbox" checked={form.maintenanceMode} onChange={(e) => set('maintenanceMode', e.target.checked)} />
            <span>
              <strong>Maintenance mode</strong>
              <span className="muted">Blocks public marketplace access while enabled.</span>
            </span>
          </label>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="st-announcement">
            Announcement <span className="field__hint-inline">(banner shown to all users — optional)</span>
          </label>
          <textarea id="st-announcement" className="textarea" rows={3} maxLength={600} value={form.announcement} onChange={(e) => set('announcement', e.target.value)} />
          {errors.announcement ? (
            <p className="field__error" role="alert">
              {errors.announcement}
            </p>
          ) : null}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </motion.form>
    </>
  );
}