import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { VERIFICATION_STATUSES, type VerificationStatus } from '@bmw/shared-types';

export interface LocationFields {
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  region: string | null;
  coordinates: { lat: number | null; lng: number | null };
  serviceRadiusKm: number | null;
}

export const locationSchema = new Schema<LocationFields>(
  {
    addressLine1: { type: String, required: true, trim: true, maxlength: 200 },
    addressLine2: { type: String, trim: true, maxlength: 200, default: null },
    landmark: { type: String, trim: true, maxlength: 200, default: null },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    state: { type: String, required: true, trim: true, maxlength: 80 },
    postalCode: { type: String, required: true, trim: true, maxlength: 12 },
    country: { type: String, required: true, trim: true, maxlength: 80, default: 'India' },
    region: { type: String, trim: true, maxlength: 120, default: null },
    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    serviceRadiusKm: { type: Number, default: null },
  },
  { _id: false },
);

export interface CustomerProfileFields {
  user: Types.ObjectId;
  companyName: string | null;
  gstNumber: string | null;
  businessType: string | null;
  address: LocationFields | null;
  preferredLanguage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const customerProfileSchema = new Schema<CustomerProfileFields>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    companyName: { type: String, trim: true, maxlength: 120, default: null },
    gstNumber: { type: String, trim: true, maxlength: 15, default: null },
    businessType: { type: String, trim: true, maxlength: 80, default: null },
    address: { type: locationSchema, default: null },
    preferredLanguage: { type: String, trim: true, maxlength: 20, default: 'en' },
  },
  { timestamps: true },
);

export type CustomerProfileDocument = HydratedDocument<CustomerProfileFields>;
export const CustomerProfile = model(
  'CustomerProfile',
  customerProfileSchema,
);

export interface VerificationDocumentFields {
  _id?: Types.ObjectId;
  label: string;
  url: string;
  status: 'UPLOADED' | 'VERIFIED' | 'REJECTED';
  uploadedAt: Date;
  rejectionReason: string | null;
}

const verificationDocumentSchema = new Schema<VerificationDocumentFields>(
  {
    label: { type: String, required: true, maxlength: 120 },
    url: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: ['UPLOADED', 'VERIFIED', 'REJECTED'], default: 'UPLOADED' },
    uploadedAt: { type: Date, default: Date.now },
    rejectionReason: { type: String, default: null },
  },
  { _id: true },
);

export interface PayoutDetailsFields {
  accountHolderName: string | null;
  accountNumberMasked: string | null;
  ifsc: string | null;
  bankName: string | null;
  upiId: string | null;
  updatedAt: Date | null;
}

export interface PartnerProfileFields {
  user: Types.ObjectId;
  businessName: string;
  businessType: string;
  description: string | null;
  address: LocationFields | null;
  website: string | null;
  logoUrl: string | null;
  supportedTypes: ('WAREHOUSE' | 'EQUIPMENT' | 'SERVICE')[];
  verificationStatus: VerificationStatus;
  payoutDetails: PayoutDetailsFields;
  responseRate: number | null;
  averageResponseMinutes: number | null;
  totalBookings: number;
  activeListings: number;
  onboardingCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const partnerProfileSchema = new Schema<PartnerProfileFields>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    businessName: { type: String, required: true, trim: true, maxlength: 120 },
    businessType: { type: String, trim: true, maxlength: 60, default: 'SOLE_PROPRIETORSHIP' },
    description: { type: String, trim: true, maxlength: 2000, default: null },
    address: { type: locationSchema, default: null },
    website: { type: String, trim: true, maxlength: 200, default: null },
    logoUrl: { type: String, default: null },
    supportedTypes: {
      type: [{ type: String, enum: ['WAREHOUSE', 'EQUIPMENT', 'SERVICE'] }],
      default: [],
    },
    verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'DRAFT' },
    payoutDetails: {
      accountHolderName: { type: String, default: null },
      accountNumberMasked: { type: String, default: null },
      ifsc: { type: String, default: null },
      bankName: { type: String, default: null },
      upiId: { type: String, default: null },
      updatedAt: { type: Date, default: null },
    },
    responseRate: { type: Number, default: null },
    averageResponseMinutes: { type: Number, default: null },
    totalBookings: { type: Number, default: 0 },
    activeListings: { type: Number, default: 0 },
    onboardingCompletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

partnerProfileSchema.index({ verificationStatus: 1, createdAt: -1 });

export type PartnerProfileDocument = HydratedDocument<PartnerProfileFields>;
export const PartnerProfile = model(
  'PartnerProfile',
  partnerProfileSchema,
);

export interface BusinessVerificationFields {
  partner: Types.ObjectId;
  status: VerificationStatus;
  legalBusinessName: string | null;
  businessType: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  registrationNumber: string | null;
  address: LocationFields | null;
  documents: VerificationDocumentFields[];
  submittedAt: Date | null;
  reviewedAt: Date | null;
  reviewedBy: Types.ObjectId | null;
  rejectionReason: string | null;
  reviewerNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const businessVerificationSchema = new Schema<BusinessVerificationFields>(
  {
    partner: { type: Schema.Types.ObjectId, ref: 'PartnerProfile', required: true, unique: true },
    status: { type: String, enum: VERIFICATION_STATUSES, default: 'DRAFT' },
    legalBusinessName: { type: String, trim: true, maxlength: 160, default: null },
    businessType: { type: String, trim: true, maxlength: 60, default: null },
    gstNumber: { type: String, trim: true, maxlength: 15, default: null, select: false },
    panNumber: { type: String, trim: true, maxlength: 10, default: null, select: false },
    registrationNumber: { type: String, trim: true, maxlength: 60, default: null },
    address: { type: locationSchema, default: null },
    documents: { type: [verificationDocumentSchema], default: [] },
    submittedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    rejectionReason: { type: String, default: null },
    reviewerNotes: { type: String, default: null },
  },
  { timestamps: true },
);

businessVerificationSchema.index({ status: 1, submittedAt: 1 });

export type BusinessVerificationDocument = HydratedDocument<BusinessVerificationFields>;
export const BusinessVerification = model(
  'BusinessVerification',
  businessVerificationSchema,
);
