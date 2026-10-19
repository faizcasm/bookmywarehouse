import { Types } from 'mongoose';
import type { z } from 'zod';

import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { logger } from '../lib/logger.js';
import { hashPassword } from '../lib/crypto.js';
import {
  Booking,
  BusinessVerification,
  Category,
  CustomerProfile,
  Listing,
  PartnerProfile,
  User,
} from '../models/index.js';
import { createListing } from '../services/listing.service.js';
import {
  acceptBooking,
  createBookingRequest,
  transitionBooking,
} from '../services/booking.service.js';
import { initiatePayment, simulateGatewayResult } from '../services/payment.service.js';
import { createReview } from '../services/review.service.js';
import { addAvailabilityRule } from '../services/partner.service.js';
import { createConversation } from '../services/messaging.service.js';
import type { createListingSchema } from '@bmw/validation';

/**
 * DEVELOPMENT / DEMONstration SEED.
 *
 * Everything created here is explicitly demo data (names carry "(Demo)" and
 * listing descriptions are prefixed with "[DEMO]"). No production secrets are
 * embedded — the single demo password below is for local development only.
 *
 * Run: pnpm seed
 */

const DEMO_PASSWORD = 'Demo@1234';
const DEMO_DOMAIN = 'bookmywarehouse.dev';

type ListingInput = z.infer<typeof createListingSchema>;

function svgImage(label: string, from: string, to: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>` +
    `</linearGradient></defs>` +
    `<rect width="800" height="600" fill="url(#g)"/>` +
    `<rect x="24" y="24" width="752" height="552" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2" rx="16"/>` +
    `<text x="56" y="320" font-family="Arial, sans-serif" font-size="44" fill="#ffffff">${label}</text>` +
    `<text x="56" y="372" font-family="Arial, sans-serif" font-size="22" fill="rgba(255,255,255,0.75)">DEMO IMAGE</text>` +
    `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

const location = {
  addressLine1: 'Plot 42, Industrial Estate',
  city: 'Pune',
  state: 'Maharashtra',
  postalCode: '411019',
  country: 'India',
  region: 'West India',
  coordinates: { lat: 18.5204, lng: 73.8567 },
} as const;

async function upsertUser(input: {
  email: string;
  name: string;
  role: 'ADMIN' | 'PARTNER' | 'CUSTOMER';
  phone?: string;
}): Promise<{ id: string; created: boolean }> {
  const email = input.email.toLowerCase();
  const existing = await User.findOne({ email }).select('_id').lean();
  if (existing) return { id: String(existing._id), created: false };

  const user = await User.create({
    email,
    name: input.name,
    role: input.role,
    phone: input.phone ?? null,
    passwordHash: await hashPassword(DEMO_PASSWORD),
    emailVerified: true,
    status: 'ACTIVE',
  });
  return { id: String(user._id), created: true };
}

async function upsertCategory(input: {
  name: string;
  slug: string;
  type: 'WAREHOUSE' | 'EQUIPMENT' | 'SERVICE';
  description: string;
  sortOrder: number;
}): Promise<string> {
  const existing = await Category.findOne({ slug: input.slug }).select('_id').lean();
  if (existing) return String(existing._id);
  const doc = await Category.create({ ...input, isActive: true });
  return String(doc._id);
}

interface ListingSpec {
  slug: string;
  input: ListingInput;
}

async function upsertListing(partnerId: string, spec: ListingSpec): Promise<string> {
  const existing = await Listing.findOne({ slug: spec.slug }).select('_id status').lean();
  if (existing) {
    if (existing.status === 'DRAFT') {
      await Listing.updateOne(
        { _id: existing._id },
        { $set: { status: 'PUBLISHED', publishedAt: new Date(), submittedAt: new Date() } },
      );
    }
    return String(existing._id);
  }
  const listing = await createListing(partnerId, spec.input);
  listing.status = 'PUBLISHED';
  listing.submittedAt = new Date();
  listing.publishedAt = new Date();
  await listing.save();
  return String(listing._id);
}

async function main(): Promise<void> {
  await connectDatabase();
  logger.info('Seeding DEMO data (all records below are demonstration-only)...');

  // --- Users --------------------------------------------------------------
  const admin = await upsertUser({
    email: `admin@${DEMO_DOMAIN}`,
    name: 'Demo Administrator',
    role: 'ADMIN',
  });
  const partner1 = await upsertUser({
    email: `partner@${DEMO_DOMAIN}`,
    name: 'Asha Verma (Demo)',
    role: 'PARTNER',
    phone: '+919876543210',
  });
  const partner2 = await upsertUser({
    email: `partner2@${DEMO_DOMAIN}`,
    name: 'Ravi Krishnan (Demo)',
    role: 'PARTNER',
  });
  const customer = await upsertUser({
    email: `customer@${DEMO_DOMAIN}`,
    name: 'Meera Shah (Demo)',
    role: 'CUSTOMER',
    phone: '+919812345678',
  });

  logger.info('users ready', { admin, partner1, partner2, customer });

  // --- Profiles -----------------------------------------------------------
  if (!(await PartnerProfile.findOne({ user: partner1.id }))) {
    await PartnerProfile.create({
      user: partner1.id,
      businessName: 'SwiftStow Logistics (Demo)',
      businessType: 'PRIVATE_LIMITED',
      description:
        '[DEMO] Regional 3PL operator with cold-chain and general warehousing across western India.',
      address: { ...location, addressLine1: 'Warehouse 7, MIDC Phase II' },
      website: 'https://example.com',
      supportedTypes: ['WAREHOUSE', 'EQUIPMENT'],
      verificationStatus: 'VERIFIED',
      onboardingCompletedAt: new Date(),
      responseRate: 96,
      averageResponseMinutes: 42,
      totalBookings: 18,
      activeListings: 0,
    });
  }
  if (!(await PartnerProfile.findOne({ user: partner2.id }))) {
    await PartnerProfile.create({
      user: partner2.id,
      businessName: 'Krishnan Equipment Hire (Demo)',
      businessType: 'SOLE_PROPRIETORSHIP',
      description: '[DEMO] Equipment rental and on-site logistics support.',
      address: { ...location, addressLine1: 'Unit 12, Logistics Park' },
      supportedTypes: ['EQUIPMENT', 'SERVICE'],
      verificationStatus: 'SUBMITTED',
      onboardingCompletedAt: new Date(),
    });
    await BusinessVerification.create({
      partner: (await PartnerProfile.findOne({ user: partner2.id }))!._id,
      status: 'SUBMITTED',
      legalBusinessName: 'Krishnan Equipment Hire (Demo)',
      businessType: 'SOLE_PROPRIETORSHIP',
      gstNumber: '22AAAAA0000A1Z5',
      panNumber: 'AAAAA0000A',
      address: { ...location, addressLine1: 'Unit 12, Logistics Park' },
      documents: [
        {
          label: 'GST Registration (demo)',
          url: 'https://example.com/demo-gst.pdf',
          status: 'UPLOADED',
          uploadedAt: new Date(),
          rejectionReason: null,
        },
      ],
      submittedAt: new Date(),
    });
  }
  if (!(await CustomerProfile.findOne({ user: customer.id }))) {
    await CustomerProfile.create({
      user: customer.id,
      companyName: 'Shah Retail Pvt Ltd (Demo)',
      businessType: 'RETAIL',
      address: { ...location, addressLine1: 'Linking Road 18' },
    });
  }

  // --- Categories ---------------------------------------------------------
  const warehouseCat = await upsertCategory({
    name: 'General Warehousing',
    slug: 'general-warehousing',
    type: 'WAREHOUSE',
    description: '[DEMO] Ambient storage space by the pallet or square foot.',
    sortOrder: 1,
  });
  const coldCat = await upsertCategory({
    name: 'Cold Storage',
    slug: 'cold-storage',
    type: 'WAREHOUSE',
    description: '[DEMO] Temperature-controlled storage for perishables.',
    sortOrder: 2,
  });
  const equipmentCat = await upsertCategory({
    name: 'Material Handling Equipment',
    slug: 'material-handling-equipment',
    type: 'EQUIPMENT',
    description: '[DEMO] Forklifts, pallet jacks and dock equipment on hire.',
    sortOrder: 3,
  });
  const serviceCat = await upsertCategory({
    name: 'Loading & Unloading',
    slug: 'loading-unloading',
    type: 'SERVICE',
    description: '[DEMO] Trained crews for truck and container handling.',
    sortOrder: 4,
  });

  // --- Listings -----------------------------------------------------------
  const listings: Record<string, string> = {};

  listings.puneGeneral = await upsertListing(partner1.id, {
    slug: 'pune-general-warehouse-midc',
    input: {
      type: 'WAREHOUSE',
      slug: 'pune-general-warehouse-midc',
      title: 'Pune general warehouse with 4 loading docks',
      description:
        '[DEMO] 22,000 sq ft covered warehouse in MIDC Hinjewadi with four docks, 24x7 security, racking and forklift access. Ideal for FMCG and e-commerce overflow storage in Pune.',
      categoryId: warehouseCat,
      location: { ...location, addressLine1: 'Plot 42, MIDC Hinjewadi' },
      price: { model: 'PER_DAY', amount: 1450, currency: 'INR', period: 'DAY', additionalCharges: [] },
      images: [
        svgImage('Pune General Warehouse', '#0f766e', '#134e4a'),
        svgImage('Loading Docks', '#1d4ed8', '#1e3a8a'),
      ],
      amenities: ['Forklift access', 'Racking', 'Power outlets', '24x7 security', 'Restroom'],
      safetyFeatures: ['CCTV', 'Fire extinguishers', 'Smoke detectors'],
      rules: ['No hazardous materials', 'Business use only', 'Insurance required'],
      cancellationTerms: {
        policy: 'MODERATE',
        description: 'Free cancellation up to 48 hours before the start date.',
        customerRefundPercent: 100,
      },
      warehouse: {
        facilityType: 'DISTRIBUTION',
        storageTypes: ['GENERAL'],
        totalCapacity: 480,
        capacityUnit: 'PALLET',
        loadingDocks: 4,
        driveways: 2,
        temperatureControlled: false,
        humidityControlled: false,
        powerBackup: true,
        fireSafety: true,
        cctv: true,
        certifications: ['ISO 9001'],
        operatingHours: '24x7',
      },
    } as ListingInput,
  });

  listings.nashikCold = await upsertListing(partner1.id, {
    slug: 'nashik-cold-storage-farm-gate',
    input: {
      type: 'WAREHOUSE',
      slug: 'nashik-cold-storage-farm-gate',
      title: 'Nashik farm-gate cold storage facility',
      description:
        '[DEMO] 2 to 8 degree Celsius cold rooms with generator backup near Nashik produce market. Segregated chambers for grapes, onions and dairy with humidity control.',
      categoryId: coldCat,
      location: { ...location, addressLine1: 'Survey 18, Nashik Road', city: 'Nashik', postalCode: '422101', coordinates: { lat: 19.9975, lng: 73.7898 } },
      price: { model: 'PER_DAY', amount: 2200, currency: 'INR', period: 'DAY', additionalCharges: [{ label: 'Power surcharge', amount: 120, taxable: true }] },
      images: [svgImage('Nashik Cold Storage', '#0e7490', '#164e63')],
      amenities: ['Temperature control', 'Generator backup', 'Humidity control'],
      safetyFeatures: ['CCTV', 'Fire sprinklers'],
      rules: ['Pre-chilled goods only', 'No dry goods in cold rooms'],
      cancellationTerms: {
        policy: 'STRICT',
        description: 'Cold room slots are reserved on confirmation; refunds only for facility faults.',
        customerRefundPercent: 50,
      },
      warehouse: {
        facilityType: 'COLD_STORAGE',
        storageTypes: ['COLD'],
        totalCapacity: 160,
        capacityUnit: 'PALLET',
        temperatureControlled: true,
        humidityControlled: true,
        powerBackup: true,
        fireSafety: true,
        cctv: true,
        loadingDocks: 2,
        driveways: 1,
        certifications: ['FSSAI (demo)'],
        operatingHours: '06:00 - 22:00',
      },
    } as ListingInput,
  });

  listings.forklifts = await upsertListing(partner1.id, {
    slug: 'electric-forklift-hire-pune',
    input: {
      type: 'EQUIPMENT',
      slug: 'electric-forklift-hire-pune',
      title: 'Electric forklift hire with operator option',
      description:
        '[DEMO] 2.5 tonne electric forklifts available daily in Pune with battery swaps included. Operator add-on available for warehouse fit-outs and stock transfers.',
      categoryId: equipmentCat,
      location: { ...location, addressLine1: 'Warehouse 7, MIDC Phase II' },
      price: { model: 'PER_DAY', amount: 1800, currency: 'INR', period: 'DAY', additionalCharges: [] },
      images: [svgImage('Electric Forklift', '#b45309', '#7c2d12')],
      amenities: ['Battery swap included', 'Delivery within 25 km'],
      safetyFeatures: ['Operator helmet', 'Tip-over protection'],
      rules: ['Certified operators only', 'Damage waiver optional'],
      cancellationTerms: {
        policy: 'MODERATE',
        description: 'Free cancellation up to 24 hours before dispatch.',
        customerRefundPercent: 100,
      },
      equipment: {
        equipmentCategory: 'FORKLIFT',
        brand: 'DemoLift',
        model: 'E25',
        manufactureYear: 2023,
        quantity: 4,
        rentalPeriod: 'DAY',
        deliveryAvailable: true,
        operatorAvailable: true,
        operatorChargePerDay: 900,
        minRentalDuration: 1,
        specifications: { 'Load capacity': '2.5 t', Fuel: 'Electric' },
      },
    } as ListingInput,
  });

  listings.crew = await upsertListing(partner2.id, {
    slug: 'loading-unloading-crew-pune',
    input: {
      type: 'SERVICE',
      slug: 'loading-unloading-crew-pune',
      title: 'Truck loading and unloading crew in Pune',
      description:
        '[DEMO] Trained 4-person crews for container and truck handling, pallet wrapping and stock putting-away. Same-day booking available across Pune industrial belts.',
      categoryId: serviceCat,
      location: { ...location, addressLine1: 'Unit 12, Logistics Park' },
      price: { model: 'PER_DAY', amount: 2600, currency: 'INR', period: 'DAY', additionalCharges: [{ label: 'Overtime (per hr)', amount: 250, taxable: true }] },
      images: [svgImage('Loading Crew', '#7c3aed', '#4c1d95')],
      amenities: ['Same-day booking', 'PPE included'],
      safetyFeatures: ['Safety boots', 'Gloves', 'Hi-vis vests'],
      rules: ['Maximum 10 hours per shift', 'Site induction required'],
      cancellationTerms: {
        policy: 'FLEXIBLE',
        description: 'Cancel up to 12 hours before the shift for a full refund.',
        customerRefundPercent: 100,
      },
      service: {
        serviceType: 'LOADING_UNLOADING',
        serviceAreas: ['Pune', 'Chakan', 'Hinjewadi'],
        teamSize: 4,
        estimatedDurationHours: 6,
        dailyCapacity: 40,
      },
    } as ListingInput,
  });

  logger.info('listings ready', listings);

  // --- Availability rules -------------------------------------------------
  try {
    await addAvailabilityRule(partner1.id, {
      listingId: listings.puneGeneral,
      daysOfWeek: [1, 2, 3, 4, 5, 6],
      startTime: '08:00',
      endTime: '20:00',
      startDate: null,
      endDate: null,
    });
  } catch (err) {
    logger.warn('availability rule skipped (likely already seeded)', {
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // --- Bookings -----------------------------------------------------------
  const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const farDate = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);

  let pendingBooking: { id: string } | null;
  if (!(await Booking.exists({ notes: 'DEMO booking #1 - awaiting partner approval' }))) {
    const booking = await createBookingRequest(customer.id, {
      listingId: listings.puneGeneral,
      startDate,
      endDate: new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000),
      quantity: 1,
      deliveryRequired: false,
      operatorRequired: false,
      notes: 'DEMO booking #1 - awaiting partner approval',
    } as never);
    pendingBooking = { id: String(booking._id) };
  } else {
    const existing = await Booking.findOne({ notes: 'DEMO booking #1 - awaiting partner approval' })
      .select('_id')
      .lean();
    pendingBooking = existing ? { id: String(existing._id) } : null;
  }
  logger.info('pending booking', pendingBooking ?? undefined);

  // Booking #2: accepted + paid (CONFIRMED)
  let confirmedId: string | null;
  const confirmedExisting = await Booking.findOne({ notes: 'DEMO booking #2 - confirmed and paid' })
    .select('_id')
    .lean();
  if (confirmedExisting) {
    confirmedId = String(confirmedExisting._id);
  } else {
    const booking = await createBookingRequest(customer.id, {
      listingId: listings.nashikCold,
      startDate: farDate,
      endDate: new Date(farDate.getTime() + 5 * 24 * 60 * 60 * 1000),
      quantity: 1,
      deliveryRequired: false,
      operatorRequired: false,
      notes: 'DEMO booking #2 - confirmed and paid',
    } as never);
    confirmedId = String(booking._id);
    await acceptBooking(confirmedId, { userId: partner1.id, role: 'PARTNER' });
    const { payment } = await initiatePayment(customer.id, confirmedId);
    await simulateGatewayResult(String(payment._id), 'SUCCESS');
  }
  logger.info('confirmed booking', { id: confirmedId });

  // Booking #3: completed + reviewed
  let completedId: string | null;
  const completedExisting = await Booking.findOne({ notes: 'DEMO booking #3 - completed with review' })
    .select('_id review')
    .lean();
  if (completedExisting) {
    completedId = String(completedExisting._id);
  } else {
    const booking = await createBookingRequest(customer.id, {
      listingId: listings.forklifts,
      startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      quantity: 2,
      deliveryRequired: true,
      operatorRequired: true,
      notes: 'DEMO booking #3 - completed with review',
    } as never);
    completedId = String(booking._id);
    await acceptBooking(completedId, { userId: partner1.id, role: 'PARTNER' });
    const { payment } = await initiatePayment(customer.id, completedId);
    await simulateGatewayResult(String(payment._id), 'SUCCESS');
    await transitionBooking(completedId, 'COMPLETED', { userId: partner1.id, role: 'PARTNER' }, {
      note: 'DEMO: work finished',
    });
    await createReview(customer.id, {
      bookingId: completedId,
      rating: 5,
      comment: '[DEMO] Spotless forklifts and the operator arrived early. Highly recommended.',
    });
  }
  logger.info('completed booking', { id: completedId });

  // --- Messaging ----------------------------------------------------------
  const conversationExists = await Booking.exists({ _id: new Types.ObjectId(completedId!) });
  if (conversationExists) {
    try {
      await createConversation(customer.id, 'CUSTOMER', {
        listingId: listings.puneGeneral,
        subject: 'DEMO question about dock timings',
        body: 'Hello! Do your docks operate past 8pm for inbound trucks?',
      });
    } catch (err) {
      logger.warn('conversation skipped', { err: err instanceof Error ? err.message : String(err) });
    }
  }

  const counts = {
    users: await User.countDocuments(),
    categories: await Category.countDocuments(),
    listings: await Listing.countDocuments(),
    bookings: await Booking.countDocuments(),
  };
  logger.info('Seed complete', counts);
  logger.info(
    `Demo logins (password ${DEMO_PASSWORD}): admin@${DEMO_DOMAIN}, partner@${DEMO_DOMAIN}, partner2@${DEMO_DOMAIN}, customer@${DEMO_DOMAIN}`,
  );

  await disconnectDatabase();
}

void main().catch(async (err) => {
  logger.error('Seed failed', { err: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined });
  await disconnectDatabase().catch(() => undefined);
  process.exitCode = 1;
});
