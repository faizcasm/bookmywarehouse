import { z } from 'zod';
import { objectIdSchema } from './common.js';

const startDateSchema = z.coerce
  .date()
  .refine((d) => d.getTime() >= new Date().setHours(0, 0, 0, 0) - 24 * 60 * 60 * 1000, {
    message: 'Start date cannot be in the past',
  });

export const createBookingSchema = z
  .object({
    listingId: objectIdSchema,
    startDate: startDateSchema,
    endDate: z.coerce.date().nullish(),
    capacity: z.number().positive().max(10_000_000).nullish(),
    quantity: z.number().int().positive().max(100_000).default(1),
    deliveryRequired: z.boolean().default(false),
    operatorRequired: z.boolean().default(false),
    notes: z.string().trim().max(1000).nullish(),
    specialRequirements: z.string().trim().max(2000).nullish(),
  })
  .superRefine((value, ctx) => {
    if (value.endDate && value.endDate.getTime() <= value.startDate.getTime()) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'End date must be after the start date',
      });
    }
    if (!value.endDate && !value.capacity && value.quantity < 1) {
      ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Quantity is required' });
    }
  });

export const quoteBookingSchema = z.object({
  listingId: objectIdSchema,
  startDate: startDateSchema,
  endDate: z.coerce.date().nullish(),
  capacity: z.number().positive().max(10_000_000).nullish(),
  quantity: z.number().int().positive().max(100_000).default(1),
  deliveryRequired: z.boolean().default(false),
  operatorRequired: z.boolean().default(false),
});

export const cancelBookingSchema = z.object({
  reason: z.string().trim().min(3, 'Provide a cancellation reason').max(600),
});

export const rejectBookingSchema = z.object({
  reason: z.string().trim().min(3, 'Provide a rejection reason').max(600),
});

export const partnerBookingActionSchema = z.object({
  note: z.string().trim().max(600).nullish(),
});

export const completeBookingSchema = z.object({
  note: z.string().trim().max(600).nullish(),
});

export const bookingListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  status: z.string().trim().max(300).optional(),
  type: z.enum(['WAREHOUSE', 'EQUIPMENT', 'SERVICE']).optional(),
  q: z.string().trim().max(120).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type QuoteBookingInput = z.infer<typeof quoteBookingSchema>;
export type BookingListQuery = z.infer<typeof bookingListQuerySchema>;
