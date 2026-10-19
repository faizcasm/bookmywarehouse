import { Types } from 'mongoose';
import {
  AvailabilityException,
  AvailabilityRule,
  BLOCKING_BOOKING_STATUSES,
  Booking,
  type AvailabilityExceptionFields,
  type AvailabilityRuleFields,
  type ListingFields,
} from '../models/index.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getListingAvailability(listingId: string): Promise<{
  rules: AvailabilityRuleFields[];
  blockedDates: AvailabilityExceptionFields[];
}> {
  const [rules, blockedDates] = await Promise.all([
    AvailabilityRule.find({ listing: listingId }).lean(),
    AvailabilityException.find({ listing: listingId }).sort({ date: 1 }).lean(),
  ]);
  return { rules, blockedDates };
}

function overlapsRule(rule: AvailabilityRuleFields, date: Date): boolean {
  if (rule.startDate && date < rule.startDate) return false;
  if (rule.endDate && date > new Date(rule.endDate.getTime() + DAY_MS - 1)) return false;
  return rule.daysOfWeek.includes(date.getUTCDay());
}

/** Returns the blocking exception for the date, if the listing is closed that day. */
export function blockingExceptionFor(
  exceptions: AvailabilityExceptionFields[],
  date: Date,
): AvailabilityExceptionFields | null {
  const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return (
    exceptions.find((exception) => {
      const exDay = new Date(exception.date).getTime();
      return exDay === dayStart && !exception.isAvailable;
    }) ?? null
  );
}

export interface DateRangeCheck {
  available: boolean;
  reason?: string;
  blockedDate?: string;
}

/**
 * Checks the requested interval against the partner's availability rules and
 * blocked dates. With no rules configured the listing is treated as always open.
 */
export function checkDateRange(
  rules: AvailabilityRuleFields[],
  exceptions: AvailabilityExceptionFields[],
  startDate: Date,
  endDate: Date | null,
): DateRangeCheck {
  const cursor = new Date(startDate);
  const last = endDate ?? startDate;
  let guard = 0;
  while (cursor.getTime() <= last.getTime() && guard < 400) {
    const blocked = blockingExceptionFor(exceptions, cursor);
    if (blocked) {
      return {
        available: false,
        reason: blocked.reason ?? 'This date is blocked by the partner',
        blockedDate: cursor.toISOString(),
      };
    }
    if (rules.length > 0 && !rules.some((rule) => overlapsRule(rule, cursor))) {
      return {
        available: false,
        reason: 'The listing is not available on this date',
        blockedDate: cursor.toISOString(),
      };
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  return { available: true };
}

export interface CapacityCheckInput {
  listing: Pick<ListingFields, 'type'> & { _id: unknown };
  startDate: Date;
  endDate?: Date | null;
  requestedCapacity?: number | null;
  quantity?: number;
  /** Equipment quantity or warehouse capacity. */
  totalCapacity: number;
  /** Service per-day capacity (max concurrent bookings per day). */
  dailyCapacity?: number | null;
  excludeBookingId?: string;
}

export interface CapacityCheckResult {
  available: boolean;
  reserved: number;
  requested: number;
  totalCapacity: number;
  remaining: number;
  reason?: string;
}

function blockingStatuses(): string[] {
  return [...BLOCKING_BOOKING_STATUSES];
}

/**
 * Capacity validation is always computed against current reservations in the
 * database — never from client-provided state. Overlapping reservations that
 * would exceed capacity are rejected.
 */
export async function checkCapacity(input: CapacityCheckInput): Promise<CapacityCheckResult> {
  const listingId = new Types.ObjectId(String(input.listing._id));
  const start = input.startDate;
  const end = input.endDate ?? input.startDate;
  // Half-open overlap: [start, end + 1 day)
  const rangeEnd = new Date(end.getTime() + DAY_MS);

  const query: Record<string, unknown> = {
    listing: listingId,
    status: { $in: blockingStatuses() },
  };
  if (input.excludeBookingId) {
    query._id = { $ne: new Types.ObjectId(input.excludeBookingId) };
  }

  if (input.listing.type === 'SERVICE') {
    // Services are limited by number of concurrent bookings per day.
    const dayStart = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    const count = await Booking.countDocuments({
      listing: listingId,
      status: { $in: blockingStatuses() },
      startDate: new Date(dayStart),
      ...(input.excludeBookingId ? { _id: { $ne: new Types.ObjectId(input.excludeBookingId) } } : {}),
    });
    const daily = input.dailyCapacity ?? 1;
    return {
      available: count < daily,
      reserved: count,
      requested: 1,
      totalCapacity: daily,
      remaining: Math.max(0, daily - count),
      reason: count >= daily ? 'The provider is fully booked for this date' : undefined,
    };
  }

  const aggregation = await Booking.aggregate<{ reserved: number }>([
    {
      $match: {
        ...query,
        startDate: { $lt: rangeEnd },
        $or: [{ endDate: null }, { endDate: { $gte: start } }],
      },
    },
    {
      $group: {
        _id: null,
        reserved: {
          $sum: input.listing.type === 'WAREHOUSE' ? { $ifNull: ['$requestedCapacity', 0] } : '$quantity',
        },
      },
    },
  ]);

  const reserved = aggregation[0]?.reserved ?? 0;
  const requested =
    input.listing.type === 'WAREHOUSE'
      ? Math.max(0, Math.ceil(input.requestedCapacity ?? 0))
      : Math.max(1, input.quantity ?? 1);
  const remaining = input.totalCapacity - reserved;

  if (requested > remaining) {
    return {
      available: false,
      reserved,
      requested,
      totalCapacity: input.totalCapacity,
      remaining,
      reason:
        input.listing.type === 'WAREHOUSE'
          ? `Only ${remaining} of ${input.totalCapacity} capacity is free for these dates`
          : `Only ${remaining} unit(s) are free for these dates`,
    };
  }

  return { available: true, reserved, requested, totalCapacity: input.totalCapacity, remaining };
}
