import { z } from 'zod';
import { paginationSchema } from '@bmw/validation';

/**
 * Shared list-query shape for admin/partner consoles. Explicitly declares the
 * filter keys the controllers read so validation does not strip them.
 */
export const pageQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().max(60).optional(),
  role: z.string().trim().max(40).optional(),
  type: z.string().trim().max(40).optional(),
  verificationStatus: z.string().trim().max(40).optional(),
  action: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(80).optional(),
  entityId: z.string().trim().max(80).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
  scope: z.string().trim().max(20).optional(),
});

export type PageQuery = z.infer<typeof pageQuerySchema>;
