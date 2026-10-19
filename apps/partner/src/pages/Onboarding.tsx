import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage, isApiError } from '../lib/api';
import type { PartnerProfileDTO } from '../lib/types';
import { BUSINESS_TYPES } from '../lib/types';
import {
  hasErrors,
  issuesToErrors,
  validatePayout,
  validateVerification,
  type AddressValues,
  type FieldErrors,
  type PayoutValues,
  type VerificationValues,
} from '../lib/validation';
import { enumOptions } from '../lib/listingForm';
import { useToast } from '../components/Toast';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, Skeleton } from '../components/States';
import { AddressFields, BusinessForm } from '../components/BusinessForm';
import { FileUpload } from '../components/FileUpload';

interface DocumentRow {
  id: number;
  label: string;
  url: string;
  uploading: boolean;
}

let docRowId = 1;

function emptyAddress(): AddressValues {
  return { addressLine1: '', addressLine2: '', landmark: '', city: '', state: '', postalCode: '', country: 'India', region: '' };
}

function VerificationSection({ profile, onSaved }: { profile: PartnerProfileDTO; onSaved: () => Promise<void> }) {
  const toast = useToast();
  const verification = profile.verification;
  const blocked = profile.verificationStatus === 'VERIFIED' || profile.verificationStatus === 'UNDER_REVIEW';

  const [legalBusinessName, setLegalBusinessName] = useState(verification?.legalBusinessName ?? profile.businessName ?? '');
  const [businessType, setBusinessType] = useState(verification?.businessType ?? profile.businessType ?? 'SOLE_PROPRIETORSHIP');
  const [gstNumber, setGstNumber] = useState(verification?.gstNumber ?? '');
  const [panNumber, setPanNumber] = useState(verification?.panNumber ?? '');
  const [registrationNumber, setRegistrationNumber] = useState(verification?.registrationNumber ?? '');
  const [address, setAddress] = useState<AddressValues>(
    verification?.address
      ? {
          addressLine1: verification.address.addressLine1,
          addressLine2: verification.address.addressLine2 ?? '',
          landmark: verification.address.landmark ?? '',
          city: verification.address.city,
          state: verification.address.state,
          postalCode: verification.address.postalCode,
          country: verification.address.country ?? 'India',
          region: verification.address.region ?? '',
        }
      : profile.address
        ? {
            addressLine1: profile.address.addressLine1,
            addressLine2: profile.address.addressLine2 ?? '',
            landmark: profile.address.landmark ?? '',
            city: profile.address.city,
            state: profile.address.state,
            postalCode: profile.address.postalCode,
            country: profile.address.country ?? 'India',
            region: profile.address.region ?? '',
          }
        : emptyAddress(),
  );
  const [documents, setDocuments] = useState<DocumentRow[]>(() =>
    (verification?.documents ?? []).map((doc) => ({ id: docRowId++, label: doc.label, url: doc.url, uploading: false })),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function patchDocument(id: number, patch: Partial<DocumentRow>): void {
    setDocuments((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    const values: VerificationValues = {
      legalBusinessName,
      businessType,
      gstNumber,
      panNumber,
      registrationNumber,
      address,
      documents: documents.map((row) => ({ label: row.label, url: row.url })),
    };
    const validation = validateVerification(values);
    setErrors(validation);
    if (hasErrors(validation)) return;

    setSubmitting(true);
    try {
      await api.post('/partner/verification', {
        legalBusinessName: values.legalBusinessName.trim(),
        businessType: values.businessType,
        gstNumber: gstNumber.trim() || null,
        panNumber: panNumber.trim().toUpperCase() || null,
        registrationNumber: registrationNumber.trim() || null,
        address: {
          addressLine1: address.addressLine1.trim(),
          addressLine2: address.addressLine2?.trim() || null,
          landmark: address.landmark?.trim() || null,
          city: address.city.trim(),
          state: address.state.trim(),
          postalCode: address.postalCode.trim(),
          country: address.country?.trim() || 'India',
          region: address.region?.trim() || null,
        },
        documents: values.documents.map((doc) => ({ label: doc.label.trim(), url: doc.url.trim() })),
      });
      toast.success('Verification documents submitted for review.');
      await onSaved();
    } catch (error) {
      if (isApiError(error) && error.issues.length > 0) {
        setErrors(issuesToErrors(error.issues));
        setFormError(error.message);
      } else {
        setFormError(errorMessage(error, 'Could not submit verification'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card" aria-labelledby="kyc-heading">
      <div className="card__header">
        <h2 className="card__title" id="kyc-heading">
          KYC verification
        </h2>
        <StatusBadge value={profile.verificationStatus} kind="verification" />
      </div>

      {profile.verificationStatus === 'REJECTED' && verification?.rejectionReason ? (
        <div className="alert alert--error" role="alert">
          <strong>Rejected:</strong> {verification.rejectionReason}
        </div>
      ) : null}
      {blocked ? (
        <div className="alert alert--info">
          {profile.verificationStatus === 'VERIFIED'
            ? 'Your business is already verified — no further action needed.'
            : 'Your documents are under review. You will be notified once a decision is made.'}
        </div>
      ) : null}
      {verification?.documents?.length ? (
        <details className="doc-summary">
          <summary>Previously submitted documents ({verification.documents.length})</summary>
          <ul>
            {verification.documents.map((doc) => (
              <li key={doc.id}>
                <a href={doc.url} target="_blank" rel="noreferrer">
                  {doc.label}
                </a>{' '}
                — <StatusBadge value={doc.status} kind="generic" />
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <form onSubmit={(event) => void onSubmit(event)} noValidate className="stack" aria-busy={submitting}>
        {formError ? (
          <div className="alert alert--error" role="alert">
            {formError}
          </div>
        ) : null}

        <div className="field-row">
          <div className="field">
            <label className="field__label" htmlFor="kyc-legal-name">
              Legal business name *
            </label>
            <input
              id="kyc-legal-name"
              className={`input ${errors.legalBusinessName ? 'input--invalid' : ''}`}
              value={legalBusinessName}
              onChange={(event) => setLegalBusinessName(event.target.value)}
              disabled={blocked}
            />
            {errors.legalBusinessName ? <span className="field__error">{errors.legalBusinessName}</span> : null}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="kyc-business-type">
              Business type *
            </label>
            <select
              id="kyc-business-type"
              className={`input ${errors.businessType ? 'input--invalid' : ''}`}
              value={businessType}
              onChange={(event) => setBusinessType(event.target.value)}
              disabled={blocked}
            >
              {enumOptions(BUSINESS_TYPES).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.businessType ? <span className="field__error">{errors.businessType}</span> : null}
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field__label" htmlFor="kyc-gst">
              GST number
            </label>
            <input
              id="kyc-gst"
              className={`input ${errors.gstNumber ? 'input--invalid' : ''}`}
              value={gstNumber}
              onChange={(event) => setGstNumber(event.target.value.toUpperCase())}
              placeholder="22AAAAA0000A1Z5"
              disabled={blocked}
            />
            {errors.gstNumber ? <span className="field__error">{errors.gstNumber}</span> : <span className="field__hint">15 characters</span>}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="kyc-pan">
              PAN number
            </label>
            <input
              id="kyc-pan"
              className={`input ${errors.panNumber ? 'input--invalid' : ''}`}
              value={panNumber}
              onChange={(event) => setPanNumber(event.target.value.toUpperCase())}
              placeholder="ABCDE1234F"
              disabled={blocked}
            />
            {errors.panNumber ? <span className="field__error">{errors.panNumber}</span> : null}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="kyc-reg">
              Registration number
            </label>
            <input
              id="kyc-reg"
              className={`input ${errors.registrationNumber ? 'input--invalid' : ''}`}
              value={registrationNumber}
              onChange={(event) => setRegistrationNumber(event.target.value)}
              disabled={blocked}
            />
            {errors.registrationNumber ? <span className="field__error">{errors.registrationNumber}</span> : null}
          </div>
        </div>

        <AddressFields values={address} errors={errors} onChange={(patch) => setAddress((current) => ({ ...current, ...patch }))} legend="Registered business address" />

        <div className="stack">
          <span className="field__label">Documents * (GST certificate, PAN, address proof…)</span>
          {errors.documents ? <span className="field__error">{errors.documents}</span> : null}
          {documents.map((row) => (
            <div className="doc-row" key={row.id}>
              <div className="field doc-row__label">
                <label className="sr-only" htmlFor={`doc-label-${row.id}`}>
                  Document label
                </label>
                <input
                  id={`doc-label-${row.id}`}
                  className={`input ${errors.documents && !row.label.trim() ? 'input--invalid' : ''}`}
                  placeholder="e.g. GST registration certificate"
                  value={row.label}
                  onChange={(event) => patchDocument(row.id, { label: event.target.value })}
                  disabled={blocked}
                />
              </div>
              <FileUpload
                folder="documents"
                label="File"
                compact
                accept="image/*,application/pdf"
                initialUrls={row.url ? [row.url] : []}
                initialNames={row.url ? ['Uploaded file'] : []}
                maxFiles={1}
                disabled={blocked || row.uploading}
                onChange={(urls) => patchDocument(row.id, { url: urls[0] ?? '' })}
              />
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setDocuments((current) => current.filter((item) => item.id !== row.id))}
                disabled={blocked}
              >
                Remove
              </button>
            </div>
          ))}
          <div>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => setDocuments((current) => [...current, { id: docRowId++, label: '', url: '', uploading: false }])}
              disabled={blocked || documents.length >= 10}
            >
              + Add document
            </button>
          </div>
        </div>

        <div>
          <button type="submit" className="btn btn--primary" disabled={submitting || blocked}>
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
        </div>
      </form>
    </section>
  );
}

function PayoutSection() {
  const toast = useToast();
  const [values, setValues] = useState<PayoutValues>({
    accountHolderName: '',
    accountNumber: '',
    ifsc: '',
    bankName: '',
    upiId: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function patch(partial: Partial<PayoutValues>): void {
    setValues((current) => ({ ...current, ...partial }));
    setSaved(false);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    const validation = validatePayout(values);
    setErrors(validation);
    if (hasErrors(validation)) return;

    setSaving(true);
    try {
      await api.patch('/partner/payout-details', {
        accountHolderName: values.accountHolderName.trim(),
        accountNumber: values.accountNumber.trim(),
        ifsc: values.ifsc.trim().toUpperCase(),
        bankName: values.bankName.trim(),
        upiId: values.upiId?.trim() || null,
      });
      toast.success('Payout details saved (account number stored masked only).');
      setErrors({});
      setValues((current) => ({ ...current, accountNumber: '' }));
      setSaved(true);
    } catch (error) {
      if (isApiError(error) && error.issues.length > 0) {
        setErrors(issuesToErrors(error.issues));
        setFormError(error.message);
      } else {
        setFormError(errorMessage(error, 'Could not save payout details'));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card" aria-labelledby="payout-heading">
      <div className="card__header">
        <h2 className="card__title" id="payout-heading">
          Payout details
        </h2>
      </div>
      <p className="muted">
        Used to settle your earnings. For security only a masked account number (e.g. <code>XXXX1234</code>) is stored.
      </p>
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="stack">
        {formError ? (
          <div className="alert alert--error" role="alert">
            {formError}
          </div>
        ) : null}
        {saved ? (
          <div className="alert alert--success" role="status">
            Payout details updated.
          </div>
        ) : null}
        <div className="field-row">
          <div className="field">
            <label className="field__label" htmlFor="payout-holder">
              Account holder name *
            </label>
            <input
              id="payout-holder"
              className={`input ${errors.accountHolderName ? 'input--invalid' : ''}`}
              value={values.accountHolderName}
              onChange={(event) => patch({ accountHolderName: event.target.value })}
            />
            {errors.accountHolderName ? <span className="field__error">{errors.accountHolderName}</span> : null}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="payout-bank">
              Bank name *
            </label>
            <input
              id="payout-bank"
              className={`input ${errors.bankName ? 'input--invalid' : ''}`}
              value={values.bankName}
              onChange={(event) => patch({ bankName: event.target.value })}
            />
            {errors.bankName ? <span className="field__error">{errors.bankName}</span> : null}
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label className="field__label" htmlFor="payout-account">
              Account number * (6–20 digits)
            </label>
            <input
              id="payout-account"
              className={`input ${errors.accountNumber ? 'input--invalid' : ''}`}
              value={values.accountNumber}
              onChange={(event) => patch({ accountNumber: event.target.value.replace(/[^0-9]/g, '') })}
              inputMode="numeric"
              autoComplete="off"
            />
            {errors.accountNumber ? <span className="field__error">{errors.accountNumber}</span> : null}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="payout-ifsc">
              IFSC *
            </label>
            <input
              id="payout-ifsc"
              className={`input ${errors.ifsc ? 'input--invalid' : ''}`}
              value={values.ifsc}
              onChange={(event) => patch({ ifsc: event.target.value.toUpperCase() })}
              placeholder="HDFC0001234"
            />
            {errors.ifsc ? <span className="field__error">{errors.ifsc}</span> : null}
          </div>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="payout-upi">
            UPI ID (optional)
          </label>
          <input
            id="payout-upi"
            className={`input ${errors.upiId ? 'input--invalid' : ''}`}
            value={values.upiId ?? ''}
            onChange={(event) => patch({ upiId: event.target.value })}
            placeholder="name@bank"
          />
          {errors.upiId ? <span className="field__error">{errors.upiId}</span> : null}
        </div>
        <div>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save payout details'}
          </button>
        </div>
      </form>
    </section>
  );
}

export function OnboardingPage() {
  const [profile, setProfile] = useState<PartnerProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await api.get<PartnerProfileDTO>('/partner/profile'));
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
          <Skeleton height="1rem" style={{ marginTop: '0.5rem' }} />
        </div>
      </div>
    );
  }
  if (error || !profile) {
    return (
      <div className="page">
        <ErrorState error={error} onRetry={() => void load()} title="Could not load your profile" />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page__intro">
        <h2>Complete your partner profile</h2>
        <p className="muted">
          Business details → KYC documents → payout details. Verified partners can publish listings that go live after
          admin approval. Need help? <Link to="/messages">Message support</Link>.
        </p>
      </div>

      <section className="card" aria-labelledby="business-heading">
        <div className="card__header">
          <h2 className="card__title" id="business-heading">
            Business information
          </h2>
          <StatusBadge value={profile.verificationStatus} kind="verification" />
        </div>
        <BusinessForm profile={profile} submit={async (values) => {
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
        }} />
      </section>

      <VerificationSection profile={profile} onSaved={load} />
      <PayoutSection />
    </div>
  );
}

export default OnboardingPage;
