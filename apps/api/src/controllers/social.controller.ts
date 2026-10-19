import type { Request, Response } from 'express';
import type { z } from 'zod';
import type {
  conversationListQuerySchema,
  createConversationSchema,
  createReviewSchema,
  favoriteToggleSchema,
  markReadSchema,
  messageListQuerySchema,
  notificationListQuerySchema,
  respondReviewSchema,
  reviewListQuerySchema,
  sendMessageSchema,
} from '@bmw/validation';
import { buildPageMeta, sendSuccess } from '../lib/http.js';
import { errors } from '../lib/errors.js';
import {
  createReview,
  listCustomerReviews,
  listListingReviews,
  listPartnerReviews,
  respondToReview,
} from '../services/review.service.js';
import { listFavorites, toggleFavorite } from '../services/favorite.service.js';
import {
  createConversation,
  listConversations,
  listMessages,
  markConversationRead,
  sendMessage,
  unreadMessageCount,
} from '../services/messaging.service.js';
import { Notification } from '../models/index.js';
import { unreadCount } from '../services/notification.service.js';
import { listMyDisputes } from '../services/dispute.service.js';

function requireAuth(req: Request): { userId: string; role: 'CUSTOMER' | 'PARTNER' | 'ADMIN' } {
  if (!req.auth) throw errors.unauthenticated();
  return { userId: req.auth.userId, role: req.auth.role };
}

export async function createReviewHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const input = req.body as z.infer<typeof createReviewSchema>;
  const review = await createReview(userId, input);
  sendSuccess(res, { id: String(review._id) }, { status: 201 });
}

export async function myReviewsHandler(req: Request, res: Response): Promise<void> {
  const { userId, role } = requireAuth(req);
  const query = req.query as unknown as z.infer<typeof reviewListQuerySchema>;
  if (role === 'PARTNER') {
    const result = await listPartnerReviews(userId, query);
    sendSuccess(res, { items: result.items, average: result.average }, {
      meta: { pagination: buildPageMeta(query.page, query.limit, result.total) },
    });
    return;
  }
  const result = await listCustomerReviews(userId, query);
  sendSuccess(res, { items: result.items }, {
    meta: { pagination: buildPageMeta(query.page, query.limit, result.total) },
  });
}

export async function respondReviewHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const input = req.body as z.infer<typeof respondReviewSchema>;
  const review = await respondToReview(userId, req.params.id as string, input.text);
  sendSuccess(res, { id: String(review._id), response: review.response });
}

export async function toggleFavoriteHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const input = req.body as z.infer<typeof favoriteToggleSchema>;
  const result = await toggleFavorite(userId, input.listingId);
  sendSuccess(res, result);
}

export async function listFavoritesHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 12);
  const result = await listFavorites(userId, page, limit);
  sendSuccess(res, { items: result.items }, {
    meta: { pagination: buildPageMeta(page, limit, result.total) },
  });
}

export async function createConversationHandler(req: Request, res: Response): Promise<void> {
  const { userId, role } = requireAuth(req);
  const input = req.body as z.infer<typeof createConversationSchema>;
  const result = await createConversation(userId, role, input);
  sendSuccess(res, result, { status: 201 });
}

export async function listConversationsHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const query = req.query as unknown as z.infer<typeof conversationListQuerySchema>;
  const result = await listConversations(userId, query);
  sendSuccess(res, { items: result.items, unreadTotal: await unreadMessageCount(userId) }, {
    meta: { pagination: buildPageMeta(query.page, query.limit, result.total) },
  });
}

export async function listMessagesHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const query = req.query as unknown as z.infer<typeof messageListQuerySchema>;
  const result = await listMessages(userId, req.params.id as string, query);
  sendSuccess(res, { items: result.items }, {
    meta: { pagination: buildPageMeta(query.page, query.limit, result.total) },
  });
}

export async function sendMessageHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const input = req.body as z.infer<typeof sendMessageSchema>;
  const message = await sendMessage(userId, req.params.id as string, input.body);
  sendSuccess(res, message, { status: 201 });
}

export async function markReadHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const input = req.body as z.infer<typeof markReadSchema>;
  if (input.ids && input.ids.length > 0) {
    await Notification.updateMany(
      { user: userId, _id: { $in: input.ids } },
      { $set: { read: true, readAt: new Date() } },
    );
  } else {
    await markConversationRead(userId, req.params.id as string);
  }
  sendSuccess(res, { ok: true });
}

export async function markNotificationsReadHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const input = (req.body ?? {}) as { ids?: string[] };
  const filter = input.ids?.length
    ? { user: userId, _id: { $in: input.ids } }
    : { user: userId, read: false };
  await Notification.updateMany(filter, { $set: { read: true, readAt: new Date() } });
  sendSuccess(res, { ok: true, unread: await unreadCount(userId) });
}

export async function listNotificationsHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAuth(req);
  const query = req.query as unknown as z.infer<typeof notificationListQuerySchema>;
  const filter: Record<string, unknown> = { user: userId };
  if (query.unreadOnly) filter.read = false;
  const [docs, total, unread] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Notification.countDocuments(filter),
    unreadCount(userId),
  ]);
  sendSuccess(res, {
    unread,
    items: docs.map((doc) => ({
      id: String(doc._id),
      type: doc.type,
      title: doc.title,
      body: doc.body,
      link: doc.link ?? null,
      read: doc.read,
      createdAt: new Date(doc.createdAt).toISOString(),
    })),
  }, {
    meta: { pagination: buildPageMeta(query.page, query.limit, total) },
  });
}

export async function myDisputesHandler(req: Request, res: Response): Promise<void> {
  const { userId, role } = requireAuth(req);
  const result = await listMyDisputes(userId, role);
  sendSuccess(res, { items: result.items, total: result.total });
}
