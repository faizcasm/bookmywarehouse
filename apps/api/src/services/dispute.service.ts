import { Types } from 'mongoose';
import type { Role } from '@bmw/shared-types';
import type { z } from 'zod';
import type { openDisputeSchema } from '@bmw/validation';
import { errors } from '../lib/errors.js';
import { disputeReference } from '../lib/ids.js';
import { Booking, Dispute, User, type DisputeFields } from '../models/index.js';
import { notify } from './notification.service.js';
import { transitionBooking } from './booking.service.js';

type OpenDisputeInput = z.infer<typeof openDisputeSchema>;

export async function openDispute(
  actorId: string,
  actorRole: Role,
  input: OpenDisputeInput,
): Promise<DisputeFields & { _id: unknown }> {
  const booking = await Booking.findById(input.bookingId);
  if (!booking) throw errors.notFound('Booking not found');
  const isCustomer = String(booking.customer) === actorId;
  const isPartner = String(booking.partner) === actorId;
  if (!isCustomer && !isPartner && actorRole !== 'ADMIN') {
    throw errors.forbidden('You are not part of this booking');
  }
  if (!['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(booking.status)) {
    throw errors.precondition('This booking cannot be disputed in its current state');
  }
  const existing = await Dispute.findOne({
    booking: booking._id,
    status: { $in: ['OPEN', 'UNDER_REVIEW'] },
  }).lean();
  if (existing) throw errors.conflict('A dispute is already open for this booking');

  const againstRole = isPartner ? 'CUSTOMER' : 'PARTNER';
  const dispute = await Dispute.create({
    reference: disputeReference(),
    booking: booking._id,
    openedBy: new Types.ObjectId(actorId),
    againstRole,
    reason: input.reason,
    description: input.description,
    status: 'OPEN',
  });

  if (booking.status !== 'CANCELLED') {
    await transitionBooking(String(booking._id), 'DISPUTED', { userId: actorId, role: actorRole }, {
      note: `Dispute opened: ${input.reason}`,
    });
  }

  const counterparty = isCustomer ? String(booking.partner) : String(booking.customer);
  await notify({
    userId: counterparty,
    type: 'DISPUTE_OPENED',
    title: 'A dispute was opened',
    body: `A dispute was raised for booking ${booking.reference}. Our team will review it shortly.`,
    link: '/dashboard/bookings',
  });

  const admins = await User.find({ role: 'ADMIN', status: 'ACTIVE' }).select('_id').lean();
  await Promise.all(
    admins.map((admin) =>
      notify({
        userId: String(admin._id),
        type: 'DISPUTE_OPENED',
        title: `Dispute ${dispute.reference} opened`,
        body: `Reason: ${input.reason}`,
        link: '/admin/disputes',
      }),
    ),
  );

  return dispute as unknown as DisputeFields & { _id: unknown };
}

export async function listMyDisputes(
  actorId: string,
  role: Role,
): Promise<{ items: Record<string, unknown>[]; total: number }> {
  const bookingFilter =
    role === 'PARTNER' ? { partner: new Types.ObjectId(actorId) } : { customer: new Types.ObjectId(actorId) };
  const bookings = await Booking.find(bookingFilter).select('_id reference').lean();
  const bookingIds = bookings.map((b) => b._id);
  const refMap = new Map(bookings.map((b) => [String(b._id), b.reference]));
  const disputes = await Dispute.find({
    booking: { $in: bookingIds },
  })
    .sort({ createdAt: -1 })
    .lean();

  return {
    items: disputes.map((dispute) => ({
      id: String(dispute._id),
      reference: dispute.reference,
      bookingId: String(dispute.booking),
      bookingReference: refMap.get(String(dispute.booking)) ?? '',
      againstParty: dispute.againstRole,
      reason: dispute.reason,
      description: dispute.description,
      status: dispute.status,
      resolutionNote: dispute.resolutionNote ?? null,
      createdAt: new Date(dispute.createdAt).toISOString(),
      updatedAt: new Date(dispute.updatedAt).toISOString(),
    })),
    total: disputes.length,
  };
}
