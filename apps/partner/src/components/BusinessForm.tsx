import { useEffect, useState, type FormEvent } from 'react';
import type { AddressValues, FieldErrors, OnboardingValues } from '../lib/validation';
import { hasErrors, issuesToErrors, validateOnboarding } from '../lib/validation';
import { errorMessage, isApiError } from '../lib/api';
import { BUSINESS_TYPES, LISTING_TYPES, type PartnerProfileDTO } from '../lib/types';
import { enumOptions } from '../lib/listingForm';
import { FileUpload } from './FileUpload';

export function AddressFields({
  values,
  errors,
  onChange,
  legend = 'Address',
}: {
  values: AddressValues;
  errors: FieldErrors;
  onChange: (patch: Partial<AddressValues>) => void;
  legend?: string;
}) {
  return (
    <fieldset className="fieldset">
      <legend className="fieldset__legend">{legend}</legend>
      <div className="field">
        <label className="field__label" htmlFor="addr-line1">
          Address line 1 *
        </label>
        <input
          id="addr-line1"
          className={`input ${errors['address.addressLine1'] ? 'input--invalid' : ''}`}
          value={values.addressLine1}
          onChange={(event) => onChange({ addressLine1: event.target.value })}
          placeholder="Warehouse 7, MIDC Phase II"
        />
        {errors['address.addressLine1'] ? <span className="field__error">{errors['address.addressLine1']}</span> : null}
      </div>
      <div className="field-row">
        <div className="field">
          <label className="field__label" htmlFor="addr-line2">
            Address line 2
          </label>
          <input id="addr-line2" className="input" value={values.addressLine2 ?? ''} onChange={(event) => onChange({ addressLine2: event.target.value })} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="addr-landmark">
            Landmark
          </label>
          <input id="addr-landmark" className="input" value={values.landmark ?? ''} onChange={(event) => onChange({ landmark: event.target.value })} />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label className="field__label" htmlFor="addr-city">
            City *
          </label>
          <input
            id="addr-city"
            className={`input ${errors['address.city'] ? 'input--invalid' : ''}`}
            value={values.city}
            onChange={(event) => onChange({ city: event.target.value })}
          />
          {errors['address.city'] ? <span className="field__error">{errors['address.city']}</span> : null}
        </div>
        <div className="field">
          <label className="field__label" htmlFor="addr-state">
            State *
          </label>
          <input
            id="addr-state"
            className={`input ${errors['address.state'] ? 'input--invalid' : ''}`}
            value={values.state}
            onChange={(event) => onChange({ state: event.target.value })}
          />
          {errors['address.state'] ? <span className="field__error">{errors['address.state']}</span> : null}
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label className="field__label" htmlFor="addr-postal">
            Postal / PIN code *
          </label>
          <input
            id="addr-postal"
            className={`input ${errors['address.postalCode'] ? 'input--invalid' : ''}`}
            value={values.postalCode}
            onChange={(event) => onChange({ postalCode: event.target.value })}
          />
          {errors['address.postalCode'] ? <span className="field__error">{errors['address.postalCode']}</span> : null}
        </div>
        <div className="field">
          <label className="field__label" htmlFor="addr-country">
            Country *
          </label>
          <input id="addr-country" className="input" value={values.country ?? 'India'} onChange={(event) => onChange({ country: event.target.value })} />
        </div>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="addr-region">
          Region (searchable area, e.g. “Bhiwandi”, “Delhi NCR”)
        </label>
        <input id="addr-region" className="input" value={values.region ?? ''} onChange={(event) => onChange({ region: event.target.value })} />
      </div>
    </fieldset>
  );
}

function profileToOnboardingValues(profile: PartnerProfileDTO | null): OnboardingValues {
  return {
    businessName: profile?.businessName ?? '',
    businessType: profile?.businessType ?? 'SOLE_PROPRIETORSHIP',
    description: profile?.description ?? '',
    address: {
      addressLine1: profile?.address?.addressLine1 ?? '',
      addressLine2: profile?.address?.addressLine2 ?? '',
      landmark: profile?.address?.landmark ?? '',
      city: profile?.address?.city ?? '',
      state: profile?.address?.state ?? '',
      postalCode: profile?.address?.postalCode ?? '',
      country: profile?.address?.country ?? 'India',
      region: profile?.address?.region ?? '',
    },
    website: profile?.website ?? '',
    logoUrl: profile?.logoUrl ?? '',
    supportedTypes: [], // the API does not return supportedTypes — the user picks them
  };
}

/**
 * Business information form (mirrors `partnerOnboardingSchema`). Used by both
 * the Onboarding page and the Profile page. `submit` should POST /partner/onboarding.
 */
export function BusinessForm({
  profile,
  submit,
  submitLabel = 'Save business profile',
  onSaved,
}: {
  profile: PartnerProfileDTO | null;
  submit: (values: OnboardingValues) => Promise<void>;
  submitLabel?: string;
  onSaved?: () => void;
}) {
  const [values, setValues] = useState<OnboardingValues>(() => profileToOnboardingValues(profile));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValues(profileToOnboardingValues(profile));
    setErrors({});
    setSaved(false);
  }, [profile]);

  function patch(partial: Partial<OnboardingValues>): void {
    setValues((current) => ({ ...current, ...partial }));
    setSaved(false);
  }

  function patchAddress(partial: Partial<AddressValues>): void {
    setValues((current) => ({ ...current, address: { ...current.address, ...partial } }));
    setSaved(false);
  }

  function toggleSupportedType(type: string): void {
    setValues((current) => ({
      ...current,
      supportedTypes: current.supportedTypes.includes(type)
        ? current.supportedTypes.filter((item) => item !== type)
        : [...current.supportedTypes, type],
    }));
    setSaved(false);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    const validation = validateOnboarding(values);
    setErrors(validation);
    if (hasErrors(validation)) return;

    setSaving(true);
    try {
      await submit(values);
      setErrors({});
      setSaved(true);
      onSaved?.();
    } catch (error) {
      if (isApiError(error) && error.issues.length > 0) {
        setErrors(issuesToErrors(error.issues));
        setFormError(error.message);
      } else {
        setFormError(errorMessage(error, 'Could not save the business profile'));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="stack">
      {formError ? (
        <div className="alert alert--error" role="alert">
          {formError}
        </div>
      ) : null}
      {saved ? (
        <div className="alert alert--success" role="status">
          Business profile saved.
        </div>
      ) : null}

      <div className="field-row">
        <div className="field">
          <label className="field__label" htmlFor="biz-name">
            Business name *
          </label>
          <input
            id="biz-name"
            className={`input ${errors.businessName ? 'input--invalid' : ''}`}
            value={values.businessName}
            onChange={(event) => patch({ businessName: event.target.value })}
          />
          {errors.businessName ? <span className="field__error">{errors.businessName}</span> : null}
        </div>
        <div className="field">
          <label className="field__label" htmlFor="biz-type">
            Business type *
          </label>
          <select
            id="biz-type"
            className={`input ${errors.businessType ? 'input--invalid' : ''}`}
            value={values.businessType}
            onChange={(event) => patch({ businessType: event.target.value })}
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

      <div className="field">
        <label className="field__label" htmlFor="biz-description">
          Description
        </label>
        <textarea
          id="biz-description"
          className={`input input--textarea ${errors.description ? 'input--invalid' : ''}`}
          rows={3}
          value={values.description ?? ''}
          onChange={(event) => patch({ description: event.target.value })}
          placeholder="Regional 3PL operator with cold-chain and general warehousing…"
        />
        {errors.description ? <span className="field__error">{errors.description}</span> : null}
      </div>

      <AddressFields values={values.address} errors={errors} onChange={patchAddress} />

      <div className="field-row">
        <div className="field">
          <label className="field__label" htmlFor="biz-website">
            Website
          </label>
          <input
            id="biz-website"
            className={`input ${errors.website ? 'input--invalid' : ''}`}
            value={values.website ?? ''}
            onChange={(event) => patch({ website: event.target.value })}
            placeholder="https://example.com"
          />
          {errors.website ? <span className="field__error">{errors.website}</span> : null}
        </div>
        <div className="field">
          <span className="field__label">Supported listing types *</span>
          <div className="checkbox-row" role="group" aria-label="Supported listing types">
            {LISTING_TYPES.map((type) => (
              <label key={type} className="checkbox">
                <input
                  type="checkbox"
                  checked={values.supportedTypes.includes(type)}
                  onChange={() => toggleSupportedType(type)}
                />
                {type === 'WAREHOUSE' ? 'Warehouses' : type === 'EQUIPMENT' ? 'Equipment' : 'Services'}
              </label>
            ))}
          </div>
          {errors.supportedTypes ? <span className="field__error">{errors.supportedTypes}</span> : null}
        </div>
      </div>

      <FileUpload
        folder="logos"
        label="Business logo"
        hint="Optional. Stored via POST /uploads."
        initialUrls={values.logoUrl ? [values.logoUrl] : []}
        initialNames={['Current logo']}
        maxFiles={1}
        onChange={(urls) => patch({ logoUrl: urls[0] ?? '' })}
      />
      {errors.logoUrl ? <span className="field__error">{errors.logoUrl}</span> : null}

      <div>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
