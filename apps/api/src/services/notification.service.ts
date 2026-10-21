import type { NotificationType } from '@bmw/shared-types';
import { Notification, User } from '../models/index.js';
import { logger } from '../lib/logger.js';
import { sendEmail } from './email.service.js';
import { buildEmailForNotification, EMAIL_TEMPLATES } from './email-templates.js';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
}

/**
 * Sends the transactional email for a curated notification type. Fire-and-forget:
 * every failure is logged and swallowed so it can never break the calling flow.
 */
async function sendNotificationEmail(input: NotifyInput): Promise<void> {
  try {
    const user = await User.findById(input.userId).select('email role').lean();
    if (!user?.email) return;
    const message = buildEmailForNotification(input, { email: user.email, role: user.role });
    if (!message) return;
    await sendEmail(message);
  } catch (error) {
    logger.warn('Failed to send notification email', {
      type: input.type,
      userId: input.userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Creates an in-app notification. For curated types (see EMAIL_TEMPLATES) a
 * transactional email is fired and forgotten after the notification persists —
 * an email failure never fails the business flow.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await Notification.create({
      user: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link ?? null,
    });
  } catch (error) {
    logger.warn('Failed to create notification', {
      type: input.type,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }
  if (EMAIL_TEMPLATES[input.type]) {
    void sendNotificationEmail(input);
  }
}

export async function notifyMany(inputs: NotifyInput[]): Promise<void> {
  await Promise.all(inputs.map(notify));
}

export async function unreadCount(userId: string): Promise<number> {
  return Notification.countDocuments({ user: userId, read: false });
}
