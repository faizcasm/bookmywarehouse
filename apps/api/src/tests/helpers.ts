import mongoose from 'mongoose';
import request from 'supertest';

import { createApp } from '../app.js';
import { connectDatabase } from '../config/db.js';
import * as models from '../models/index.js';

export const app = createApp();

export async function initTestDb(): Promise<void> {
  await connectDatabase();
}

export async function wipeTestDb(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Test database is not connected');
  const collections = await db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

export async function closeTestDb(): Promise<void> {
  await mongoose.disconnect();
}

let seq = 0;

export interface TestUser {
  id: string;
  email: string;
  name: string;
  role: string;
  token: string;
  csrfToken: string;
  cookies: string[];
}

function authHeaders(user: TestUser): Record<string, string> {
  return { Authorization: `Bearer ${user.token}` };
}

export async function registerUser(
  overrides: { role?: 'CUSTOMER' | 'PARTNER'; name?: string; businessName?: string } = {},
): Promise<TestUser> {
  seq += 1;
  const email = `test-${Date.now()}-${seq}@example.test`;
  const res = await request(app).post('/api/v1/auth/register').send({
    name: overrides.name ?? `Test User ${seq}`,
    email,
    password: 'Password1',
    role: overrides.role ?? 'CUSTOMER',
    ...(overrides.businessName ? { businessName: overrides.businessName } : {}),
  });
  if (res.status !== 201) {
    throw new Error(`Registration failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  const cookies: string[] = res.headers['set-cookie'] ?? [];
  return {
    id: res.body.data.user.id,
    email,
    name: res.body.data.user.name,
    role: res.body.data.user.role,
    token: res.body.data.accessToken,
    csrfToken: res.body.data.csrfToken,
    cookies,
  };
}

/** Promotes a registered user to ADMIN (roles cannot self-assign via API). */
export async function registerAdmin(): Promise<TestUser> {
  const user = await registerUser();
  await models.User.updateOne({ _id: user.id }, { $set: { role: 'ADMIN' } });
  return { ...user, role: 'ADMIN' };
}

/** Registers a partner and marks the profile VERIFIED (bypasses KYC queue). */
export async function registerVerifiedPartner(businessName = 'Test Logistics'): Promise<TestUser> {
  const user = await registerUser({ role: 'PARTNER', businessName });
  await models.PartnerProfile.updateOne(
    { user: user.id },
    { $set: { verificationStatus: 'VERIFIED', onboardingCompletedAt: new Date() } },
  );
  return user;
}

export async function createTestCategory(
  type: 'WAREHOUSE' | 'EQUIPMENT' | 'SERVICE' = 'WAREHOUSE',
  name = `Category ${Date.now()}-${seq++}`,
): Promise<{ id: string; slug: string }> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const doc = await models.Category.create({ name, slug, type, isActive: true });
  return { id: String(doc._id), slug };
}

export interface ListingFixtureInput {
  type?: 'WAREHOUSE' | 'EQUIPMENT' | 'SERVICE';
  categoryId: string;
  capacity?: number;
  title?: string;
}

/** Creates a DRAFT listing through the real partner API. */
export async function createPartnerListing(partner: TestUser, input: ListingFixtureInput) {
  const type = input.type ?? 'WAREHOUSE';
  const body: Record<string, unknown> = {
    type,
    title: input.title ?? 'Test warehouse for automated tests',
    description:
      'Automated test listing created by the integration suite. Ample racking, security and dock access for testing.',
    categoryId: input.categoryId,
    location: {
      addressLine1: '1 Test Street',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411001',
      country: 'India',
      coordinates: { lat: 18.52, lng: 73.86 },
    },
    price: { model: 'PER_DAY', amount: 1000, currency: 'INR', period: 'DAY', additionalCharges: [] },
    images: ['data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iNjAwIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iIzNhN2Y0ZSIvPjwvc3ZnPg=='],
    amenities: ['Security'],
    safetyFeatures: ['Fire extinguisher'],
    rules: ['Business use only'],
    cancellationTerms: {
      policy: 'MODERATE',
      description: 'Free cancellation up to 48 hours before start.',
      customerRefundPercent: 100,
    },
  };

  if (type === 'WAREHOUSE') {
    body.warehouse = {
      facilityType: 'GENERAL',
      storageTypes: ['GENERAL'],
      totalCapacity: input.capacity ?? 100,
      capacityUnit: 'PALLET',
      loadingDocks: 2,
      driveways: 1,
      powerBackup: true,
      fireSafety: true,
      cctv: true,
      certifications: [],
    };
  } else if (type === 'EQUIPMENT') {
    body.equipment = {
      equipmentCategory: 'FORKLIFT',
      quantity: 4,
      rentalPeriod: 'DAY',
      deliveryAvailable: false,
      operatorAvailable: false,
      specifications: {},
    };
  } else {
    body.service = {
      serviceType: 'LOADING_UNLOADING',
      serviceAreas: ['Pune'],
      teamSize: 4,
    };
  }

  const res = await request(app)
    .post('/api/v1/partner/listings')
    .set(authHeaders(partner))
    .send(body);

  if (res.status !== 201) {
    throw new Error(`Listing creation failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data as { id: string; slug: string; status: string };
}

export { authHeaders };
