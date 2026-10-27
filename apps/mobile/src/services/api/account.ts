/** Account endpoints (profile, favorites, reviews, messages, notifications, disputes). */

import { api } from './client';
import { toFavorite, toReview } from './normalize';
import type {
  User,
  Review,
  Dispute,
  Favorite,
  Paginated,
  Conversation,
  Message,
  Notification,
} from '@/types';
import type { FavoriteDTO, ReviewDTO } from '@bmw/shared-types';

/** GET /me — current user profile. */
export function getProfile(): Promise<User> {
  return api.get<{ user: User }>('/me').then((d) => d.user);
}

export interface UpdateProfileInput {
  name?: string;
  phone?: string | null;
  avatarUrl?: string | null;
}

/** PATCH /me — update name / phone / avatar. */
export function updateProfile(input: UpdateProfileInput): Promise<User> {
  return api.patch<{ user: User }>('/me', input).then((d) => d.user);
}

/** GET /favorites — paginated favorites with the listing embedded. */
export function listFavorites(query?: { page?: number; limit?: number }): Promise<Paginated<Favorite>> {
  return api.getPaged<FavoriteDTO>('/favorites', query).then((dto) => ({
    items: dto.items.map(toFavorite),
    meta: dto.meta,
  }));
}

/** POST /favorites — the server toggles; call again to unfavorite. */
export function toggleFavorite(listingId: string): Promise<{ favorited?: boolean }> {
  return api.post<{ favorited?: boolean }>('/favorites', { listingId });
}

/** GET /me/reviews — reviews written by the current user. */
export function listMyReviews(query?: { page?: number; limit?: number }): Promise<Paginated<Review>> {
  return api.getPaged<ReviewDTO>('/me/reviews', query).then((dto) => ({
    items: dto.items.map(toReview),
    meta: dto.meta,
  }));
}

export function createReview(input: {
  bookingId: string;
  rating: number;
  comment?: string;
}): Promise<Review> {
  return api.post<ReviewDTO>('/reviews', input).then(toReview);
}

export function listConversations(query?: { page?: number }): Promise<Paginated<Conversation>> {
  return api.getPaged<Conversation>('/conversations', query);
}

export function getMessages(conversationId: string): Promise<Message[]> {
  return api
    .get<{ items: Message[] }>(`/conversations/${encodeURIComponent(conversationId)}/messages`)
    .then((d) => d.items);
}

export function sendMessage(conversationId: string, body: string): Promise<Message> {
  return api.post<Message>(`/conversations/${encodeURIComponent(conversationId)}/messages`, { body });
}

export function markConversationRead(conversationId: string): Promise<void> {
  return api.post(`/conversations/${encodeURIComponent(conversationId)}/read`, {});
}

export function listNotifications(query?: { page?: number; limit?: number }): Promise<Paginated<Notification>> {
  return api.getPaged<Notification>('/notifications', query);
}

/** POST /notifications/read — mark all (or a provided set) as read. */
export function markNotificationsRead(ids?: string[]): Promise<void> {
  return api.post('/notifications/read', ids?.length ? { ids } : {});
}

export function listDisputes(query?: { page?: number }): Promise<Paginated<Dispute>> {
  return api.getPaged<Dispute>('/disputes', query);
}

export const DISPUTE_REASONS = [
  'SERVICE_NOT_DELIVERED',
  'QUALITY_ISSUE',
  'OVERCHARGE',
  'CANCELLATION_REFUND',
  'DAMAGE',
  'OTHER',
] as const;
export type DisputeReason = (typeof DISPUTE_REASONS)[number];

/** POST /bookings/:id/dispute — open a dispute on a booking. */
export function openDispute(
  bookingId: string,
  input: { reason: DisputeReason; description: string },
): Promise<Dispute> {
  return api.post<Dispute>(`/bookings/${encodeURIComponent(bookingId)}/dispute`, input);
}
