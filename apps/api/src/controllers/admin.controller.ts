import type { Request, Response } from 'express';
import type { z } from 'zod';
import type {
  adminCustomerCreateSchema,
  categorySchema,
  disputeResolutionSchema,
  listingModerationSchema,
  partnerDecisionSchema,
  platformSettingsSchema,
  reviewModerationSchema,
  userModerationSchema,
} from '@bmw/validation';
import { buildPageMeta, clientIp, sendSuccess } from '../lib/http.js';
import { errors } from '../lib/errors.js';
import {
  adminDashboard,
  createCategory,
  createCustomerByAdmin,
  decidePartnerVerification,
  getPartnerDetail,
  getPlatformSettings,
  listAdminListings,
  listAuditLogs,
  listCategories,
  listDisputes,
  listPartners,
  listPayments,
  listRefunds,
  listUsers,
  moderateListing,
  moderateReviewByAdmin,
  moderateUser,
  processRefundAdmin,
  resolveDispute,
  updateCategory,
  updatePlatformSettings,
} from '../services/admin.service.js';
import { listInvoices } from '../services/invoice.service.js';
import { recordAudit } from '../services/audit.service.js';

interface PageQuery {
  page: number;
  limit: number;
  q?: string;
}

function requireAdmin(req: Request): { userId: string } {
  if (!req.auth || req.auth.role !== 'ADMIN') {
    throw errors.forbidden('Administrator access required');
  }
  return { userId: req.auth.userId };
}

export async function dashboardHandler(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, await adminDashboard());
}

export async function usersHandler(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const query = req.query as unknown as PageQuery & { role?: string; status?: string };
  const result = await listUsers(query);
  sendSuccess(res, { items: result.items }, {
    meta: { pagination: buildPageMeta(query.page, query.limit, result.total) },
  });
}

export async function moderateUserHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAdmin(req);
  const input = req.body as z.infer<typeof userModerationSchema>;
  await moderateUser(userId, req.params.id as string, input.action, input.reason ?? null, clientIp(req));
  sendSuccess(res, { ok: true });
}

export async function createUserHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAdmin(req);
  const input = req.body as z.infer<typeof adminCustomerCreateSchema>;
  const user = await createCustomerByAdmin(userId, input, clientIp(req));
  sendSuccess(res, user, { status: 201 });
}

export async function partnersHandler(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const query = req.query as unknown as PageQuery & { verificationStatus?: string };
  const result = await listPartners(query);
  sendSuccess(res, { items: result.items }, {
    meta: { pagination: buildPageMeta(query.page, query.limit, result.total) },
  });
}

export async function partnerDetailHandler(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  sendSuccess(res, await getPartnerDetail(req.params.id as string));
}

export async function partnerDecisionHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAdmin(req);
  const input = req.body as z.infer<typeof partnerDecisionSchema>;
  await decidePartnerVerification({
    actorId: userId,
    partnerId: req.params.id as string,
    decision: input.decision,
    reason: input.reason ?? null,
    notes: input.notes ?? null,
    ip: clientIp(req),
  });
  sendSuccess(res, { ok: true });
}

export async function verificationQueueHandler(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const query = req.query as unknown as PageQuery;
  const result = await listPartners({
    ...query,
    verificationStatus: (req.query.status as string) ?? 'SUBMITTED',
  });
  sendSuccess(res, { items: result.items }, {
    meta: { pagination: buildPageMeta(query.page, query.limit, result.total) },
  });
}

export async function adminListingsHandler(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const query = req.query as unknown as PageQuery & { status?: string; type?: string };
  const result = await listAdminListings(query);
  sendSuccess(res, { items: result.items }, {
    meta: { pagination: buildPageMeta(query.page, query.limit, result.total) },
  });
}

export async function moderateListingHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAdmin(req);
  const input = req.body as z.infer<typeof listingModerationSchema>;
  await moderateListing(userId, req.params.id as string, input.decision, input.reason ?? null, clientIp(req));
  sendSuccess(res, { ok: true });
}

export async function paymentsHandler(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const query = req.query as unknown as PageQuery & { status?: string };
  const result = await listPayments(query);
  sendSuccess(res, { items: result.items }, {
    meta: { pagination: buildPageMeta(query.page, query.limit, result.total) },
  });
}

export async function refundsHandler(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const query = req.query as unknown as PageQuery & { status?: string };
  const result = await listRefunds(query);
  sendSuccess(res, { items: result.items }, {
    meta: { pagination: buildPageMeta(query.page, query.limit, result.total) },
  });
}

export async function processRefundHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAdmin(req);
  await processRefundAdmin(userId, req.params.id as string);
  sendSuccess(res, { ok: true });
}

export async function adminInvoicesHandler(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 12);
  const result = await listInvoices({ role: 'admin', userId: '' }, page, limit);
  sendSuccess(res, { items: result.items }, {
    meta: { pagination: buildPageMeta(page, limit, result.total) },
  });
}

export async function disputesHandler(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const query = req.query as unknown as PageQuery & { status?: string };
  const result = await listDisputes(query);
  sendSuccess(res, { items: result.items }, {
    meta: { pagination: buildPageMeta(query.page, query.limit, result.total) },
  });
}

export async function resolveDisputeHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAdmin(req);
  const input = req.body as z.infer<typeof disputeResolutionSchema>;
  await resolveDispute(userId, req.params.id as string, input, clientIp(req));
  sendSuccess(res, { ok: true });
}

export async function categoriesHandler(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const includeInactive = req.query.includeInactive === 'true';
  sendSuccess(res, { items: await listCategories(includeInactive) });
}

export async function createCategoryHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAdmin(req);
  const input = req.body as z.infer<typeof categorySchema>;
  const category = await createCategory(input);
  await recordAudit({
    actorId: userId,
    action: 'admin.category_created',
    entityType: 'Category',
    entityId: category.id,
    summary: category.name,
    ip: clientIp(req),
  });
  sendSuccess(res, category, { status: 201 });
}

export async function updateCategoryHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAdmin(req);
  const input = req.body as Partial<z.infer<typeof categorySchema>>;
  await updateCategory(userId, req.params.id as string, input);
  sendSuccess(res, { ok: true });
}

export async function settingsHandler(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, await getPlatformSettings());
}

export async function updateSettingsHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAdmin(req);
  const input = req.body as z.infer<typeof platformSettingsSchema>;
  sendSuccess(res, await updatePlatformSettings(userId, input, clientIp(req)));
}

export async function auditLogsHandler(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const query = req.query as unknown as PageQuery & {
    action?: string;
    entityType?: string;
    entityId?: string;
  };
  const result = await listAuditLogs(query);
  sendSuccess(res, { items: result.items }, {
    meta: { pagination: buildPageMeta(query.page, query.limit, result.total) },
  });
}

export async function reviewsHandler(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 20);
  const { Review } = await import('../models/index.js');
  const { hydrateReviews } = await import('../services/review.service.js');
  const [docs, total] = await Promise.all([
    Review.find({}).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Review.countDocuments({}),
  ]);
  sendSuccess(res, { items: await hydrateReviews(docs as never) }, {
    meta: { pagination: buildPageMeta(page, limit, total) },
  });
}

export async function moderateReviewHandler(req: Request, res: Response): Promise<void> {
  const { userId } = requireAdmin(req);
  const input = req.body as z.infer<typeof reviewModerationSchema>;
  await moderateReviewByAdmin(userId, req.params.id as string, input, clientIp(req));
  sendSuccess(res, { ok: true });
}
