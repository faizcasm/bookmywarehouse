/** Account endpoints (profile, favorites, reviews, messages, notifications, disputes). */

import { api } from './client';
import type { User, Review, Dispute, Paginated, Conversation, Message, Notification } from '@/types';

export function getProfile(): Promise<User> {
  return api.get<User>('/users/me');
}

export function updateProfile(input: Partial<User>): Promise<User> {
  return api.patch<User>('/users/me', input);
}

export function listFavorites(): Promise<string[]> {
  return api.get<{ items: string[] }>('/favorites').then((d) => d.items);
}

export function addFavorite(listingId: string): Promise<void> {
  return api.post('/favorites', { listingId });
}

export function removeFavorite(listingId: string): Promise<void> {
  return api.delete(`/favorites/${encodeURIComponent(listingId)}`);
}

export function listReviews(query?: { page?: number }): Promise<Paginated<Review>> {
  return api.get<Paginated<Review>>('/reviews', query);
}

export function createReview(input: { bookingId: string; rating: number; comment?: string }): Promise<Review> {
  return api.post<Review>('/reviews', input);
}

export function listConversations(query?: { page?: number }): Promise<Paginated<Conversation>> {
  return api.get<Paginated<Conversation>>('/conversations', query);
}

export function getMessages(conversationId: string): Promise<Message[]> {
  return api.get<{ items: Message[] }>(`/conversations/${encodeURIComponent(conversationId)}/messages`).then((d) => d.items);
}

export function sendMessage(conversationId: string, body: string): Promise<Message> {
  return api.post<Message>(`/conversations/${encodeURIComponent(conversationId)}/messages`, { body });
}

export function markConversationRead(conversationId: string): Promise<void> {
  return api.post(`/conversations/${encodeURIComponent(conversationId)}/read`);
}

export function listNotifications(query?: { page?: number }): Promise<Paginated<Notification>> {
  return api.get<Paginated<Notification>>('/notifications', query);
}

export function markNotificationRead(id: string): Promise<void> {
  return api.patch(`/notifications/${encodeURIComponent(id)}`, { read: true });
}

export function markAllNotificationsRead(): Promise<void> {
  return api.post('/notifications/read-all');
}

export function listDisputes(query?: { page?: number }): Promise<Paginated<Dispute>> {
  return api.get<Paginated<Dispute>>('/disputes', query);
}

export function createDispute(input: { bookingId: string; reason: string }): Promise<Dispute> {
  return api.post<Dispute>('/disputes', input);
}