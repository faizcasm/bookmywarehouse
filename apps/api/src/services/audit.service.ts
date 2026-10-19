import { AuditLog } from '../models/index.js';
import { logger } from '../lib/logger.js';

export interface AuditInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
}

/** Privileged actions are always recorded; failures never break the request. */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await AuditLog.create({
      actor: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary ?? null,
      metadata: input.metadata ?? null,
      ip: input.ip ?? null,
    });
  } catch (error) {
    logger.warn('Failed to write audit log', {
      action: input.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
