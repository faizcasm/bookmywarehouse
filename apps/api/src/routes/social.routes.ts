import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/async-handler.js';
import {
  conversationListQuerySchema,
  createConversationSchema,
  createReviewSchema,
  favoriteToggleSchema,
  markReadSchema,
  messageListQuerySchema,
  notificationListQuerySchema,
  paginationSchema,
  respondReviewSchema,
  reviewListQuerySchema,
  sendMessageSchema,
  updateProfileSchema,
  uploadImageSchema,
} from '@bmw/validation';
import {
  createReviewHandler,
  myReviewsHandler,
  respondReviewHandler,
  toggleFavoriteHandler,
  listFavoritesHandler,
  createConversationHandler,
  listConversationsHandler,
  getConversationHandler,
  listMessagesHandler,
  sendMessageHandler,
  markReadHandler,
  markNotificationsReadHandler,
  listNotificationsHandler,
  myDisputesHandler,
} from '../controllers/social.controller.js';
import { updateProfileHandler, meHandler } from '../controllers/auth.controller.js';
import { uploadHandler } from '../controllers/catalog.controller.js';

const markAllReadSchema = z.object({ ids: z.array(z.string()).optional() }).passthrough();

/**
 * Social / engagement routes mounted directly under /api/v1:
 * profile, reviews, favorites, notifications, messaging, disputes, uploads.
 */
export function socialRoutes(): Router {
  const router = Router();
  router.use(requireAuth);

  // Own profile
  router.get('/me', asyncHandler(meHandler));
  router.patch('/me', validate({ body: updateProfileSchema }), asyncHandler(updateProfileHandler));

  // Media upload (data-URI base64 → inline dev storage or Cloudinary when configured)
  router.post('/uploads', validate({ body: uploadImageSchema }), asyncHandler(uploadHandler));

  // Reviews
  router.get('/me/reviews', validate({ query: reviewListQuerySchema }), asyncHandler(myReviewsHandler));
  router.post('/reviews', validate({ body: createReviewSchema }), asyncHandler(createReviewHandler));
  router.post('/reviews/:id/respond', validate({ body: respondReviewSchema }), asyncHandler(respondReviewHandler));

  // Favorites
  router.get('/favorites', validate({ query: paginationSchema }), asyncHandler(listFavoritesHandler));
  router.post('/favorites', validate({ body: favoriteToggleSchema }), asyncHandler(toggleFavoriteHandler));

  // Notifications
  router.get('/notifications', validate({ query: notificationListQuerySchema }), asyncHandler(listNotificationsHandler));
  router.post('/notifications/read', validate({ body: markAllReadSchema }), asyncHandler(markNotificationsReadHandler));

  // Messaging
  router.get('/conversations', validate({ query: conversationListQuerySchema }), asyncHandler(listConversationsHandler));
  router.post('/conversations', validate({ body: createConversationSchema }), asyncHandler(createConversationHandler));
  router.get('/conversations/:id', asyncHandler(getConversationHandler));
  router.get(
    '/conversations/:id/messages',
    validate({ query: messageListQuerySchema }),
    asyncHandler(listMessagesHandler),
  );
  router.post(
    '/conversations/:id/messages',
    validate({ body: sendMessageSchema }),
    asyncHandler(sendMessageHandler),
  );
  router.post('/conversations/:id/read', validate({ body: markReadSchema }), asyncHandler(markReadHandler));

  // Disputes raised by the current user
  router.get('/disputes', asyncHandler(myDisputesHandler));

  return router;
}
