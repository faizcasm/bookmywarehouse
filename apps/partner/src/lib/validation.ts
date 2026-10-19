/**
 * Client-side mirrors of the API Zod schemas (packages/validation) used to
 * validate forms before submitting. Paths match the Zod issue paths so server
 * issues can be merged into the same `{ field: message }` map.
 */
import { BUSINESS_TYPES } from './types';

export type FieldErrors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+0-9][0-9 -]{7,16}$/;
const POSTAL_RE = /^[0-9A-Za-z -]{4,12}$/;
const GST_RE = /^[0-9A-Z]{15}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[0-9A-Z]$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_RE = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/;
const WEBSITE_RE = /^https?:\/\/\S+$/;

export interface AddressValues {
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  region?: string;
}

export interface LoginValues {
  email: string;
  password: string;
}

export function validateLogin(values: LoginValues): FieldErrors {
  const errors: FieldErrors = {};
  const email = values.email.trim();
  if (!email) errors.email = 'Email is required';
  else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address';
  if (!values.password) errors.password = 'Password is required';
  else if (values.password.length > 72) errors.password = 'Password must be at most 72 characters';
  return errors;
}

export interface RegisterValues {
  name: string;
  email: string;
  password: string;
  phone?: string;
  businessName?: string;
}

export function validateRegister(values: RegisterValues): FieldErrors {
  const errors: FieldErrors = {};
  const name = values.name.trim();
  if (!name) errors.name = 'Name is required';
  else if (name.length < 2) errors.name = 'Name must be at least 2 characters';
  else if (name.length > 80) errors.name = 'Name must be at most 80 characters';

  const email = values.email.trim();
  if (!email) errors.email = 'Email is required';
  else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address';

  if (!values.password) errors.password = 'Password is required';
  else {
    if (values.password.length < 8) errors.password = 'Password must be at least 8 characters';
    else if (values.password.length > 72) errors.password = 'Password must be at most 72 characters';
    else if (!/[a-zA-Z]/.test(values.password)) errors.password = 'Password must contain a letter';
    else if (!/[0-9]/.test(values.password)) errors.password = 'Password must contain a number';
  }

  if (values.phone && values.phone.trim() && !PHONE_RE.test(values.phone.trim())) {
    errors.phone = 'Enter a valid phone number';
  }
  if (values.businessName && values.businessName.trim().length > 0 && values.businessName.trim().length < 2) {
    errors.businessName = 'Business name must be at least 2 characters';
  }
  return errors;
}

export function validateAddress(address: AddressValues, errors: FieldErrors, prefix = 'address'): void {
  const line1 = (address.addressLine1 ?? '').trim();
  if (!line1) errors[`${prefix}.addressLine1`] = 'Address line 1 is required';
  else if (line1.length < 3) errors[`${prefix}.addressLine1`] = 'Address line 1 must be at least 3 characters';
  else if (line1.length > 200) errors[`${prefix}.addressLine1`] = 'Address line 1 must be at most 200 characters';

  const city = (address.city ?? '').trim();
  if (!city) errors[`${prefix}.city`] = 'City is required';
  else if (city.length < 2) errors[`${prefix}.city`] = 'City must be at least 2 characters';

  const state = (address.state ?? '').trim();
  if (!state) errors[`${prefix}.state`] = 'State is required';
  else if (state.length < 2) errors[`${prefix}.state`] = 'State must be at least 2 characters';

  const postal = (address.postalCode ?? '').trim();
  if (!postal) errors[`${prefix}.postalCode`] = 'Postal / PIN code is required';
  else if (!POSTAL_RE.test(postal)) errors[`${prefix}.postalCode`] = 'Must be a valid postal / PIN code';
}

export function validateBusinessType(value: string): boolean {
  return (BUSINESS_TYPES as readonly string[]).includes(value);
}

export interface OnboardingValues {
  businessName: string;
  businessType: string;
  description?: string;
  address: AddressValues;
  website?: string;
  logoUrl?: string;
  supportedTypes: string[];
}

/** Mirrors partnerOnboardingSchema. */
export function validateOnboarding(values: OnboardingValues): FieldErrors {
  const errors: FieldErrors = {};
  const businessName = values.businessName.trim();
  if (!businessName) errors.businessName = 'Business name is required';
  else if (businessName.length < 2) errors.businessName = 'Business name is required';
  else if (businessName.length > 120) errors.businessName = 'Business name must be at most 120 characters';

  if (!validateBusinessType(values.businessType)) errors.businessType = 'Select a valid business type';

  if (values.description && values.description.length > 2000) {
    errors.description = 'Description must be at most 2000 characters';
  }

  validateAddress(values.address, errors);

  const website = (values.website ?? '').trim();
  if (website && !WEBSITE_RE.test(website)) errors.website = 'Website must be a valid URL';

  const logoUrl = (values.logoUrl ?? '').trim();
  if (logoUrl && !logoUrl.startsWith('https://') && !logoUrl.startsWith('http://localhost') && !logoUrl.startsWith('data:image/')) {
    errors.logoUrl = 'Invalid logo';
  }

  if (values.supportedTypes.length < 1) errors.supportedTypes = 'Select at least one listing type';
  else if (values.supportedTypes.length > 3) errors.supportedTypes = 'Select at most 3 listing types';

  return errors;
}

export interface VerificationDocumentValues {
  label: string;
  url: string;
}

export interface VerificationValues {
  legalBusinessName: string;
  businessType: string;
  gstNumber?: string;
  panNumber?: string;
  registrationNumber?: string;
  address: AddressValues;
  documents: VerificationDocumentValues[];
}

/** Mirrors submitVerificationSchema. */
export function validateVerification(values: VerificationValues): FieldErrors {
  const errors: FieldErrors = {};
  const legal = values.legalBusinessName.trim();
  if (!legal) errors.legalBusinessName = 'Legal business name is required';
  else if (legal.length < 2) errors.legalBusinessName = 'Legal business name must be at least 2 characters';
  else if (legal.length > 160) errors.legalBusinessName = 'Legal business name must be at most 160 characters';

  if (!validateBusinessType(values.businessType)) errors.businessType = 'Select a valid business type';

  const gst = (values.gstNumber ?? '').trim();
  if (gst && !GST_RE.test(gst)) errors.gstNumber = 'GST number must be 15 characters';

  const pan = (values.panNumber ?? '').trim().toUpperCase();
  if (pan && !PAN_RE.test(pan)) errors.panNumber = 'PAN must look like ABCDE1234F';

  if ((values.registrationNumber ?? '').trim().length > 60) {
    errors.registrationNumber = 'Registration number must be at most 60 characters';
  }

  validateAddress(values.address, errors);

  if (values.documents.length < 1) errors.documents = 'Upload at least one document';
  else if (values.documents.length > 10) errors.documents = 'You can add at most 10 documents';
  else if (values.documents.some((doc) => doc.label.trim().length < 2)) {
    errors.documents = 'Each document needs a label of at least 2 characters';
  } else if (values.documents.some((doc) => !doc.url.trim())) {
    errors.documents = 'Upload the file for each document row';
  }

  return errors;
}

export interface PayoutValues {
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  upiId?: string;
}

/** Mirrors payoutDetailsSchema. */
export function validatePayout(values: PayoutValues): FieldErrors {
  const errors: FieldErrors = {};
  const holder = values.accountHolderName.trim();
  if (!holder) errors.accountHolderName = 'Account holder name is required';
  else if (holder.length < 2) errors.accountHolderName = 'Account holder name must be at least 2 characters';

  const account = values.accountNumber.trim();
  if (!account) errors.accountNumber = 'Account number is required';
  else if (!/^[0-9]{6,20}$/.test(account)) errors.accountNumber = 'Enter a valid account number';

  const ifsc = values.ifsc.trim().toUpperCase();
  if (!ifsc) errors.ifsc = 'IFSC code is required';
  else if (!IFSC_RE.test(ifsc)) errors.ifsc = 'Enter a valid IFSC code';

  const bank = values.bankName.trim();
  if (!bank) errors.bankName = 'Bank name is required';
  else if (bank.length < 2) errors.bankName = 'Bank name must be at least 2 characters';

  const upi = (values.upiId ?? '').trim();
  if (upi && !UPI_RE.test(upi)) errors.upiId = 'Enter a valid UPI ID';

  return errors;
}

export interface AvailabilityRuleValues {
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  startDate?: string;
  endDate?: string;
}

/** Mirrors availabilityRuleSchema. */
export function validateAvailabilityRule(values: AvailabilityRuleValues): FieldErrors {
  const errors: FieldErrors = {};
  if (values.daysOfWeek.length < 1) errors.daysOfWeek = 'Select at least one day';
  else if (values.daysOfWeek.length > 7) errors.daysOfWeek = 'Select at most 7 days';

  if (!TIME_RE.test(values.startTime.trim())) errors.startTime = 'Use 24h HH:mm format';
  if (!TIME_RE.test(values.endTime.trim())) errors.endTime = 'Use 24h HH:mm format';

  if (values.startDate && values.endDate && values.startDate > values.endDate) {
    errors.endDate = 'End date must be after the start date';
  }
  return errors;
}

export interface AvailabilityExceptionValues {
  date: string;
  reason?: string;
  isAvailable: boolean;
}

/** Mirrors availabilityExceptionSchema. */
export function validateAvailabilityException(values: AvailabilityExceptionValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.date) errors.date = 'Pick a date';
  else if (Number.isNaN(Date.parse(values.date))) errors.date = 'Pick a valid date';
  if ((values.reason ?? '').trim().length > 300) errors.reason = 'Reason must be at most 300 characters';
  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Convert API validation issues into the same `{ field: message }` shape. */
export function issuesToErrors(issues: { path: string; message: string }[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    if (!errors[issue.path]) errors[issue.path] = issue.message;
  }
  return errors;
}

/** First error among the given field paths (for form-level alerts). */
export function firstError(errors: FieldErrors, paths: string[]): string | undefined {
  for (const path of paths) {
    if (errors[path]) return errors[path];
  }
  return undefined;
}
