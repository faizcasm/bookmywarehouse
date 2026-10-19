import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@bmw/shared-types';
import { config } from '../config/env.js';
import { errors } from './errors.js';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  email: string;
  sid: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, config.access.secret, {
    expiresIn: config.access.ttl as SignOptions['expiresIn'],
    issuer: 'bookmywarehouse',
    audience: 'bookmywarehouse-api',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, config.access.secret, {
      issuer: 'bookmywarehouse',
      audience: 'bookmywarehouse-api',
    });
    if (typeof decoded === 'string') throw errors.unauthenticated();
    return decoded as unknown as AccessTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) throw errors.tokenExpired();
    throw errors.unauthenticated('Invalid access token');
  }
}
