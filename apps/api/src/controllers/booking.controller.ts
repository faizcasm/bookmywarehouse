import type { Request, Response } from 'express';
import type { z } from 'zod';
import type {
  bookingListQuerySchema,
  cancelBookingSchema,
  completeBookingSchema,
  createBookingSchema,
  partnerBookingActionSchema,
  quoteBookingSchema,
  rejectBookingSchema,
} from '@bmw/validation';
import { buildPageMeta, clientIp, sendSuccess } from '../lib/http.js';
import { errors } from '../lib/errors.js';
import {
  acceptBooking,
  createBookingRequest,
  getBookingForViewer,
  listBookings,
  quoteBooking,
  renderBooking,
  rejectBooking,
  transitionBooking,
  type TransitionActor,
} from '../services/booking.service.js';
import { cancelBookingWithPolicy } from '../services/payment.service.js';
import { openDispute } from '../services/dispute.service.js';
import { openDisputeSchema } from '@bmw/validation';
import { recordAudit } from '../services/audit.service.js';

function actor(req: Request): TransitionActor {
  if (!req.auth) throw errors.unauthenticated();
  return { userId: req.auth.userId, role: req.auth.role };
}

export async function quoteHandler(req: Request, res: Response): Promise<void> {
  const input = req.body as z.infer<typeof quoteBookingSchema>;
  const result = await quoteBooking(input);
  sendSuccess(res, {
    listingId: input.listingId,
    currency: result.quote?.currency ?? 'INR',
    pricing: result.quote
      ? {
          currency: result.quote.currency,
          subtotal: result.quote.subtotalMinor,
          platformFee: result.quote.platformFeeMinor,
          taxes: result.quote.taxesMinor,
          discount: result.quote.discountMinor,
          total: result.quote.totalMinor,
          breakdown: result.quote.breakdown.map((line) => ({
            label: line.label,
            amount: line.amountMinor,
          })),
          rateDescription: result.quote.rateDescription,
        }
      : null,
    available: result.availability.available,
    unavailableReason: result.availability.reason ?? null,
    remainingCapacity: result.availability.remaining ?? null,
    startDate: input.startDate.toISOString(),
    endDate: input.endDate ? input.endDate.toISOString() : null,
  });
}

export async function createBookingHandler(req: Request, res: Response): Promise<void> {
  const input = req.body as z.infer<typeof createBookingSchema>;
  const a = actor(req);
  const booking = await createBookingRequest(a.userId, input);
  await recordAudit({
    actorId: a.userId,
    action: 'booking.requested',
    entityType: 'Booking',
    entityId: String(booking._id),
    summary: `Booking requested for listing ${input.listingId}`,
    ip: clientIp(req),
  });
  sendSuccess(res, await renderBooking(booking), { status: 201 });
}

export async function listBookingsHandler(req: Request, res: Response): Promise<void> {
  const a = actor(req);
  const query = req.query as unknown as z.infer<typeof bookingListQuerySchema>;
  const scope =
    req.query.scope === 'admin' && a.role === 'ADMIN'
      ? ({ role: 'admin', userId: a.userId } as const)
      : a.role === 'PARTNER'
        ? ({ role: 'partner', userId: a.userId } as const)
        : ({ role: 'customer', userId: a.userId } as const);
  const result = await listBookings(scope, query);
  const items = await Promise.all(result.items.map((booking) => renderBooking(booking)));
  sendSuccess(res, { items }, {
    meta: { pagination: buildPageMeta(query.page, query.limit, result.total) },
  });
}

export async function bookingDetailHandler(req: Request, res: Response): Promise<void> {
  const a = actor(req);
  const booking = await getBookingForViewer(req.params.id as string, a);
  sendSuccess(res, await renderBooking(booking));
}

export async function cancelBookingHandler(req: Request, res: Response): Promise<void> {
  const a = actor(req);
  const input = req.body as z.infer<typeof cancelBookingSchema>;
  const result = await cancelBookingWithPolicy(req.params.id as string, a, input.reason);
  await recordAudit({
    actorId: a.userId,
    action: 'booking.cancelled',
    entityType: 'Booking',
    entityId: req.params.id as string,
    summary: input.reason,
    ip: clientIp(req),
  });
  const booking = await getBookingForViewer(req.params.id as string, a);
  sendSuccess(res, { booking: await renderBooking(booking), refundAmountMinor: result.refundAmountMinor });
}

export async function acceptBookingHandler(req: Request, res: Response): Promise<void> {
  const a = actor(req);
  const booking = await acceptBooking(req.params.id as string, a);
  await recordAudit({
    actorId: a.userId,
    action: 'booking.accepted',
    entityType: 'Booking',
    entityId: req.params.id as string,
    ip: clientIp(req),
  });
  sendSuccess(res, await renderBooking(booking));
}

export async function rejectBookingHandler(req: Request, res: Response): Promise<void> {
  const a = actor(req);
  const input = req.body as z.infer<typeof rejectBookingSchema>;
  const booking = await rejectBooking(req.params.id as string, a, input.reason);
  await recordAudit({
    actorId: a.userId,
    action: 'booking.rejected',
    entityType: 'Booking',
    entityId: req.params.id as string,
    summary: input.reason,
    ip: clientIp(req),
  });
  sendSuccess(res, await renderBooking(booking));
}

export async function completeBookingHandler(req: Request, res: Response): Promise<void> {
  const a = actor(req);
  req.body = req.body ?? {};
  const input = req.body as z.infer<typeof completeBookingSchema>;
  const booking = await transitionBooking(req.params.id as string, 'COMPLETED', a, {
    note: input.note ?? null,
  });
  sendSuccess(res, await renderBooking(booking));
}

export async function startBookingHandler(req: Request, res: Response): Promise<void> {
  const a = actor(req);
  const booking = await transitionBooking(req.params.id as string, 'IN_PROGRESS', a, {
    note: 'Booking started',
  });
  sendSuccess(res, await renderBooking(booking));
}

export async function openDisputeHandler(req: Request, res: Response): Promise<void> {
  const a = actor(req);
  const input = req.body as z.infer<typeof openDisputeSchema>;
  const dispute = await openDispute(a.userId, a.role, input);
  sendSuccess(res, { id: String(dispute._id), reference: dispute.reference }, { status: 201 });
}
