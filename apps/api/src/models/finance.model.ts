import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  CURRENCIES,
  INVOICE_STATUSES,
  PAYMENT_STATUSES,
  REFUND_STATUSES,
  type InvoiceStatus,
  type PaymentStatus,
  type RefundStatus,
} from '@bmw/shared-types';

export interface PaymentFields {
  booking: Types.ObjectId;
  reference: string;
  provider: string;
  providerPaymentId: string | null;
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  method: string | null;
  failureReason: string | null;
  paidAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<PaymentFields>(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    reference: { type: String, required: true, unique: true },
    provider: { type: String, required: true },
    providerPaymentId: { type: String, default: null },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: CURRENCIES, default: 'INR' },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'PENDING' },
    method: { type: String, default: null },
    failureReason: { type: String, default: null },
    paidAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

paymentSchema.index({ booking: 1, status: 1 });
paymentSchema.index({ provider: 1, providerPaymentId: 1 }, { sparse: true });
paymentSchema.index({ createdAt: -1 });

export interface PaymentEventFields {
  eventId: string;
  payment: Types.ObjectId | null;
  type: string;
  payloadHash: string;
  processedAt: Date;
  status: 'PROCESSED' | 'DUPLICATE' | 'FAILED';
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const paymentEventSchema = new Schema<PaymentEventFields>(
  {
    eventId: { type: String, required: true, unique: true },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
    type: { type: String, required: true },
    payloadHash: { type: String, required: true },
    processedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['PROCESSED', 'DUPLICATE', 'FAILED'], required: true },
    error: { type: String, default: null },
  },
  { timestamps: true },
);

export interface RefundFields {
  payment: Types.ObjectId;
  booking: Types.ObjectId;
  amountMinor: number;
  currency: string;
  status: RefundStatus;
  reason: string | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const refundSchema = new Schema<RefundFields>(
  {
    payment: { type: Schema.Types.ObjectId, ref: 'Payment', required: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: CURRENCIES, default: 'INR' },
    status: { type: String, enum: REFUND_STATUSES, default: 'PENDING' },
    reason: { type: String, default: null },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

refundSchema.index({ booking: 1 });
refundSchema.index({ payment: 1, status: 1 });

export interface InvoiceLineItemFields {
  description: string;
  quantity: number;
  unitAmountMinor: number;
  amountMinor: number;
}

export interface InvoiceFields {
  invoiceNumber: string;
  booking: Types.ObjectId;
  status: InvoiceStatus;
  issuedTo: { name: string; email: string; address: string | null };
  issuedBy: { businessName: string; address: string | null; gstNumber: string | null };
  lineItems: InvoiceLineItemFields[];
  subtotalMinor: number;
  platformFeeMinor: number;
  taxAmountMinor: number;
  totalMinor: number;
  currency: string;
  paidAt: Date | null;
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<InvoiceFields>(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    status: { type: String, enum: INVOICE_STATUSES, default: 'ISSUED' },
    issuedTo: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      address: { type: String, default: null },
    },
    issuedBy: {
      businessName: { type: String, required: true },
      address: { type: String, default: null },
      gstNumber: { type: String, default: null },
    },
    lineItems: {
      type: [
        new Schema<InvoiceLineItemFields>(
          {
            description: { type: String, required: true },
            quantity: { type: Number, required: true, min: 0 },
            unitAmountMinor: { type: Number, required: true, min: 0 },
            amountMinor: { type: Number, required: true, min: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    subtotalMinor: { type: Number, required: true, min: 0 },
    platformFeeMinor: { type: Number, required: true, min: 0 },
    taxAmountMinor: { type: Number, required: true, min: 0 },
    totalMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: CURRENCIES, default: 'INR' },
    paidAt: { type: Date, default: null },
    dueAt: { type: Date, default: null },
  },
  { timestamps: true },
);

invoiceSchema.index({ status: 1, createdAt: -1 });

export const Payment = model('Payment', paymentSchema);
export const PaymentEvent = model('PaymentEvent',
  paymentEventSchema,
);
export const Refund = model('Refund', refundSchema);
export const Invoice = model('Invoice', invoiceSchema);
