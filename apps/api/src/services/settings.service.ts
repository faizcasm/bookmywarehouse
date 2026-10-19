import { PlatformSettings } from '../models/index.js';
import type { PlatformSettingsDTO } from '@bmw/shared-types';

const DEFAULTS = {
  currency: 'INR',
  platformFeePercent: 10,
  customerFeePercent: 0,
  taxPercent: 18,
  minPayoutAmountMinor: 100_000,
  supportEmail: 'support@bookmywarehouse.dev',
  allowSelfServiceListings: true,
  requirePartnerVerification: true,
  maintenanceMode: false,
  announcement: null as string | null,
};

export type SettingsDoc = typeof DEFAULTS;

let cache: SettingsDoc | null = null;
let cacheAt = 0;
const TTL_MS = 30_000;

export async function getSettings(): Promise<SettingsDoc> {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache;
  const doc = await PlatformSettings.findOne({ key: 'platform' }).lean();
  cache = doc
    ? {
        currency: doc.currency ?? DEFAULTS.currency,
        platformFeePercent: doc.platformFeePercent,
        customerFeePercent: doc.customerFeePercent,
        taxPercent: doc.taxPercent,
        minPayoutAmountMinor: doc.minPayoutAmountMinor,
        supportEmail: doc.supportEmail,
        allowSelfServiceListings: doc.allowSelfServiceListings,
        requirePartnerVerification: doc.requirePartnerVerification,
        maintenanceMode: doc.maintenanceMode,
        announcement: doc.announcement ?? null,
      }
    : { ...DEFAULTS };
  cacheAt = Date.now();
  return cache;
}

export function invalidateSettingsCache(): void {
  cache = null;
  cacheAt = 0;
}

export async function ensureSettings(): Promise<SettingsDoc> {
  const existing = await PlatformSettings.findOne({ key: 'platform' });
  if (existing) return getSettings();
  await PlatformSettings.create({ key: 'platform', ...DEFAULTS });
  invalidateSettingsCache();
  return getSettings();
}

export function toSettingsDTO(settings: SettingsDoc): PlatformSettingsDTO {
  return {
    currency: settings.currency as PlatformSettingsDTO['currency'],
    platformFeePercent: settings.platformFeePercent,
    customerFeePercent: settings.customerFeePercent,
    taxPercent: settings.taxPercent,
    minPayoutAmount: settings.minPayoutAmountMinor,
    supportEmail: settings.supportEmail,
    allowSelfServiceListings: settings.allowSelfServiceListings,
    requirePartnerVerification: settings.requirePartnerVerification,
    maintenanceMode: settings.maintenanceMode,
    announcement: settings.announcement,
  };
}
