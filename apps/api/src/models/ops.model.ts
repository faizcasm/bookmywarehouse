import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { CURRENCIES, DISPUTE_REASONS, DISPUTE_STATUSES, type DisputeStatus } from '@bmw/shared-types';

export interface DisputeFields {
  reference: string;
  booking: Types.ObjectId;
  openedBy: Types.ObjectId;
  againstRole: 'CUSTOMER' | 'PARTNER';
  reason: string;
  description: string;
  status: DisputeStatus;
  resolutionNote: string | null;
  resolvedBy: Types.ObjectId | null;
  resolvedAt: Date | null;
  refundAmountMinor: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const disputeSchema = new Schema<DisputeFields>(
  {
    reference: { type: String, required: true, unique: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    openedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    againstRole: { type: String, enum: ['CUSTOMER', 'PARTNER'], required: true },
    reason: { type: String, enum: DISPUTE_REASONS, required: true },
    description: { type: String, required: true, maxlength: 3000 },
    status: { type: String, enum: DISPUTE_STATUSES, default: 'OPEN' },
    resolutionNote: { type: String, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    refundAmountMinor: { type: Number, default: null, min: 0 },
  },
  { timestamps: true },
);

disputeSchema.index({ status: 1, createdAt: -1 });
disputeSchema.index({ booking: 1 });

export interface PlatformSettingsFields {
  key: 'platform';
  currency: string;
  platformFeePercent: number;
  customerFeePercent: number;
  taxPercent: number;
  minPayoutAmountMinor: number;
  supportEmail: string;
  allowSelfServiceListings: boolean;
  requirePartnerVerification: boolean;
  maintenanceMode: boolean;
  announcement: string | null;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const platformSettingsSchema = new Schema<PlatformSettingsFields>(
  {
    key: { type: String, enum: ['platform'], required: true, unique: true, default: 'platform' },
    currency: { type: String, enum: CURRENCIES, default: 'INR' },
    platformFeePercent: { type: Number, default: 10, min: 0, max: 50 },
    customerFeePercent: { type: Number, default: 0, min: 0, max: 50 },
    taxPercent: { type: Number, default: 18, min: 0, max: 50 },
    minPayoutAmountMinor: { type: Number, default: 100000, min: 0 },
    supportEmail: { type: String, default: 'support@bookmywarehouse.dev' },
    allowSelfServiceListings: { type: Boolean, default: true },
    requirePartnerVerification: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    announcement: { type: String, default: null, maxlength: 600 },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

export interface AuditLogFields {
  actor: Types.ObjectId | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<AuditLogFields>(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true, maxlength: 120 },
    entityType: { type: String, required: true, maxlength: 60 },
    entityId: { type: String, required: true, maxlength: 64 },
    summary: { type: String, default: null, maxlength: 500 },
    metadata: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: null },
  },
  { timestamps: true },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

export const Dispute = model('Dispute', disputeSchema);
export const PlatformSettings = model('PlatformSettings',
  platformSettingsSchema,
);
export const AuditLog = model('AuditLog',
  auditLogSchema,
);
