/**
 * Form-state helpers for the listing create/edit form.
 *
 * `createListingSchema` / `updateListingSchema` (packages/validation) expect
 * prices in MAJOR units (rupees) — the API converts to minor units server-side.
 * The form therefore collects rupees and submits rupees; display everywhere
 * uses minor units via `formatMoney`.
 */
import type { AddressValues, FieldErrors } from './validation';
import { validateAddress } from './validation';
import { toMajor } from './format';
import {
  CANCELLATION_POLICIES,
  CAPACITY_UNITS,
  EQUIPMENT_CATEGORIES,
  FACILITY_TYPES,
  PRICING_MODELS,
  PRICING_PERIODS,
  SERVICE_TYPES,
  STORAGE_TYPES,
  type CancellationPolicy,
  type CapacityUnit,
  type EquipmentCategory,
  type FacilityType,
  type ListingDetailDTO,
  type ListingType,
  type PricingModel,
  type PricingPeriod,
  type ServiceType,
  type StorageType,
} from './types';

export interface SpecRow {
  key: string;
  value: string;
}

export interface ListingLocationValues extends AddressValues {
  country: string;
  region: string;
}

export interface WarehouseFormValues {
  facilityType: '' | FacilityType;
  storageTypes: StorageType[];
  totalCapacity: string;
  capacityUnit: '' | CapacityUnit;
  numberOfUnits: string;
  unitDimensions: string;
  ceilingHeightM: string;
  floorLoadCapacityKg: string;
  loadingDocks: string;
  driveways: string;
  temperatureControlled: boolean;
  humidityControlled: boolean;
  powerBackup: boolean;
  fireSafety: boolean;
  cctv: boolean;
  certificationsText: string;
  operatingHours: string;
}

export interface EquipmentFormValues {
  equipmentCategory: '' | EquipmentCategory;
  brand: string;
  model: string;
  manufactureYear: string;
  quantity: string;
  rentalPeriod: '' | PricingPeriod;
  deliveryAvailable: boolean;
  operatorAvailable: boolean;
  operatorChargePerDay: string;
  minRentalDuration: string;
  specs: SpecRow[];
}

export interface ServiceFormValues {
  serviceType: '' | ServiceType;
  serviceAreasText: string;
  estimatedDurationHours: string;
  teamSize: string;
  dailyCapacity: string;
  requirements: string;
}

export interface ListingFormValues {
  title: string;
  description: string;
  categoryId: string;
  location: ListingLocationValues;
  priceModel: '' | PricingModel;
  priceAmount: string;
  pricePeriod: '' | PricingPeriod;
  priceUnitLabel: string;
  priceMinQuantity: string;
  images: string[];
  amenitiesText: string;
  safetyText: string;
  rulesText: string;
  minDurationValue: string;
  minDurationUnit: '' | PricingPeriod;
  cancellationPolicy: CancellationPolicy;
  cancellationDescription: string;
  cancellationRefundPercent: string;
  cancellationNote: string;
  availableFrom: string;
  warehouse: WarehouseFormValues;
  equipment: EquipmentFormValues;
  service: ServiceFormValues;
}

export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  WAREHOUSE: 'Warehouse',
  EQUIPMENT: 'Equipment',
  SERVICE: 'Service',
};

function emptyWarehouse(): WarehouseFormValues {
  return {
    facilityType: '',
    storageTypes: [],
    totalCapacity: '',
    capacityUnit: '',
    numberOfUnits: '',
    unitDimensions: '',
    ceilingHeightM: '',
    floorLoadCapacityKg: '',
    loadingDocks: '0',
    driveways: '0',
    temperatureControlled: false,
    humidityControlled: false,
    powerBackup: false,
    fireSafety: false,
    cctv: false,
    certificationsText: '',
    operatingHours: '',
  };
}

function emptyEquipment(): EquipmentFormValues {
  return {
    equipmentCategory: '',
    brand: '',
    model: '',
    manufactureYear: '',
    quantity: '',
    rentalPeriod: 'DAY',
    deliveryAvailable: false,
    operatorAvailable: false,
    operatorChargePerDay: '',
    minRentalDuration: '',
    specs: [],
  };
}

function emptyService(): ServiceFormValues {
  return {
    serviceType: '',
    serviceAreasText: '',
    estimatedDurationHours: '',
    teamSize: '',
    dailyCapacity: '',
    requirements: '',
  };
}

export function emptyListingValues(): ListingFormValues {
  return {
    title: '',
    description: '',
    categoryId: '',
    location: { addressLine1: '', addressLine2: '', landmark: '', city: '', state: '', postalCode: '', country: 'India', region: '' },
    priceModel: '',
    priceAmount: '',
    pricePeriod: '',
    priceUnitLabel: '',
    priceMinQuantity: '',
    images: [],
    amenitiesText: '',
    safetyText: '',
    rulesText: '',
    minDurationValue: '',
    minDurationUnit: '',
    cancellationPolicy: 'MODERATE',
    cancellationDescription: '',
    cancellationRefundPercent: '100',
    cancellationNote: '',
    availableFrom: '',
    warehouse: emptyWarehouse(),
    equipment: emptyEquipment(),
    service: emptyService(),
  };
}

export function listingValuesFromDetail(detail: ListingDetailDTO): ListingFormValues {
  const values = emptyListingValues();
  values.title = detail.title;
  values.description = detail.description;
  values.categoryId = detail.categoryId ?? '';
  values.location = {
    addressLine1: detail.location.addressLine1 ?? '',
    addressLine2: detail.location.addressLine2 ?? '',
    landmark: detail.location.landmark ?? '',
    city: detail.location.city ?? '',
    state: detail.location.state ?? '',
    postalCode: detail.location.postalCode ?? '',
    country: detail.location.country ?? 'India',
    region: detail.location.region ?? '',
  };
  values.priceModel = detail.price?.model ?? '';
  values.priceAmount = detail.price?.amount != null ? String(toMajor(detail.price.amount)) : '';
  values.pricePeriod = detail.price?.period ?? '';
  values.priceUnitLabel = detail.price?.unitLabel ?? '';
  values.priceMinQuantity = detail.price?.minQuantity != null ? String(detail.price.minQuantity) : '';
  values.images = [...(detail.images ?? [])];
  values.amenitiesText = (detail.amenities ?? []).join('\n');
  values.safetyText = (detail.safetyFeatures ?? []).join('\n');
  values.rulesText = (detail.rules ?? []).join('\n');
  values.minDurationValue = detail.minBookingDuration ? String(detail.minBookingDuration.value) : '';
  values.minDurationUnit = detail.minBookingDuration?.unit ?? '';
  values.cancellationPolicy = detail.cancellationTerms?.policy ?? 'MODERATE';
  values.cancellationDescription = detail.cancellationTerms?.description ?? '';
  values.cancellationRefundPercent =
    detail.cancellationTerms?.customerRefundPercent != null ? String(detail.cancellationTerms.customerRefundPercent) : '100';
  values.cancellationNote = detail.cancellationTerms?.note ?? '';
  values.availableFrom = detail.availableFrom ? detail.availableFrom.slice(0, 10) : '';

  if (detail.warehouse) {
    const w = detail.warehouse;
    values.warehouse = {
      facilityType: w.facilityType,
      storageTypes: [...(w.storageTypes ?? [])],
      totalCapacity: String(w.totalCapacity ?? ''),
      capacityUnit: w.capacityUnit ?? '',
      numberOfUnits: w.numberOfUnits != null ? String(w.numberOfUnits) : '',
      unitDimensions: w.unitDimensions ?? '',
      ceilingHeightM: w.ceilingHeightM != null ? String(w.ceilingHeightM) : '',
      floorLoadCapacityKg: w.floorLoadCapacityKg != null ? String(w.floorLoadCapacityKg) : '',
      loadingDocks: String(w.loadingDocks ?? 0),
      driveways: String(w.driveways ?? 0),
      temperatureControlled: Boolean(w.temperatureControlled),
      humidityControlled: Boolean(w.humidityControlled),
      powerBackup: Boolean(w.powerBackup),
      fireSafety: Boolean(w.fireSafety),
      cctv: Boolean(w.cctv),
      certificationsText: (w.certifications ?? []).join('\n'),
      operatingHours: w.operatingHours ?? '',
    };
  }
  if (detail.equipment) {
    const e = detail.equipment;
    values.equipment = {
      equipmentCategory: e.equipmentCategory,
      brand: e.brand ?? '',
      model: e.model ?? '',
      manufactureYear: e.manufactureYear != null ? String(e.manufactureYear) : '',
      quantity: String(e.quantity ?? ''),
      rentalPeriod: e.rentalPeriod ?? 'DAY',
      deliveryAvailable: Boolean(e.deliveryAvailable),
      operatorAvailable: Boolean(e.operatorAvailable),
      operatorChargePerDay: e.operatorChargePerDay != null ? String(toMajor(e.operatorChargePerDay)) : '',
      minRentalDuration: e.minRentalDuration != null ? String(e.minRentalDuration) : '',
      specs: Object.entries(e.specifications ?? {}).map(([key, value]) => ({ key, value })),
    };
  }
  if (detail.service) {
    const s = detail.service;
    values.service = {
      serviceType: s.serviceType,
      serviceAreasText: (s.serviceAreas ?? []).join('\n'),
      estimatedDurationHours: s.estimatedDurationHours != null ? String(s.estimatedDurationHours) : '',
      teamSize: s.teamSize != null ? String(s.teamSize) : '',
      dailyCapacity: s.dailyCapacity != null ? String(s.dailyCapacity) : '',
      requirements: s.requirements ?? '',
    };
  }
  return values;
}

export function splitLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function num(value: string): number | undefined {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function optionalText(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : null;
}

/** Validate a numeric form string: positive, integer, min/max. */
function checkNumber(
  errors: FieldErrors,
  path: string,
  raw: string,
  label: string,
  opts: { integer?: boolean; min?: number; max?: number; required?: boolean } = {},
): void {
  const value = num(raw);
  if (value === undefined) {
    if (opts.required) errors[path] = `${label} is required`;
    return;
  }
  if (Number.isNaN(value)) {
    errors[path] = `${label} must be a number`;
    return;
  }
  if (opts.integer && !Number.isInteger(value)) {
    errors[path] = `${label} must be a whole number`;
    return;
  }
  if (opts.min !== undefined && value < opts.min) {
    errors[path] = `${label} must be ${opts.min === 0 ? 'zero or more' : `at least ${opts.min}`}`;
    return;
  }
  if (opts.max !== undefined && value > opts.max) {
    errors[path] = `${label} must be at most ${opts.max}`;
  }
}

function validateList(errors: FieldErrors, path: string, items: string[], maxItems: number, itemMax: number, label: string): void {
  if (items.length > maxItems) {
    errors[path] = `Add at most ${maxItems} ${label}`;
    return;
  }
  const tooLong = items.find((item) => item.length > itemMax);
  if (tooLong) errors[path] = `Each ${label} entry must be at most ${itemMax} characters`;
}

/**
 * Client-side mirror of `createListingSchema` (and the update schema for edit
 * mode). The type-specific details block (warehouse/equipment/service) is
 * required depending on `type`, mirroring the schema's `superRefine`.
 */
export function validateListingValues(type: ListingType, values: ListingFormValues): FieldErrors {
  const errors: FieldErrors = {};

  const title = values.title.trim();
  if (!title) errors.title = 'Title is required';
  else if (title.length < 8) errors.title = 'Title must be at least 8 characters';
  else if (title.length > 160) errors.title = 'Title must be at most 160 characters';

  const description = values.description.trim();
  if (!description) errors.description = 'Description is required';
  else if (description.length < 40) errors.description = 'Description must be at least 40 characters';
  else if (description.length > 5000) errors.description = 'Description must be at most 5000 characters';

  if (!values.categoryId) errors.categoryId = 'Pick a category';

  validateAddress(values.location, errors, 'location');
  if (!values.location.country.trim()) errors['location.country'] = 'Country is required';

  if (!values.priceModel) errors.priceModel = 'Pick a pricing model';
  const price = num(values.priceAmount);
  if (price === undefined) errors.priceAmount = 'Price is required';
  else if (Number.isNaN(price)) errors.priceAmount = 'Price must be a number';
  else if (price <= 0) errors.priceAmount = 'Price must be greater than zero';
  else if (price > 1_000_000_000) errors.priceAmount = 'Amount is too large';
  if (values.priceUnitLabel.trim().length > 80) errors.priceUnitLabel = 'Unit label must be at most 80 characters';
  checkNumber(errors, 'priceMinQuantity', values.priceMinQuantity, 'Minimum quantity', { integer: true, min: 1, max: 1_000_000 });

  if (values.images.length < 1) errors.images = 'Add at least one image';
  else if (values.images.length > 15) errors.images = 'Add at most 15 images';

  validateList(errors, 'amenities', splitLines(values.amenitiesText), 40, 60, 'amenities');
  validateList(errors, 'safetyFeatures', splitLines(values.safetyText), 30, 60, 'safety features');
  validateList(errors, 'rules', splitLines(values.rulesText), 30, 300, 'rules');

  if (values.minDurationValue.trim() || values.minDurationUnit) {
    checkNumber(errors, 'minBookingDuration.value', values.minDurationValue, 'Minimum booking duration', {
      integer: true,
      min: 1,
      max: 10_000,
      required: true,
    });
    if (!values.minDurationUnit) errors['minBookingDuration.unit'] = 'Pick a duration unit';
  }

  if (!(CANCELLATION_POLICIES as readonly string[]).includes(values.cancellationPolicy)) {
    errors['cancellationTerms.policy'] = 'Pick a valid cancellation policy';
  }
  const cancellationDescription = values.cancellationDescription.trim();
  if (!cancellationDescription) errors['cancellationTerms.description'] = 'Cancellation description is required';
  else if (cancellationDescription.length < 5) errors['cancellationTerms.description'] = 'Cancellation description must be at least 5 characters';
  else if (cancellationDescription.length > 600) errors['cancellationTerms.description'] = 'Cancellation description must be at most 600 characters';
  checkNumber(errors, 'cancellationTerms.customerRefundPercent', values.cancellationRefundPercent, 'Refund percent', {
    integer: true,
    min: 0,
    max: 100,
    required: true,
  });
  if (values.cancellationNote.trim().length > 400) errors['cancellationTerms.note'] = 'Note must be at most 400 characters';

  if (values.availableFrom && Number.isNaN(Date.parse(values.availableFrom))) {
    errors.availableFrom = 'Pick a valid date';
  }

  if (type === 'WAREHOUSE') validateWarehouse(errors, values.warehouse);
  if (type === 'EQUIPMENT') validateEquipment(errors, values.equipment);
  if (type === 'SERVICE') validateService(errors, values.service);

  return errors;
}

function validateWarehouse(errors: FieldErrors, w: WarehouseFormValues): void {
  if (!(FACILITY_TYPES as readonly string[]).includes(w.facilityType)) {
    errors.warehouse = 'Warehouse details are required';
    errors['warehouse.facilityType'] = 'Pick a facility type';
  }
  if (w.storageTypes.length < 1) errors['warehouse.storageTypes'] = 'Pick at least one storage type';
  else if (w.storageTypes.length > 10) errors['warehouse.storageTypes'] = 'Pick at most 10 storage types';
  checkNumber(errors, 'warehouse.totalCapacity', w.totalCapacity, 'Total capacity', { min: 0.01, max: 10_000_000, required: true });
  if (!(CAPACITY_UNITS as readonly string[]).includes(w.capacityUnit)) {
    errors['warehouse.capacityUnit'] = 'Pick a capacity unit';
  }
  checkNumber(errors, 'warehouse.numberOfUnits', w.numberOfUnits, 'Number of units', { integer: true, min: 1, max: 100_000 });
  if (w.unitDimensions.trim().length > 200) errors['warehouse.unitDimensions'] = 'Unit dimensions must be at most 200 characters';
  checkNumber(errors, 'warehouse.ceilingHeightM', w.ceilingHeightM, 'Ceiling height', { min: 0.1, max: 100 });
  checkNumber(errors, 'warehouse.floorLoadCapacityKg', w.floorLoadCapacityKg, 'Floor load capacity', { min: 1, max: 1_000_000 });
  checkNumber(errors, 'warehouse.loadingDocks', w.loadingDocks, 'Loading docks', { integer: true, min: 0, max: 500 });
  checkNumber(errors, 'warehouse.driveways', w.driveways, 'Driveways', { integer: true, min: 0, max: 500 });
  validateList(errors, 'warehouse.certifications', splitLines(w.certificationsText), 20, 120, 'certifications');
  if (w.operatingHours.trim().length > 120) errors['warehouse.operatingHours'] = 'Operating hours must be at most 120 characters';
}

function validateEquipment(errors: FieldErrors, e: EquipmentFormValues): void {
  if (!(EQUIPMENT_CATEGORIES as readonly string[]).includes(e.equipmentCategory)) {
    errors.equipment = 'Equipment details are required';
    errors['equipment.equipmentCategory'] = 'Pick an equipment category';
  }
  if (e.brand.trim().length > 80) errors['equipment.brand'] = 'Brand must be at most 80 characters';
  if (e.model.trim().length > 80) errors['equipment.model'] = 'Model must be at most 80 characters';
  checkNumber(errors, 'equipment.manufactureYear', e.manufactureYear, 'Manufacture year', { integer: true, min: 1950, max: 2100 });
  checkNumber(errors, 'equipment.quantity', e.quantity, 'Quantity', { integer: true, min: 1, max: 100_000, required: true });
  if (!(PRICING_PERIODS as readonly string[]).includes(e.rentalPeriod)) {
    errors['equipment.rentalPeriod'] = 'Pick a rental period';
  }
  checkNumber(errors, 'equipment.operatorChargePerDay', e.operatorChargePerDay, 'Operator charge per day', { min: 0, max: 1_000_000_000 });
  checkNumber(errors, 'equipment.minRentalDuration', e.minRentalDuration, 'Minimum rental duration', { integer: true, min: 1, max: 10_000 });
  const rows = e.specs.filter((row) => row.key.trim() || row.value.trim());
  for (const row of rows) {
    if (!row.key.trim()) {
      errors['equipment.specifications'] = 'Each specification needs a name';
      break;
    }
    if (row.key.trim().length > 60 || row.value.length > 200) {
      errors['equipment.specifications'] = 'Specification names must be ≤ 60 and values ≤ 200 characters';
      break;
    }
  }
}

function validateService(errors: FieldErrors, s: ServiceFormValues): void {
  if (!(SERVICE_TYPES as readonly string[]).includes(s.serviceType)) {
    errors.service = 'Service details are required';
    errors['service.serviceType'] = 'Pick a service type';
  }
  const areas = splitLines(s.serviceAreasText);
  if (areas.length < 1) errors['service.serviceAreas'] = 'Add at least one service area';
  else if (areas.length > 30) errors['service.serviceAreas'] = 'Add at most 30 service areas';
  else if (areas.some((area) => area.length < 2 || area.length > 120)) {
    errors['service.serviceAreas'] = 'Each service area must be 2–120 characters';
  }
  checkNumber(errors, 'service.estimatedDurationHours', s.estimatedDurationHours, 'Estimated duration (hours)', {
    min: 0.5,
    max: 10_000,
  });
  checkNumber(errors, 'service.teamSize', s.teamSize, 'Team size', { integer: true, min: 1, max: 500 });
  checkNumber(errors, 'service.dailyCapacity', s.dailyCapacity, 'Daily capacity', { integer: true, min: 1, max: 100_000 });
  if (s.requirements.trim().length > 600) errors['service.requirements'] = 'Requirements must be at most 600 characters';
}

function buildLocation(values: ListingFormValues) {
  return {
    addressLine1: values.location.addressLine1.trim(),
    addressLine2: optionalText(values.location.addressLine2),
    landmark: optionalText(values.location.landmark),
    city: values.location.city.trim(),
    state: values.location.state.trim(),
    postalCode: values.location.postalCode.trim(),
    country: values.location.country.trim() || 'India',
    region: optionalText(values.location.region),
  };
}

function buildPrice(values: ListingFormValues) {
  // The form collects rupees (major units); createListingSchema expects major
  // units and the API converts to minor units server-side.
  return {
    model: values.priceModel,
    amount: Number(values.priceAmount.trim()) || 0,
    currency: 'INR',
    period: values.pricePeriod || null,
    unitLabel: optionalText(values.priceUnitLabel),
    minQuantity: values.priceMinQuantity.trim() ? Number(values.priceMinQuantity) : null,
    additionalCharges: [],
  };
}

function buildWarehouse(w: WarehouseFormValues) {
  return {
    facilityType: w.facilityType,
    storageTypes: w.storageTypes,
    totalCapacity: Number(w.totalCapacity),
    capacityUnit: w.capacityUnit,
    numberOfUnits: w.numberOfUnits.trim() ? Number(w.numberOfUnits) : null,
    unitDimensions: optionalText(w.unitDimensions),
    ceilingHeightM: w.ceilingHeightM.trim() ? Number(w.ceilingHeightM) : null,
    floorLoadCapacityKg: w.floorLoadCapacityKg.trim() ? Number(w.floorLoadCapacityKg) : null,
    loadingDocks: Number(w.loadingDocks || 0),
    driveways: Number(w.driveways || 0),
    temperatureControlled: w.temperatureControlled,
    humidityControlled: w.humidityControlled,
    powerBackup: w.powerBackup,
    fireSafety: w.fireSafety,
    cctv: w.cctv,
    certifications: splitLines(w.certificationsText),
    operatingHours: optionalText(w.operatingHours),
  };
}

function buildEquipment(e: EquipmentFormValues) {
  const specifications: Record<string, string> = {};
  for (const row of e.specs) {
    const key = row.key.trim();
    if (key) specifications[key] = row.value.trim();
  }
  return {
    equipmentCategory: e.equipmentCategory,
    brand: optionalText(e.brand),
    model: optionalText(e.model),
    manufactureYear: e.manufactureYear.trim() ? Number(e.manufactureYear) : null,
    quantity: Number(e.quantity),
    rentalPeriod: e.rentalPeriod || 'DAY',
    deliveryAvailable: e.deliveryAvailable,
    operatorAvailable: e.operatorAvailable,
    operatorChargePerDay: e.operatorChargePerDay.trim() ? Number(e.operatorChargePerDay) : null,
    minRentalDuration: e.minRentalDuration.trim() ? Number(e.minRentalDuration) : null,
    specifications,
  };
}

function buildService(s: ServiceFormValues) {
  return {
    serviceType: s.serviceType,
    serviceAreas: splitLines(s.serviceAreasText),
    estimatedDurationHours: s.estimatedDurationHours.trim() ? Number(s.estimatedDurationHours) : null,
    teamSize: s.teamSize.trim() ? Number(s.teamSize) : null,
    dailyCapacity: s.dailyCapacity.trim() ? Number(s.dailyCapacity) : null,
    requirements: optionalText(s.requirements),
  };
}

function buildBase(values: ListingFormValues) {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    categoryId: values.categoryId,
    location: buildLocation(values),
    price: buildPrice(values),
    images: values.images,
    amenities: splitLines(values.amenitiesText),
    safetyFeatures: splitLines(values.safetyText),
    rules: splitLines(values.rulesText),
    minBookingDuration:
      values.minDurationValue.trim() && values.minDurationUnit
        ? { value: Number(values.minDurationValue), unit: values.minDurationUnit }
        : null,
    cancellationTerms: {
      policy: values.cancellationPolicy,
      description: values.cancellationDescription.trim(),
      customerRefundPercent: Number(values.cancellationRefundPercent || 0),
      note: optionalText(values.cancellationNote),
    },
    availableFrom: values.availableFrom ? new Date(`${values.availableFrom}T00:00:00.000Z`).toISOString() : null,
  };
}

/** POST /partner/listings body (createListingSchema shape). */
export function buildCreateListingPayload(type: ListingType, values: ListingFormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = { type, ...buildBase(values) };
  if (type === 'WAREHOUSE') payload.warehouse = buildWarehouse(values.warehouse);
  if (type === 'EQUIPMENT') payload.equipment = buildEquipment(values.equipment);
  if (type === 'SERVICE') payload.service = buildService(values.service);
  return payload;
}

/** PATCH /partner/listings/:id body (updateListingSchema shape — no `type`). */
export function buildUpdateListingPayload(type: ListingType, values: ListingFormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = buildBase(values);
  if (type === 'WAREHOUSE') payload.warehouse = buildWarehouse(values.warehouse);
  if (type === 'EQUIPMENT') payload.equipment = buildEquipment(values.equipment);
  if (type === 'SERVICE') payload.service = buildService(values.service);
  return payload;
}

/** Enum option helpers for selects. */
export function enumOptions<T extends string>(values: readonly T[]): { value: T; label: string }[] {
  return values.map((value) => ({
    value,
    label: value
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase()),
  }));
}

export { PRICING_MODELS, PRICING_PERIODS, CAPACITY_UNITS, FACILITY_TYPES, STORAGE_TYPES, EQUIPMENT_CATEGORIES, SERVICE_TYPES, CANCELLATION_POLICIES };
