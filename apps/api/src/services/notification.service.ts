import type { NotificationType } from '@bmw/shared-types';
import { Notification } from '../models/index.js';
import { logger } from '../lib/logger.js';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
}

/**
 * Creates an in-app notification. Transactional email is sent separately by the
 * calling service, which is the only place that holds the recipient address.
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
  }
}

export async function notifyMany(inputs: NotifyInput[]): Promise<void> {
  await Promise.all(inputs.map(notify));
}

export async function unreadCount(userId: string): Promise<number> {
  return Notification.countDocuments({ user: userId, read: false });
}
