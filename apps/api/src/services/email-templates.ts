import type { NotificationType, Role } from '@bmw/shared-types';
import { env } from '../config/env.js';
import { renderSimpleEmail, type EmailMessage } from './email.service.js';

/** Escapes the five HTML special characters so user-derived text is safe to inline. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface NotificationEmailTemplate {
  /** Fixed subject line (kept generic — the dynamic details live in the body). */
  subject: string;
  heading: string;
  actionLabel: string;
}

/**
 * Curated subset of NOTIFICATION_TYPES that also deserve a transactional email.
 * Types without enough context for a good email (reviews, messages, listings,
 * system announcements…) stay in-app only.
 */
export const EMAIL_TEMPLATES: Partial<Record<NotificationType, NotificationEmailTemplate>> = {
  BOOKING_REQUESTED: {
    subject: 'New booking request',
    heading: 'You have a new booking request',
    actionLabel: 'Review request',
  },
  BOOKING_ACCEPTED: {
    subject: 'Booking confirmed',
    heading: 'Your booking is confirmed',
    actionLabel: 'View booking',
  },
  BOOKING_CANCELLED: {
    subject: 'Booking cancelled',
    heading: 'Your booking was cancelled',
    actionLabel: 'View booking',
  },
  PAYMENT_SUCCEEDED: {
    subject: 'Payment successful',
    heading: 'We received your payment',
    actionLabel: 'View invoice / booking',
  },
  PAYMENT_FAILED: {
    subject: 'Payment failed',
    heading: 'Your payment did not go through',
    actionLabel: 'Retry payment',
  },
  REFUND_PROCESSED: {
    subject: 'Refund update',
    heading: 'Your refund was processed',
    actionLabel: 'View booking',
  },
  DISPUTE_OPENED: {
    subject: 'Dispute opened',
    heading: 'A dispute has been opened',
    actionLabel: 'View dispute',
  },
};

/** Notification links are app-relative; each role lives on its own frontend. */
const APP_URL_BY_ROLE: Record<Role, string> = {
  CUSTOMER: env.CUSTOMER_APP_URL,
  PARTNER: env.PARTNER_APP_URL,
  ADMIN: env.ADMIN_APP_URL,
};

/** Turns a relative notification link into an absolute URL for the recipient's app. */
export function buildAbsoluteAppUrl(role: Role, link: string | null | undefined): string | null {
  if (!link) return null;
  if (/^https?:\/\//i.test(link)) return link;
  const base = APP_URL_BY_ROLE[role].replace(/\/+$/, '');
  return `${base}/${link.replace(/^\/+/, '')}`;
}

export interface NotificationEmailInput {
  type: NotificationType;
  body: string;
  link?: string | null;
}

/**
 * Builds the transactional email for a notification, or returns null when the
 * type is outside the curated map. All text inserted into the HTML is escaped.
 */
export function buildEmailForNotification(
  input: NotificationEmailInput,
  recipient: { email: string; role: Role },
): EmailMessage | null {
  const template = EMAIL_TEMPLATES[input.type];
  if (!template) return null;

  const actionUrl = buildAbsoluteAppUrl(recipient.role, input.link);
  const html = renderSimpleEmail({
    heading: escapeHtml(template.heading),
    body: escapeHtml(input.body),
    ...(actionUrl
      ? { actionLabel: escapeHtml(template.actionLabel), actionUrl: escapeHtml(actionUrl) }
      : {}),
  });
  const text = [template.heading, input.body, actionUrl ? `${template.actionLabel}: ${actionUrl}` : null]
    .filter((line): line is string => Boolean(line))
    .join('\n\n');

  return { to: recipient.email, subject: template.subject, html, text };
}
