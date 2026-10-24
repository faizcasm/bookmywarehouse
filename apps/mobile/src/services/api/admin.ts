/** Admin endpoints (dashboard, users, partners, verifications, listings, bookings, payments, refunds, invoices, disputes, categories, reviews, settings, audit, exports). */

import { api, apiText } from './client';
import type { AdminDashboard, Booking, Paginated } from '@/types';
import type { QueryParams } from './client';

export function getAdminDashboard(): Promise<AdminDashboard> {
  return api.get<AdminDashboard>('/admin/dashboard');
}

export function listAdminUsers<T = Record<string, unknown>>(query?: QueryParams): Promise<Paginated<T>> {
  return api.getPaged<T>('/admin/users', query);
}

export function updateUserStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'): Promise<void> {
  return api.patch(`/admin/users/${encodeURIComponent(id)}/status`, { status });
}

export function listAdminPartners<T = Record<string, unknown>>(query?: QueryParams): Promise<Paginated<T>> {
  return api.getPaged<T>('/admin/partners', query);
}

export function getAdminPartner(id: string): Promise<Record<string, unknown>> {
  return api.get(`/admin/partners/${encodeURIComponent(id)}`);
}

export function listVerifications<T = Record<string, unknown>>(query?: QueryParams): Promise<Paginated<T>> {
  return api.getPaged<T>('/admin/verifications', query);
}

export function approveVerification(id: string): Promise<void> {
  return api.post(`/admin/verifications/${encodeURIComponent(id)}/approve`);
}

export function rejectVerification(id: string, reason: string): Promise<void> {
  return api.post(`/admin/verifications/${encodeURIComponent(id)}/reject`, { reason });
}

export function listAdminListings<T = Record<string, unknown>>(query?: QueryParams): Promise<Paginated<T>> {
  return api.getPaged<T>('/admin/listings', query);
}

export function moderateListing(id: string, action: 'approve' | 'reject' | 'suspend' | 'restore'): Promise<void> {
  return api.post(`/admin/listings/${encodeURIComponent(id)}/${action}`);
}

export function listAdminBookings<T = Booking>(query?: QueryParams): Promise<Paginated<T>> {
  return api.getPaged<T>('/admin/bookings', query);
}

export function refundBooking(id: string, amountMinor: number): Promise<Booking> {
  return api.post<Booking>(`/admin/bookings/${encodeURIComponent(id)}/refund`, { amountMinor });
}

export function listAdminPayments<T = Record<string, unknown>>(query?: QueryParams): Promise<Paginated<T>> {
  return api.getPaged<T>('/admin/payments', query);
}

export function retryPaymentWebhook(id: string): Promise<void> {
  return api.post(`/admin/payments/${encodeURIComponent(id)}/retry-webhook`);
}

export function listAdminRefunds<T = Record<string, unknown>>(query?: QueryParams): Promise<Paginated<T>> {
  return api.getPaged<T>('/admin/refunds', query);
}

export function processRefund(id: string): Promise<void> {
  return api.post(`/admin/refunds/${encodeURIComponent(id)}/process`);
}

export function voidRefund(id: string): Promise<void> {
  return api.post(`/admin/refunds/${encodeURIComponent(id)}/void`);
}

export function listAdminInvoices<T = Record<string, unknown>>(query?: QueryParams): Promise<Paginated<T>> {
  return api.getPaged<T>('/admin/invoices', query);
}

export function getAdminInvoice(id: string): Promise<Record<string, unknown>> {
  return api.get(`/admin/invoices/${encodeURIComponent(id)}`);
}

export function listAdminDisputes<T = Record<string, unknown>>(query?: QueryParams): Promise<Paginated<T>> {
  return api.getPaged<T>('/admin/disputes', query);
}

export function resolveDispute(id: string, resolution: string): Promise<void> {
  return api.post(`/admin/disputes/${encodeURIComponent(id)}/resolve`, { resolution });
}

export function listAdminCategories(): Promise<Array<{ id: string; name: string; slug: string; parentId?: string }>> {
  return api.get<{ items: Array<{ id: string; name: string; slug: string; parentId?: string }> }>('/admin/categories').then((d) => d.items);
}

export function createCategory(input: { name: string; slug: string; parentId?: string }): Promise<Record<string, unknown>> {
  return api.post('/admin/categories', input);
}

export function updateCategory(id: string, input: { name?: string; slug?: string; parentId?: string }): Promise<void> {
  return api.patch(`/admin/categories/${encodeURIComponent(id)}`, input);
}

export function deleteCategory(id: string): Promise<void> {
  return api.delete(`/admin/categories/${encodeURIComponent(id)}`);
}

export function listAdminReviews<T = Record<string, unknown>>(query?: QueryParams): Promise<Paginated<T>> {
  return api.getPaged<T>('/admin/reviews', query);
}

export function deleteAdminReview(id: string): Promise<void> {
  return api.delete(`/admin/reviews/${encodeURIComponent(id)}`);
}

export function getAdminSettings(): Promise<Record<string, unknown>> {
  return api.get('/admin/settings');
}

export function updateAdminSettings(input: Record<string, unknown>): Promise<void> {
  return api.patch('/admin/settings', input);
}

export function listAuditLogs<T = Record<string, unknown>>(query?: QueryParams): Promise<Paginated<T>> {
  return api.getPaged<T>('/admin/audit-logs', query);
}

export function downloadExport(kind: 'users' | 'bookings' | 'payments'): Promise<string> {
  return apiText(`/admin/exports/${encodeURIComponent(kind)}`);
}