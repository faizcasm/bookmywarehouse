import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { errorMessage, isApiError, api } from '../lib/api';
import { hasErrors, issuesToErrors, type FieldErrors } from '../lib/validation';
import {
  CANCELLATION_POLICIES,
  CAPACITY_UNITS,
  EQUIPMENT_CATEGORIES,
  FACILITY_TYPES,
  PRICING_MODELS,
  PRICING_PERIODS,
  SERVICE_TYPES,
  STORAGE_TYPES,
  LISTING_TYPE_LABELS,
  buildCreateListingPayload,
  buildUpdateListingPayload,
  emptyListingValues,
  enumOptions,
  validateListingValues,
  type ListingFormValues,
} from '../lib/listingForm';
import type { CategoryDTO, ListingType } from '../lib/types';
import { FileUpload } from './FileUpload';
import { fadeUp, stagger } from '@bmw/ui';

/* ------------------------------------------------------------------ */
/* Small field primitives                                              */
/* ------------------------------------------------------------------ */

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

function FieldShell({ id, label, error, hint, required, children }: FieldShellProps) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {required ? ' *' : ''}
      </label>
      {hint ? <span className="field__hint">{hint}</span> : null}
      {children}
      {error ? <span className="field__error">{error}</span> : null}
    </div>
  );
}

interface InputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  step?: string;
  inputMode?: 'text' | 'numeric' | 'decimal';
  disabled?: boolean;
}

function TextField({ id, label, value, onChange, error, hint, required, type = 'text', placeholder, disabled }: InputProps) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} required={required}>
      <input
        id={id}
        type={type}
        className={`input ${error ? 'input--invalid' : ''}`}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  );
}

function NumberField({ id, label, value, onChange, error, hint, required, min, max, step, inputMode, disabled }: InputProps) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} required={required}>
      <input
        id={id}
        type="number"
        className={`input ${error ? 'input--invalid' : ''}`}
        value={value}
        min={min}
        max={max}
        step={step}
        inputMode={inputMode ?? 'decimal'}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  required,
  rows = 3,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} required={required}>
      <textarea
        id={id}
        rows={rows}
        className={`input input--textarea ${error ? 'input--invalid' : ''}`}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  );
}

function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  error,
  hint,
  required,
  placeholder = 'Select…',
}: {
  id: string;
  label: string;
  value: T | '';
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} required={required}>
      <select id={id} className={`input ${error ? 'input--invalid' : ''}`} value={value} onChange={(event) => onChange(event.target.value as T)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

function CheckboxField({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="checkbox" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function MultiChecklist<T extends string>({
  legend,
  values,
  options,
  onToggle,
  error,
}: {
  legend: string;
  values: T[];
  options: { value: T; label: string }[];
  onToggle: (value: T) => void;
  error?: string;
}) {
  return (
    <fieldset className="fieldset fieldset--inline">
      <legend className="field__label">{legend} *</legend>
      <div className="checkbox-row checkbox-row--wrap">
        {options.map((option) => (
          <label key={option.value} className="checkbox">
            <input type="checkbox" checked={values.includes(option.value)} onChange={() => onToggle(option.value)} />
            {option.label}
          </label>
        ))}
      </div>
      {error ? <span className="field__error">{error}</span> : null}
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* Section wrapper with subtle entrance                                */
/* ------------------------------------------------------------------ */

function FormSection({
  children,
  label,
  description,
  delay = 0,
}: {
  children: ReactNode;
  label: string;
  description?: string;
  delay?: number;
}) {
  return (
    <motion.section
      className="card"
      aria-label={label}
      variants={fadeUp}
      initial="hidden"
      animate="show"
      transition={{ delay }}
    >
      <div className="card__header">
        <h2 className="card__title">{label}</h2>
      </div>
      {description ? <p className="muted" style={{ marginBottom: '0.9rem' }}>{description}</p> : null}
      {children}
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Listing form                                                        */
/* ------------------------------------------------------------------ */

export interface ListingFormSubmitResult {
  values: ListingFormValues;
  payload: Record<string, unknown>;
}

export function ListingForm({
  type,
  initial,
  mode = 'create',
  submitting = false,
  onSubmit,
}: {
  type: ListingType;
  initial?: ListingFormValues;
  mode?: 'create' | 'edit';
  submitting?: boolean;
  onSubmit: (result: ListingFormSubmitResult) => Promise<void>;
}) {
  const [values, setValues] = useState<ListingFormValues>(() => initial ?? emptyListingValues());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const data = await api.get<{ items: CategoryDTO[] }>('/catalog/categories', { type });
      setCategories((data.items ?? []).filter((category) => category.isActive !== false));
    } catch (error) {
      setCategoriesError(errorMessage(error, 'Could not load categories'));
    } finally {
      setCategoriesLoading(false);
    }
  }, [type]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  function patch(partial: Partial<ListingFormValues>): void {
    setValues((current) => ({ ...current, ...partial }));
  }

  function patchLocation(partial: Partial<ListingFormValues['location']>): void {
    setValues((current) => ({ ...current, location: { ...current.location, ...partial } }));
  }

  function patchWarehouse(partial: Partial<ListingFormValues['warehouse']>): void {
    setValues((current) => ({ ...current, warehouse: { ...current.warehouse, ...partial } }));
  }

  function patchEquipment(partial: Partial<ListingFormValues['equipment']>): void {
    setValues((current) => ({ ...current, equipment: { ...current.equipment, ...partial } }));
  }

  function patchService(partial: Partial<ListingFormValues['service']>): void {
    setValues((current) => ({ ...current, service: { ...current.service, ...partial } }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);
    const validation = validateListingValues(type, values);
    setErrors(validation);
    if (hasErrors(validation)) {
      setFormError('Please fix the highlighted fields. Required details depend on the listing type.');
      return;
    }
    const payload = mode === 'create' ? buildCreateListingPayload(type, values) : buildUpdateListingPayload(type, values);
    try {
      await onSubmit({ values, payload });
      setErrors({});
    } catch (error) {
      if (isApiError(error) && error.issues.length > 0) {
        setErrors(issuesToErrors(error.issues));
        setFormError(error.message);
      } else {
        setFormError(errorMessage(error, 'Could not save the listing'));
      }
    }
  }

  return (
    <form className="listing-form stack" onSubmit={(event) => void handleSubmit(event)} noValidate>
      {formError ? (
        <motion.div className="alert alert--error" role="alert" variants={fadeUp} initial="hidden" animate="show">
          {formError}
        </motion.div>
      ) : null}

      {/* Identity */}
      <FormSection label="Identity" description="Basic information customers see first." delay={0}>
        <motion.div className="field-row" variants={stagger(0.04)} initial="hidden" animate="show">
          <TextField
            id="listing-title"
            label="Title"
            required
            value={values.title}
            onChange={(value) => patch({ title: value })}
            error={errors.title}
            hint="At least 8 characters — customers see this first"
            placeholder="Pune general warehouse with 4 loading docks"
          />
          <FieldShell id="listing-category" label="Category" required error={errors.categoryId}>
            {categoriesError ? (
              <div className="alert alert--error" role="alert">
                {categoriesError} <button type="button" className="btn btn--ghost btn--sm" onClick={() => void loadCategories()}>Retry</button>
              </div>
            ) : (
              <select
                id="listing-category"
                className={`input ${errors.categoryId ? 'input--invalid' : ''}`}
                value={values.categoryId}
                disabled={categoriesLoading}
                onChange={(event) => patch({ categoryId: event.target.value })}
              >
                <option value="">{categoriesLoading ? 'Loading categories…' : 'Select a category'}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            )}
          </FieldShell>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.1 }}>
          <TextAreaField
            id="listing-description"
            label="Description"
            required
            rows={5}
            value={values.description}
            onChange={(value) => patch({ description: value })}
            error={errors.description}
            hint="At least 40 characters — describe condition, access, ideal uses"
            placeholder="Describe your space, access hours, ideal customers…"
          />
        </motion.div>
      </FormSection>

      {/* Location */}
      <FormSection label="Location" description="Where your facility is located." delay={0.05}>
        <motion.div className="field-row" variants={stagger(0.04)} initial="hidden" animate="show">
          <TextField id="loc-line1" label="Address line 1" required value={values.location.addressLine1} onChange={(value) => patchLocation({ addressLine1: value })} error={errors['location.addressLine1']} />
          <TextField id="loc-line2" label="Address line 2" value={values.location.addressLine2 ?? ''} onChange={(value) => patchLocation({ addressLine2: value })} />
        </motion.div>
        <motion.div className="field-row" variants={stagger(0.04)} initial="hidden" animate="show" transition={{ delay: 0.05 }}>
          <TextField id="loc-landmark" label="Landmark" value={values.location.landmark ?? ''} onChange={(value) => patchLocation({ landmark: value })} />
          <TextField id="loc-city" label="City" required value={values.location.city} onChange={(value) => patchLocation({ city: value })} error={errors['location.city']} />
          <TextField id="loc-state" label="State" required value={values.location.state} onChange={(value) => patchLocation({ state: value })} error={errors['location.state']} />
        </motion.div>
        <motion.div className="field-row" variants={stagger(0.04)} initial="hidden" animate="show" transition={{ delay: 0.1 }}>
          <TextField id="loc-postal" label="Postal / PIN code" required value={values.location.postalCode} onChange={(value) => patchLocation({ postalCode: value })} error={errors['location.postalCode']} />
          <TextField id="loc-country" label="Country" required value={values.location.country} onChange={(value) => patchLocation({ country: value })} error={errors['location.country']} />
          <TextField id="loc-region" label="Region (searchable area)" value={values.location.region ?? ''} onChange={(value) => patchLocation({ region: value })} hint="e.g. Bhiwandi, Delhi NCR" />
        </motion.div>
      </FormSection>

      {/* Pricing */}
      <FormSection label="Pricing" description="How you charge for bookings." delay={0.1}>
        <motion.div className="field-row" variants={stagger(0.04)} initial="hidden" animate="show">
          <SelectField
            id="price-model"
            label="Pricing model"
            required
            value={values.priceModel}
            options={enumOptions(PRICING_MODELS)}
            onChange={(value) => patch({ priceModel: value })}
            error={errors.priceModel}
          />
          <TextField
            id="price-amount"
            label="Price (₹)"
            required
            type="number"
            inputMode="decimal"
            value={values.priceAmount}
            onChange={(value) => patch({ priceAmount: value })}
            error={errors.priceAmount}
            hint="Amount per unit/period, in rupees"
            placeholder="1800"
          />
          <SelectField
            id="price-period"
            label="Billing period"
            value={values.pricePeriod}
            options={enumOptions(PRICING_PERIODS)}
            onChange={(value) => patch({ pricePeriod: value })}
            error={errors.pricePeriod}
          />
        </motion.div>
        <motion.div className="field-row" variants={stagger(0.04)} initial="hidden" animate="show" transition={{ delay: 0.05 }}>
          <TextField id="price-unit-label" label="Unit label" value={values.priceUnitLabel} onChange={(value) => patch({ priceUnitLabel: value })} error={errors.priceUnitLabel} hint='e.g. "per sq.ft / month"' />
          <NumberField id="price-min-quantity" label="Minimum quantity" value={values.priceMinQuantity} onChange={(value) => patch({ priceMinQuantity: value })} error={errors.priceMinQuantity} min="1" />
          <TextField id="available-from" label="Available from" type="date" value={values.availableFrom} onChange={(value) => patch({ availableFrom: value })} error={errors.availableFrom} />
        </motion.div>
      </FormSection>

      {/* Type-specific details */}
      <FormSection label={`${LISTING_TYPE_LABELS[type]} details`} description={`These fields follow the ${LISTING_TYPE_LABELS[type].toLowerCase()} listing type and are required before publishing.`} delay={0.15}>
        {type === 'WAREHOUSE' ? <WarehouseFields values={values} errors={errors} patch={patchWarehouse} /> : null}
        {type === 'EQUIPMENT' ? <EquipmentFields values={values} errors={errors} patch={patchEquipment} /> : null}
        {type === 'SERVICE' ? <ServiceFields values={values} errors={errors} patch={patchService} /> : null}
      </FormSection>

      {/* Media */}
      <FormSection label="Photos" description="Upload up to 15 images. The first image becomes the cover." delay={0.2}>
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          <FileUpload
            folder="listings"
            label="Listing images *"
            hint="First image becomes the cover. Up to 15 images."
            multiple
            maxFiles={15}
            initialUrls={values.images}
            initialNames={values.images.map((_, index) => `Image ${index + 1}`)}
            onChange={(urls) => patch({ images: urls })}
          />
          {errors.images ? <span className="field__error">{errors.images}</span> : null}
        </motion.div>
      </FormSection>

      {/* Amenities, safety & house rules */}
      <FormSection label="Amenities, safety & house rules" description="Help customers understand what's available and what's expected." delay={0.25}>
        <motion.div className="field-row" variants={stagger(0.04)} initial="hidden" animate="show">
          <TextAreaField id="listing-amenities" label="Amenities" rows={3} value={values.amenitiesText} onChange={(value) => patch({ amenitiesText: value })} error={errors.amenities} hint="One per line, e.g. CCTV, forklift on site, 24×7 gate" placeholder={'CCTV\nForklift on site\n24x7 gate access'} />
          <TextAreaField id="listing-safety" label="Safety features" rows={3} value={values.safetyText} onChange={(value) => patch({ safetyText: value })} error={errors.safetyFeatures} hint="One per line, e.g. fire extinguishers, sprinkler system" placeholder={'Fire extinguishers\nSprinkler system'} />
        </motion.div>
        <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.05 }}>
          <TextAreaField id="listing-rules" label="House rules" rows={3} value={values.rulesText} onChange={(value) => patch({ rulesText: value })} error={errors.rules} hint="One per line, e.g. no smoking, insured goods only" placeholder={'No smoking on premises\nInsured goods only'} />
        </motion.div>
      </FormSection>

      {/* Booking terms */}
      <FormSection label="Booking terms" description="Set minimum stays, cancellation policy and customer-facing terms." delay={0.3}>
        <motion.div className="field-row" variants={stagger(0.04)} initial="hidden" animate="show">
          <NumberField id="min-duration-value" label="Minimum booking duration" value={values.minDurationValue} onChange={(value) => patch({ minDurationValue: value })} error={errors['minBookingDuration.value']} min="1" hint="Leave empty for no minimum" />
          <SelectField id="min-duration-unit" label="Duration unit" value={values.minDurationUnit} options={enumOptions(PRICING_PERIODS)} onChange={(value) => patch({ minDurationUnit: value })} error={errors['minBookingDuration.unit']} />
        </motion.div>
        <motion.div className="field-row" variants={stagger(0.04)} initial="hidden" animate="show" transition={{ delay: 0.05 }}>
          <SelectField
            id="cancel-policy"
            label="Cancellation policy"
            value={values.cancellationPolicy}
            options={enumOptions(CANCELLATION_POLICIES)}
            onChange={(value) => patch({ cancellationPolicy: value })}
            error={errors['cancellationTerms.policy']}
            required
          />
          <NumberField
            id="cancel-refund"
            label="Customer refund %"
            required
            min="0"
            max="100"
            value={values.cancellationRefundPercent}
            onChange={(value) => patch({ cancellationRefundPercent: value })}
            error={errors['cancellationTerms.customerRefundPercent']}
            hint="0–100, applied when the customer cancels before start"
          />
        </motion.div>
        <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.1 }}>
          <TextAreaField
            id="cancel-description"
            label="Cancellation description"
            required
            value={values.cancellationDescription}
            onChange={(value) => patch({ cancellationDescription: value })}
            error={errors['cancellationTerms.description']}
            hint="Shown to customers at checkout (5–600 characters)"
            placeholder="Free cancellation up to 7 days before the start date; 50% refund up to 48 hours."
          />
        </motion.div>
        <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.15 }}>
          <TextField id="cancel-note" label="Cancellation note (internal)" value={values.cancellationNote} onChange={(value) => patch({ cancellationNote: value })} error={errors['cancellationTerms.note']} />
        </motion.div>
      </FormSection>

      {/* Sticky action bar */}
      <motion.div className="form-actions" variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.35 }}>
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Saving…' : mode === 'create' ? 'Create listing' : 'Save changes'}
        </button>
      </motion.div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Type-specific detail blocks (exact createListingSchema shapes)      */
/* ------------------------------------------------------------------ */

function WarehouseFields({
  values,
  errors,
  patch,
}: {
  values: ListingFormValues;
  errors: FieldErrors;
  patch: (partial: Partial<ListingFormValues['warehouse']>) => void;
}) {
  const w = values.warehouse;
  return (
    <motion.div className="stack" variants={stagger(0.04)} initial="hidden" animate="show">
      {errors.warehouse ? (
        <div className="alert alert--error" role="alert">
          {errors.warehouse}
        </div>
      ) : null}
      <div className="field-row">
        <SelectField id="wh-facility" label="Facility type" required value={w.facilityType} options={enumOptions(FACILITY_TYPES)} onChange={(value) => patch({ facilityType: value })} error={errors['warehouse.facilityType']} />
        <NumberField id="wh-capacity" label="Total capacity" required value={w.totalCapacity} onChange={(value) => patch({ totalCapacity: value })} error={errors['warehouse.totalCapacity']} min="0.01" />
        <SelectField id="wh-capacity-unit" label="Capacity unit" required value={w.capacityUnit} options={enumOptions(CAPACITY_UNITS)} onChange={(value) => patch({ capacityUnit: value })} error={errors['warehouse.capacityUnit']} />
      </div>
      <MultiChecklist
        legend="Storage types"
        values={w.storageTypes}
        options={enumOptions(STORAGE_TYPES)}
        onToggle={(value) =>
          patch({
            storageTypes: w.storageTypes.includes(value) ? w.storageTypes.filter((item) => item !== value) : [...w.storageTypes, value],
          })
        }
        error={errors['warehouse.storageTypes']}
      />
      <div className="field-row">
        <NumberField id="wh-units" label="Number of units" value={w.numberOfUnits} onChange={(value) => patch({ numberOfUnits: value })} error={errors['warehouse.numberOfUnits']} min="1" />
        <TextField id="wh-dimensions" label="Unit dimensions" value={w.unitDimensions} onChange={(value) => patch({ unitDimensions: value })} error={errors['warehouse.unitDimensions']} hint='e.g. 12×10×12 ft' />
        <NumberField id="wh-ceiling" label="Ceiling height (m)" value={w.ceilingHeightM} onChange={(value) => patch({ ceilingHeightM: value })} error={errors['warehouse.ceilingHeightM']} min="0.1" />
      </div>
      <div className="field-row">
        <NumberField id="wh-floor-load" label="Floor load capacity (kg)" value={w.floorLoadCapacityKg} onChange={(value) => patch({ floorLoadCapacityKg: value })} error={errors['warehouse.floorLoadCapacityKg']} min="1" />
        <NumberField id="wh-docks" label="Loading docks" value={w.loadingDocks} onChange={(value) => patch({ loadingDocks: value })} error={errors['warehouse.loadingDocks']} min="0" />
        <NumberField id="wh-driveways" label="Driveways" value={w.driveways} onChange={(value) => patch({ driveways: value })} error={errors['warehouse.driveways']} min="0" />
      </div>
      <div className="checkbox-row checkbox-row--wrap">
        <CheckboxField id="wh-temp" label="Temperature controlled" checked={w.temperatureControlled} onChange={(checked) => patch({ temperatureControlled: checked })} />
        <CheckboxField id="wh-humidity" label="Humidity controlled" checked={w.humidityControlled} onChange={(checked) => patch({ humidityControlled: checked })} />
        <CheckboxField id="wh-power" label="Power backup" checked={w.powerBackup} onChange={(checked) => patch({ powerBackup: checked })} />
        <CheckboxField id="wh-fire" label="Fire safety" checked={w.fireSafety} onChange={(checked) => patch({ fireSafety: checked })} />
        <CheckboxField id="wh-cctv" label="CCTV" checked={w.cctv} onChange={(checked) => patch({ cctv: checked })} />
      </div>
      <TextAreaField id="wh-certs" label="Certifications" rows={2} value={w.certificationsText} onChange={(value) => patch({ certificationsText: value })} error={errors['warehouse.certifications']} hint="One per line, e.g. ISO 9001, FSSAI license" placeholder={'ISO 9001\nFSSAI license'} />
      <TextField id="wh-hours" label="Operating hours" value={w.operatingHours} onChange={(value) => patch({ operatingHours: value })} error={errors['warehouse.operatingHours']} hint='e.g. Mon–Sat 08:00–20:00' />
    </motion.div>
  );
}

function EquipmentFields({
  values,
  errors,
  patch,
}: {
  values: ListingFormValues;
  errors: FieldErrors;
  patch: (partial: Partial<ListingFormValues['equipment']>) => void;
}) {
  const e = values.equipment;
  return (
    <motion.div className="stack" variants={stagger(0.04)} initial="hidden" animate="show">
      {errors.equipment ? (
        <div className="alert alert--error" role="alert">
          {errors.equipment}
        </div>
      ) : null}
      <div className="field-row">
        <SelectField id="eq-category" label="Equipment category" required value={e.equipmentCategory} options={enumOptions(EQUIPMENT_CATEGORIES)} onChange={(value) => patch({ equipmentCategory: value })} error={errors['equipment.equipmentCategory']} />
        <TextField id="eq-brand" label="Brand" value={e.brand} onChange={(value) => patch({ brand: value })} error={errors['equipment.brand']} />
        <TextField id="eq-model" label="Model" value={e.model} onChange={(value) => patch({ model: value })} error={errors['equipment.model']} />
      </div>
      <div className="field-row">
        <NumberField id="eq-year" label="Manufacture year" value={e.manufactureYear} onChange={(value) => patch({ manufactureYear: value })} error={errors['equipment.manufactureYear']} min="1950" max="2100" />
        <NumberField id="eq-quantity" label="Quantity" required value={e.quantity} onChange={(value) => patch({ quantity: value })} error={errors['equipment.quantity']} min="1" />
        <SelectField id="eq-rental-period" label="Rental period" required value={e.rentalPeriod} options={enumOptions(PRICING_PERIODS)} onChange={(value) => patch({ rentalPeriod: value })} error={errors['equipment.rentalPeriod']} />
      </div>
      <div className="field-row">
        <NumberField id="eq-min-rental" label="Minimum rental duration" value={e.minRentalDuration} onChange={(value) => patch({ minRentalDuration: value })} error={errors['equipment.minRentalDuration']} min="1" hint="In rental periods" />
        <NumberField id="eq-operator-charge" label="Operator charge / day (₹)" value={e.operatorChargePerDay} onChange={(value) => patch({ operatorChargePerDay: value })} error={errors['equipment.operatorChargePerDay']} min="0" />
      </div>
      <div className="checkbox-row checkbox-row--wrap">
        <CheckboxField id="eq-delivery" label="Delivery available" checked={e.deliveryAvailable} onChange={(checked) => patch({ deliveryAvailable: checked })} />
        <CheckboxField id="eq-operator" label="Operator available" checked={e.operatorAvailable} onChange={(checked) => patch({ operatorAvailable: checked })} />
      </div>
      <div className="stack">
        <span className="field__label">Specifications</span>
        {errors['equipment.specifications'] ? <span className="field__error">{errors['equipment.specifications']}</span> : null}
        {e.specs.map((row, index) => (
          <div className="spec-row" key={index}>
            <input
              className="input"
              placeholder="Name (e.g. Load capacity)"
              value={row.key}
              aria-label={`Specification ${index + 1} name`}
              onChange={(event) => patch({ specs: e.specs.map((item, i) => (i === index ? { ...item, key: event.target.value } : item)) })}
            />
            <input
              className="input"
              placeholder="Value (e.g. 2.5 t)"
              value={row.value}
              aria-label={`Specification ${index + 1} value`}
              onChange={(event) => patch({ specs: e.specs.map((item, i) => (i === index ? { ...item, value: event.target.value } : item)) })}
            />
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => patch({ specs: e.specs.filter((_, i) => i !== index) })} aria-label={`Remove specification ${index + 1}`}>
              ×
            </button>
          </div>
        ))}
        <div>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => patch({ specs: [...e.specs, { key: '', value: '' }] })}>
            + Add specification
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function ServiceFields({
  values,
  errors,
  patch,
}: {
  values: ListingFormValues;
  errors: FieldErrors;
  patch: (partial: Partial<ListingFormValues['service']>) => void;
}) {
  const s = values.service;
  return (
    <motion.div className="stack" variants={stagger(0.04)} initial="hidden" animate="show">
      {errors.service ? (
        <div className="alert alert--error" role="alert">
          {errors.service}
        </div>
      ) : null}
      <SelectField id="srv-type" label="Service type" required value={s.serviceType} options={enumOptions(SERVICE_TYPES)} onChange={(value) => patch({ serviceType: value })} error={errors['service.serviceType']} />
      <TextAreaField
        id="srv-areas"
        label="Service areas"
        required
        rows={3}
        value={s.serviceAreasText}
        onChange={(value) => patch({ serviceAreasText: value })}
        error={errors['service.serviceAreas']}
        hint="One per line — cities or regions you serve"
        placeholder={'Pune\nNashik\nMumbai'}
      />
      <div className="field-row">
        <NumberField id="srv-duration" label="Estimated duration (hours)" value={s.estimatedDurationHours} onChange={(value) => patch({ estimatedDurationHours: value })} error={errors['service.estimatedDurationHours']} min="0.5" />
        <NumberField id="srv-team" label="Team size" value={s.teamSize} onChange={(value) => patch({ teamSize: value })} error={errors['service.teamSize']} min="1" />
        <NumberField id="srv-capacity" label="Daily capacity" value={s.dailyCapacity} onChange={(value) => patch({ dailyCapacity: value })} error={errors['service.dailyCapacity']} min="1" hint="Concurrent jobs per day" />
      </div>
      <TextAreaField id="srv-requirements" label="Requirements" rows={2} value={s.requirements} onChange={(value) => patch({ requirements: value })} error={errors['service.requirements']} hint="What customers need to arrange (site access, PPE…)" />
    </motion.div>
  );
}