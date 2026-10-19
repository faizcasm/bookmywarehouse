import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { ACCOUNT_STATUSES, ROLES, type AccountStatus, type Role } from '@bmw/shared-types';

export interface UserFields {
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  phone: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  emailVerificationTokenHash: string | null;
  emailVerificationExpiresAt: Date | null;
  passwordResetTokenHash: string | null;
  passwordResetExpiresAt: Date | null;
  status: AccountStatus;
  statusReason: string | null;
  lastLoginAt: Date | null;
  createdByAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<UserFields>;

const userSchema = new Schema<UserFields>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    role: { type: String, enum: ROLES, required: true },
    phone: { type: String, trim: true, maxlength: 20, default: null },
    avatarUrl: { type: String, default: null },
    emailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, select: false, default: null },
    emailVerificationExpiresAt: { type: Date, select: false, default: null },
    passwordResetTokenHash: { type: String, select: false, default: null },
    passwordResetExpiresAt: { type: Date, select: false, default: null },
    status: { type: String, enum: ACCOUNT_STATUSES, default: 'ACTIVE' },
    statusReason: { type: String, default: null },
    lastLoginAt: { type: Date, default: null },
    createdByAdmin: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const record = ret as Record<string, unknown>;
        delete record.passwordHash;
        delete record.emailVerificationTokenHash;
        delete record.passwordResetTokenHash;
        return ret;
      },
    },
  },
);

userSchema.index({ role: 1, status: 1 });
userSchema.index({ createdAt: -1 });

export type RefreshTokenFields = {
  user: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByHash: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const refreshTokenSchema = new Schema<RefreshTokenFields>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true },
);

// Purge expired sessions automatically via the TTL index.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ user: 1, revokedAt: 1 });

export const User = model('User', userSchema);
export const RefreshToken = model('RefreshToken',
  refreshTokenSchema,
);
