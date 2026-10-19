import { Types } from 'mongoose';
import type { ReviewDTO } from '@bmw/shared-types';
import type { createReviewSchema, respondReviewSchema, reviewListQuerySchema } from '@bmw/validation';
import { z } from 'zod';
import { errors } from '../lib/errors.js';
import { Booking, Listing, Review, User, type ReviewFields } from '../models/index.js';
import { notify } from './notification.service.js';

type CreateReviewInput = z.infer<typeof createReviewSchema>;
type ReviewQuery = z.infer<typeof reviewListQuerySchema>;

export async function recalculateListingRating(listingId: Types.ObjectId): Promise<void> {
  const result = await Review.aggregate<{ _id: null; average: number; count: number }>([
    { $match: { listing: listingId, status: 'PUBLISHED' } },
    {
      $group: {
        _id: null,
        average: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);
  const stats = result[0];
  await Listing.updateOne(
    { _id: listingId },
    {
      $set: {
        rating: {
          average: stats ? Math.round(stats.average * 10) / 10 : 0,
          count: stats?.count ?? 0,
        },
      },
    },
  ).exec();
}

export async function createReview(
  customerId: string,
  input: CreateReviewInput,
): Promise<ReviewFields & { _id: unknown }> {
  const booking = await Booking.findById(input.bookingId);
  if (!booking) throw errors.notFound('Booking not found');
  if (String(booking.customer) !== customerId) throw errors.forbidden('Not your booking');
  if (booking.status !== 'COMPLETED') {
    throw errors.precondition('You can only review bookings that are completed');
  }
  const existing = await Review.findOne({ booking: booking._id }).select('_id').lean();
  if (existing) {
    throw errors.conflict('You have already reviewed this booking');
  }

  const review = await Review.create({
    booking: booking._id,
    listing: booking.listing,
    author: new Types.ObjectId(customerId),
    partner: booking.partner,
    rating: input.rating,
    comment: input.comment ?? null,
    status: 'PUBLISHED',
  });

  booking.review = review._id;
  await booking.save();
  await recalculateListingRating(booking.listing as Types.ObjectId);

  await notify({
    userId: String(booking.partner),
    type: 'REVIEW_RECEIVED',
    title: 'New review received',
    body: `A customer left a ${input.rating}-star review for ${booking.listingSnapshot.title}.`,
    link: '/partner/reviews',
  });

  return review as unknown as ReviewFields & { _id: unknown };
}

export async function respondToReview(
  partnerUserId: string,
  reviewId: string,
  text: string,
): Promise<ReviewFields & { _id: unknown }> {
  if (!Types.ObjectId.isValid(reviewId)) throw errors.notFound('Review not found');
  const review = await Review.findById(reviewId);
  if (!review) throw errors.notFound('Review not found');
  if (String(review.partner) !== partnerUserId) {
    throw errors.forbidden('You can only respond to reviews on your listings');
  }
  if (review.status !== 'PUBLISHED') throw errors.precondition('This review is not visible');
  review.response = { text, at: new Date() };
  await review.save();
  await notify({
    userId: String(review.author),
    type: 'REVIEW_RESPONSE',
    title: 'Partner responded to your review',
    body: text.slice(0, 200),
    link: `/reviews/${String(review._id)}`,
  });
  return review as unknown as ReviewFields & { _id: unknown };
}

export function serializeReview(
  review: ReviewFields & { _id: unknown },
  context: { authorName?: string; authorAvatar?: string | null; listingTitle?: string },
): ReviewDTO {
  return {
    id: String(review._id),
    bookingId: String(review.booking),
    listingId: String(review.listing),
    listingTitle: context.listingTitle ?? '',
    author: {
      id: String(review.author),
      name: context.authorName ?? 'Customer',
      role: 'CUSTOMER',
      avatarUrl: context.authorAvatar ?? null,
    },
    rating: review.rating,
    comment: review.comment ?? null,
    status: review.status,
    response: review.response
      ? { text: review.response.text, at: new Date(review.response.at).toISOString() }
      : null,
    createdAt: new Date(review.createdAt).toISOString(),
  };
}

export async function hydrateReviews(
  reviews: (ReviewFields & { _id: unknown })[],
): Promise<ReviewDTO[]> {
  const authorIds = [...new Set(reviews.map((r) => String(r.author)))];
  const listingIds = [...new Set(reviews.map((r) => String(r.listing)))];
  const [authors, listings] = await Promise.all([
    authorIds.length
      ? User.find({ _id: { $in: authorIds } }).select('name avatarUrl').lean()
      : Promise.resolve([]),
    listingIds.length
      ? Listing.find({ _id: { $in: listingIds } }).select('title').lean()
      : Promise.resolve([]),
  ]);
  const authorMap = new Map(authors.map((a) => [String(a._id), a]));
  const listingMap = new Map(listings.map((l) => [String(l._id), l]));
  return reviews.map((review) =>
    serializeReview(review, {
      authorName: authorMap.get(String(review.author))?.name,
      authorAvatar: authorMap.get(String(review.author))?.avatarUrl ?? null,
      listingTitle: listingMap.get(String(review.listing))?.title ?? '',
    }),
  );
}

export async function listListingReviews(
  listingId: string,
  query: ReviewQuery,
): Promise<{ items: ReviewDTO[]; total: number; average: number }> {
  const filter: Record<string, unknown> = {
    listing: new Types.ObjectId(listingId),
    status: 'PUBLISHED',
  };
  if (query.minRating) filter.rating = { $gte: query.minRating };
  const sort =
    query.sort === 'rating_asc'
      ? { rating: 1, createdAt: -1 }
      : query.sort === 'rating_desc'
        ? { rating: -1, createdAt: -1 }
        : query.sort === 'oldest'
          ? { createdAt: 1 }
          : { createdAt: -1 };

  const [docs, total, agg] = await Promise.all([
    Review.find(filter)
      .sort(sort as never)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Review.countDocuments(filter),
    Review.aggregate<{ average: number }>([
      { $match: { listing: new Types.ObjectId(listingId), status: 'PUBLISHED' } },
      { $group: { _id: null, average: { $avg: '$rating' } } },
    ]),
  ]);

  return {
    items: await hydrateReviews(docs as unknown as (ReviewFields & { _id: unknown })[]),
    total,
    average: Math.round((agg[0]?.average ?? 0) * 10) / 10,
  };
}

export async function listPartnerReviews(
  partnerUserId: string,
  query: ReviewQuery,
): Promise<{ items: ReviewDTO[]; total: number; average: number }> {
  const filter: Record<string, unknown> = {
    partner: new Types.ObjectId(partnerUserId),
    status: 'PUBLISHED',
  };
  if (query.minRating) filter.rating = { $gte: query.minRating };
  const [docs, total, agg] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Review.countDocuments(filter),
    Review.aggregate<{ average: number }>([
      { $match: { partner: new Types.ObjectId(partnerUserId), status: 'PUBLISHED' } },
      { $group: { _id: null, average: { $avg: '$rating' } } },
    ]),
  ]);
  return {
    items: await hydrateReviews(docs as unknown as (ReviewFields & { _id: unknown })[]),
    total,
    average: Math.round((agg[0]?.average ?? 0) * 10) / 10,
  };
}

export async function listCustomerReviews(
  customerId: string,
  query: ReviewQuery,
): Promise<{ items: ReviewDTO[]; total: number }> {
  const filter = { author: new Types.ObjectId(customerId) };
  const [docs, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Review.countDocuments(filter),
  ]);
  return {
    items: await hydrateReviews(docs as unknown as (ReviewFields & { _id: unknown })[]),
    total,
  };
}

export async function moderateReview(
  reviewId: string,
  status: 'PUBLISHED' | 'HIDDEN' | 'REMOVED',
  listingIdForRecalc: Types.ObjectId,
): Promise<void> {
  const review = await Review.findByIdAndUpdate(
    reviewId,
    { status },
    { new: true },
  );
  if (!review) throw errors.notFound('Review not found');
  await recalculateListingRating(listingIdForRecalc);
}
