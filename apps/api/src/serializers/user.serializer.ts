import type { UserDTO, UserSummaryDTO } from '@bmw/shared-types';
import type { UserFields } from '../models/index.js';

export function serializeUserSummary(user: {
  _id: unknown;
  name: string;
  role: UserSummaryDTO['role'];
  avatarUrl?: string | null;
}): UserSummaryDTO {
  return {
    id: String(user._id),
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl ?? null,
  };
}

export function serializeUser(user: UserFields & { _id: unknown }): UserDTO {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone ?? null,
    avatarUrl: user.avatarUrl ?? null,
    emailVerified: user.emailVerified,
    status: user.status,
    createdAt: new Date(user.createdAt).toISOString(),
  };
}
