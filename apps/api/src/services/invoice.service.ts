import { Types } from 'mongoose';
import type { InvoiceDTO, InvoiceLineItemDTO, Role } from '@bmw/shared-types';
import { formatMoney } from '@bmw/shared-types';
import { errors } from '../lib/errors.js';
import { invoiceNumber } from '../lib/ids.js';
import { Booking, Invoice, PartnerProfile, User, type BookingFields, type InvoiceFields } from '../models/index.js';

export function serializeInvoice(
  invoice: InvoiceFields & { _id: unknown },
  bookingReference: string,
): InvoiceDTO {
  return {
    id: String(invoice._id),
    invoiceNumber: invoice.invoiceNumber,
    bookingId: String(invoice.booking),
    bookingReference,
    status: invoice.status,
    issuedTo: {
      name: invoice.issuedTo.name,
      email: invoice.issuedTo.email,
      address: invoice.issuedTo.address ?? null,
    },
    issuedBy: {
      businessName: invoice.issuedBy.businessName,
      address: invoice.issuedBy.address ?? null,
      gstNumber: invoice.issuedBy.gstNumber ?? null,
    },
    lineItems: invoice.lineItems.map(
      (item): InvoiceLineItemDTO => ({
        description: item.description,
        quantity: item.quantity,
        unitAmount: item.unitAmountMinor,
        amount: item.amountMinor,
      }),
    ),
    subtotal: invoice.subtotalMinor,
    platformFee: invoice.platformFeeMinor,
    taxAmount: invoice.taxAmountMinor,
    total: invoice.totalMinor,
    currency: invoice.currency as InvoiceDTO['currency'],
    paidAt: invoice.paidAt ? new Date(invoice.paidAt).toISOString() : null,
    dueAt: invoice.dueAt ? new Date(invoice.dueAt).toISOString() : null,
    createdAt: new Date(invoice.createdAt).toISOString(),
  };
}

export async function issueInvoiceForBooking(
  bookingId: string,
): Promise<(InvoiceFields & { _id: Types.ObjectId }) | null> {
  const booking = await Booking.findById(bookingId);
  if (!booking) return null;

  const existing = await Invoice.findOne({ booking: booking._id }).lean();
  if (existing) return existing as unknown as InvoiceFields & { _id: Types.ObjectId };

  const [customer, partnerProfile] = await Promise.all([
    User.findById(booking.customer).select('name email').lean(),
    PartnerProfile.findOne({ user: booking.partner }).select('businessName address').lean(),
  ]);
  if (!customer) return null;

  const lineItems = booking.pricing.breakdown.map((line) => ({
    description: line.label,
    quantity: 1,
    unitAmountMinor: line.amountMinor,
    amountMinor: line.amountMinor,
  }));

  const invoice = await Invoice.create({
    invoiceNumber: invoiceNumber(),
    booking: booking._id,
    status: 'PAID',
    issuedTo: {
      name: customer.name,
      email: customer.email,
      address: partnerProfile?.address
        ? `${partnerProfile.address.addressLine1}, ${partnerProfile.address.city}`
        : null,
    },
    issuedBy: {
      businessName: partnerProfile?.businessName ?? 'BookMyWarehouse partner',
      address: partnerProfile?.address
        ? `${partnerProfile.address.addressLine1}, ${partnerProfile.address.city}, ${partnerProfile.address.state} ${partnerProfile.address.postalCode}`
        : null,
      gstNumber: null,
    },
    lineItems,
    subtotalMinor: booking.pricing.subtotalMinor,
    platformFeeMinor: booking.pricing.platformFeeMinor,
    taxAmountMinor: booking.pricing.taxesMinor,
    totalMinor: booking.pricing.totalMinor,
    currency: booking.pricing.currency,
    paidAt: new Date(),
    dueAt: null,
  });

  return invoice as unknown as InvoiceFields & { _id: Types.ObjectId };
}

export async function getInvoiceForViewer(
  invoiceId: string,
  actor: { userId: string; role: Role },
): Promise<{ invoice: InvoiceFields & { _id: unknown }; dto: InvoiceDTO }> {
  if (!Types.ObjectId.isValid(invoiceId)) throw errors.notFound('Invoice not found');
  const invoice = (await Invoice.findById(invoiceId).lean()) as unknown as
    | (InvoiceFields & { _id: unknown })
    | null;
  if (!invoice) throw errors.notFound('Invoice not found');
  const booking = (await Booking.findById(invoice.booking).lean()) as unknown as
    | (BookingFields & { _id: unknown })
    | null;
  if (!booking) throw errors.notFound('Invoice not found');

  const isCustomer = String(booking.customer) === actor.userId;
  const isPartner = String(booking.partner) === actor.userId;
  if (!isCustomer && !isPartner && actor.role !== 'ADMIN') {
    throw errors.forbidden('You do not have access to this invoice');
  }
  return { invoice, dto: serializeInvoice(invoice, booking.reference) };
}

export async function listInvoices(
  scope: { role: 'customer' | 'partner' | 'admin'; userId: string },
  page: number,
  limit: number,
): Promise<{ items: InvoiceDTO[]; total: number }> {
  const filter: Record<string, unknown> = {};
  if (scope.role !== 'admin') {
    const bookingFilter =
      scope.role === 'customer' ? { customer: scope.userId } : { partner: scope.userId };
    const bookings = await Booking.find(bookingFilter).select('_id').lean();
    filter.booking = { $in: bookings.map((b) => b._id) };
  }

  const [docs, total] = await Promise.all([
    Invoice.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Invoice.countDocuments(filter),
  ]);

  const bookingIds = docs.map((d) => d.booking);
  const bookings = await Booking.find({ _id: { $in: bookingIds } })
    .select('reference')
    .lean();
  const referenceMap = new Map(bookings.map((b) => [String(b._id), b.reference]));

  return {
    items: docs.map((doc) =>
      serializeInvoice(doc as unknown as InvoiceFields & { _id: unknown }, referenceMap.get(String(doc.booking)) ?? ''),
    ),
    total,
  };
}

/** Printable invoice document (browser print-to-PDF). */
export function renderInvoiceHtml(
  invoice: InvoiceFields & { _id: unknown },
  bookingReference: string,
): string {
  const rows = invoice.lineItems
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.description)}</td>
        <td class="num">${item.quantity}</td>
        <td class="num">${formatMoney(item.unitAmountMinor, invoice.currency as never)}</td>
        <td class="num">${formatMoney(item.amountMinor, invoice.currency as never)}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
  <title>${escapeHtml(invoice.invoiceNumber)} — BookMyWarehouse</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:40px;background:#fff}
    h1{font-size:22px;margin:0} .muted{color:#64748b}
    .grid{display:flex;justify-content:space-between;gap:32px;margin:24px 0}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th,td{border-bottom:1px solid #e2e8f0;padding:10px 8px;text-align:left;font-size:14px}
    .num{text-align:right}
    .totals{margin-top:16px;margin-left:auto;width:320px}
    .totals div{display:flex;justify-content:space-between;padding:6px 0;font-size:14px}
    .totals .grand{font-weight:700;border-top:2px solid #0f172a;font-size:16px}
    .note{margin-top:32px;font-size:12px;color:#64748b}
    @media print{margin:0}
  </style></head><body>
  <div class="grid">
    <div>
      <h1>Tax invoice</h1>
      <p class="muted">${escapeHtml(invoice.invoiceNumber)} · Booking ${escapeHtml(bookingReference)}</p>
      <p class="muted">Issued on ${new Date(invoice.createdAt).toDateString()}</p>
    </div>
    <div>
      <strong>From</strong>
      <p>${escapeHtml(invoice.issuedBy.businessName)}<br/>${escapeHtml(invoice.issuedBy.address ?? '')}</p>
      <strong>Billed to</strong>
      <p>${escapeHtml(invoice.issuedTo.name)}<br/>${escapeHtml(invoice.issuedTo.email)}<br/>${escapeHtml(invoice.issuedTo.address ?? '')}</p>
    </div>
  </div>
  <table><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Amount</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="totals">
    <div><span>Subtotal</span><span>${formatMoney(invoice.subtotalMinor, invoice.currency as never)}</span></div>
    <div><span>Taxes</span><span>${formatMoney(invoice.taxAmountMinor, invoice.currency as never)}</span></div>
    <div class="grand"><span>Total</span><span>${formatMoney(invoice.totalMinor, invoice.currency as never)}</span></div>
    <div><span>Status</span><span>${escapeHtml(invoice.status)}</span></div>
  </div>
  <p class="note">Generated by BookMyWarehouse. This document is produced by the platform and may not satisfy
  every statutory invoicing requirement for your jurisdiction — confirm tax treatment with your accountant.</p>
  </body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
