import { Types } from 'mongoose';
import type { CreateListingInput, UpdateListingInput } from '@bmw/validation';
import type {
  ListingSort,
  ListingSummaryDTO,
  ListingType,
  ListingStatus,
} from '@bmw/shared-types';
import { toMinorUnits } from '@bmw/shared-types';
import { errors } from '../lib/errors.js';
import { slugify } from '../lib/ids.js';
import {
  AvailabilityException,
  AvailabilityRule,
  Booking,
  Category,
  EquipmentDetails,
  Favorite,
  Listing,
  PartnerProfile,
  ServiceDetails,
  WarehouseDetails,
  type AvailabilityExceptionFields,
  type AvailabilityRuleFields,
  type EquipmentDetailsFields,
  type ListingFields,
  type ListingDocument,
  type PartnerProfileFields,
  type ServiceDetailsFields,
  type WarehouseDetailsFields,
} from '../models/index.js';
import {
  serializeListingDetail,
  serializeListingSummary,
  type PartnerSummaryInput,
} from '../serializers/listing.serializer.js';
import { getSettings } from './settings.service.js';
import { checkCapacity, checkDateRange, getListingAvailability } from './availability.service.js';
import { BLOCKING_BOOKING_STATUSES } from '../models/listing.model.js';

export type ListingLean = ListingFields & { _id: Types.ObjectId };

export async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || 'listing';
  let candidate = root;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const clash = await Listing.findOne({
      slug: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
      .select('_id')
      .lean();
    if (!clash) return candidate;
    candidate = `${root}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

async function partnerProfileFor(userId: string): Promise<PartnerProfileFields & { _id: Types.ObjectId }> {
  const profile = await PartnerProfile.findOne({ user: userId });
  if (!profile) {
    throw errors.forbidden('Complete partner onboarding before managing listings');
  }
  return profile as unknown as PartnerProfileFields & { _id: Types.ObjectId };
}

export async function partnerSummariesFor(
  userIds: string[],
): Promise<Map<string, PartnerSummaryInput>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const profiles = await PartnerProfile.find({ user: { $in: ids } }).lean();
  const map = new Map<string, PartnerSummaryInput>();
  for (const profile of profiles) {
    map.set(String(profile.user), {
      userId: String(profile.user),
      businessName: profile.businessName,
      logoUrl: profile.logoUrl ?? null,
      verificationStatus: profile.verificationStatus,
      responseRate: profile.responseRate ?? null,
      joinedAt: profile.createdAt,
    });
  }
  // Partners without a profile still render with a fallback label.
  for (const id of ids) {
    if (!map.has(id)) {
      map.set(id, {
        userId: id,
        businessName: 'Warehouse partner',
        verificationStatus: 'DRAFT',
      });
    }
  }
  return map;
}

export async function categoryNamesFor(categoryIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(categoryIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const categories = await Category.find({ _id: { $in: ids } })
    .select('name')
    .lean();
  return new Map(categories.map((c) => [String(c._id), c.name]));
}

export interface SummaryEnrichment {
  viewerId?: string | null;
}

/** Batch-enriches a page of listings with partner, category, capacity and favorite data. */
export async function serializeListingPage(
  listings: ListingLean[],
  options: SummaryEnrichment = {},
): Promise<ListingSummaryDTO[]> {
  if (listings.length === 0) return [];
  const partnerMap = await partnerSummariesFor(listings.map((l) => String(l.partner)));
  const categoryMap = await categoryNamesFor(listings.map((l) => (l.category ? String(l.category) : '')));

  const warehouseIds = listings.filter((l) => l.warehouse).map((l) => l.warehouse!);
  const equipmentIds = listings.filter((l) => l.equipment).map((l) => l.equipment!);
  const [warehouses, equipment, favorites] = await Promise.all([
    warehouseIds.length
      ? WarehouseDetails.find({ _id: { $in: warehouseIds } })
          .select('totalCapacity capacityUnit')
          .lean()
      : Promise.resolve([]),
    equipmentIds.length
      ? EquipmentDetails.find({ _id: { $in: equipmentIds } }).select('quantity').lean()
      : Promise.resolve([]),
    options.viewerId
      ? Favorite.find({ user: options.viewerId, listing: { $in: listings.map((l) => l._id) } })
          .select('listing')
          .lean()
      : Promise.resolve([]),
  ]);

  const warehouseMap = new Map(warehouses.map((w) => [String(w._id), w]));
  const equipmentMap = new Map(equipment.map((e) => [String(e._id), e]));
  const favoriteSet = new Set(favorites.map((f) => String(f.listing)));

  return listings.map((listing) => {
    const warehouse = listing.warehouse ? warehouseMap.get(String(listing.warehouse)) : undefined;
    const equipmentItem = listing.equipment ? equipmentMap.get(String(listing.equipment)) : undefined;
    return serializeListingSummary(listing, {
      partner: partnerMap.get(String(listing.partner)) ?? {
        userId: String(listing.partner),
        businessName: 'Warehouse partner',
        verificationStatus: 'DRAFT',
      },
      categoryName: listing.category ? (categoryMap.get(String(listing.category)) ?? null) : null,
      isFavorite: favoriteSet.has(String(listing._id)),
      totalCapacity: warehouse?.totalCapacity ?? equipmentItem?.quantity ?? null,
      capacityUnit: warehouse?.capacityUnit ?? null,
    });
  });
}

export async function createListing(
  partnerUserId: string,
  input: CreateListingInput,
): Promise<ListingDocument> {
  await partnerProfileFor(partnerUserId);
  const category = await Category.findById(input.categoryId).lean();
  if (!category || !category.isActive) throw errors.badRequest('Selected category is not available');
  if (category.type !== input.type) {
    throw errors.badRequest('Category does not match the listing type');
  }

  const slug = await uniqueSlug(input.slug ?? input.title);
  const listing = await Listing.create({
    type: input.type,
    title: input.title,
    slug,
    description: input.description,
    partner: new Types.ObjectId(partnerUserId),
    category: category._id,
    status: 'DRAFT',
    location: normalizeLocation(input.location),
    geo: geoFromLocation(input.location),
    price: normalizePrice(input.price),
    images: input.images,
    amenities: input.amenities,
    safetyFeatures: input.safetyFeatures,
    rules: input.rules,
    minBookingDuration: input.minBookingDuration ?? null,
    cancellationTerms: {
      policy: input.cancellationTerms.policy,
      description: input.cancellationTerms.description,
      customerRefundPercent: input.cancellationTerms.customerRefundPercent,
      note: input.cancellationTerms.note ?? null,
    },
    availableFrom: input.availableFrom ?? null,
  });

  if (input.type === 'WAREHOUSE' && input.warehouse) {
    const details = await WarehouseDetails.create({
      listing: listing._id,
      ...input.warehouse,
    });
    listing.warehouse = details._id;
    listing.capacitySort = input.warehouse.totalCapacity;
  }
  if (input.type === 'EQUIPMENT' && input.equipment) {
    const details = await EquipmentDetails.create({
      listing: listing._id,
      ...input.equipment,
      operatorChargePerDayMinor:
        input.equipment.operatorChargePerDay != null
          ? toMinorUnits(input.equipment.operatorChargePerDay)
          : null,
    });
    listing.equipment = details._id;
    listing.capacitySort = input.equipment.quantity;
  }
  if (input.type === 'SERVICE' && input.service) {
    const details = await ServiceDetails.create({ listing: listing._id, ...input.service });
    listing.service = details._id;
  }
  await listing.save();
  return listing;
}

export function normalizeLocation(input: {
  addressLine1: string;
  addressLine2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  region?: string | null;
  coordinates?: { lat: number; lng: number } | null;
  serviceRadiusKm?: number | null;
}): ListingFields['location'] {
  return {
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2 ?? null,
    landmark: input.landmark ?? null,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    country: input.country ?? 'India',
    region: input.region ?? null,
    coordinates: { lat: input.coordinates?.lat ?? null, lng: input.coordinates?.lng ?? null },
    serviceRadiusKm: input.serviceRadiusKm ?? null,
  };
}

function geoFromLocation(input: {
  coordinates?: { lat: number; lng: number } | null;
}): ListingFields['geo'] {
  if (!input.coordinates) return null;
  return { type: 'Point', coordinates: [input.coordinates.lng, input.coordinates.lat] };
}

function normalizePrice(input: {
  model: ListingFields['price']['model'];
  amount: number;
  currency?: string;
  period?: ListingFields['price']['period'];
  unitLabel?: string | null;
  minQuantity?: number | null;
  additionalCharges?: { label: string; amount: number; taxable: boolean }[];
}): ListingFields['price'] {
  return {
    model: input.model,
    amountMinor: toMinorUnits(input.amount, (input.currency ?? 'INR') as 'INR'),
    currency: (input.currency ?? 'INR').toUpperCase(),
    period: input.period ?? null,
    unitLabel: input.unitLabel ?? null,
    minQuantity: input.minQuantity ?? null,
    additionalCharges: (input.additionalCharges ?? []).map((charge) => ({
      label: charge.label,
      amount: toMinorUnits(charge.amount, (input.currency ?? 'INR') as 'INR'),
      taxable: charge.taxable ?? true,
    })),
  };
}

export async function requireOwnListing(partnerUserId: string, listingId: string): Promise<ListingDocument> {
  if (!Types.ObjectId.isValid(listingId)) throw errors.notFound('Listing not found');
  const listing = await Listing.findOne({ _id: listingId, deletedAt: null });
  if (!listing) throw errors.notFound('Listing not found');
  if (String(listing.partner) !== partnerUserId) {
    throw errors.forbidden('You can only manage your own listings');
  }
  return listing;
}

export async function updateListing(
  partnerUserId: string,
  listingId: string,
  input: UpdateListingInput,
): Promise<ListingDocument> {
  const listing = await requireOwnListing(partnerUserId, listingId);

  if (input.categoryId) {
    const category = await Category.findById(input.categoryId).lean();
    if (!category || !category.isActive) throw errors.badRequest('Category is not available');
    listing.category = category._id;
  }
  if (input.title) listing.title = input.title;
  if (input.description) listing.description = input.description;
  if (input.location) {
    listing.location = normalizeLocation(input.location);
    listing.geo = geoFromLocation(input.location);
  }
  if (input.price) listing.price = normalizePrice(input.price);
  if (input.images) listing.images = input.images;
  if (input.amenities) listing.amenities = input.amenities;
  if (input.safetyFeatures) listing.safetyFeatures = input.safetyFeatures;
  if (input.rules) listing.rules = input.rules;
  if (input.minBookingDuration !== undefined) listing.minBookingDuration = input.minBookingDuration;
  if (input.cancellationTerms) {
    listing.cancellationTerms = {
      policy: input.cancellationTerms.policy,
      description: input.cancellationTerms.description,
      customerRefundPercent: input.cancellationTerms.customerRefundPercent,
      note: input.cancellationTerms.note ?? null,
    };
  }
  if (input.availableFrom !== undefined) listing.availableFrom = input.availableFrom ?? null;

  // Editing a published listing sends it back for re-review when details change.
  if (listing.status === 'PUBLISHED' && (input.price || input.location || input.description)) {
    listing.status = 'PENDING_REVIEW';
    listing.submittedAt = new Date();
  }

  if (listing.type === 'WAREHOUSE' && input.warehouse) {
    const updated = await WarehouseDetails.findOneAndUpdate(
      { listing: listing._id },
      { $set: input.warehouse },
      { upsert: true, new: true },
    ).lean();
    if (updated) listing.capacitySort = updated.totalCapacity;
  }
  if (listing.type === 'EQUIPMENT' && input.equipment) {
    const updated = await EquipmentDetails.findOneAndUpdate(
      { listing: listing._id },
      {
        $set: {
          ...input.equipment,
          operatorChargePerDayMinor:
            input.equipment.operatorChargePerDay != null
              ? toMinorUnits(input.equipment.operatorChargePerDay)
              : null,
        },
      },
      { upsert: true, new: true },
    ).lean();
    if (updated) listing.capacitySort = updated.quantity;
  }
  if (listing.type === 'SERVICE' && input.service) {
    await ServiceDetails.updateOne({ listing: listing._id }, { $set: input.service }, { upsert: true });
  }

  await listing.save();
  return listing;
}

export interface PublicationCheck {
  canPublish: boolean;
  reasons: string[];
}

export function publicationCheck(
  listing: ListingFields,
  partner: PartnerProfileFields,
  settings: { requirePartnerVerification: boolean },
): PublicationCheck {
  const reasons: string[] = [];
  if (listing.images.length === 0) reasons.push('Add at least one listing image');
  if (listing.price.amountMinor <= 0) reasons.push('Set a valid price');
  if (listing.description.trim().length < 40) reasons.push('Description is too short');
  if (!listing.category) reasons.push('Assign a category');
  if (
    settings.requirePartnerVerification &&
    partner.verificationStatus !== 'VERIFIED' &&
    listing.status === 'PENDING_REVIEW'
  ) {
    reasons.push('Partner verification is required before this listing can be reviewed');
  }
  return { canPublish: reasons.length === 0, reasons };
}

export async function publishListing(
  partnerUserId: string,
  listingId: string,
): Promise<{ listing: ListingDocument; status: ListingStatus }> {
  const listing = await requireOwnListing(partnerUserId, listingId);
  const partner = await partnerProfileFor(partnerUserId);
  const settings = await getSettings();

  if (listing.status === 'PUBLISHED') {
    throw errors.conflict('Listing is already published');
  }
  if (listing.status === 'ARCHIVED') {
    throw errors.precondition('Restore the listing before publishing it');
  }
  if (settings.requirePartnerVerification && partner.verificationStatus !== 'VERIFIED') {
    throw errors.forbidden(
      'Your business must be verified by an administrator before listings can go live',
    );
  }

  const check = publicationCheck(listing, partner, settings);
  if (!check.canPublish) {
    throw errors.precondition(check.reasons.join('. '));
  }

  listing.status = 'PENDING_REVIEW';
  listing.submittedAt = new Date();
  listing.moderationReason = null;
  await listing.save();
  return { listing, status: listing.status };
}

export async function unpublishListing(
  partnerUserId: string,
  listingId: string,
): Promise<ListingDocument> {
  const listing = await requireOwnListing(partnerUserId, listingId);
  if (listing.status !== 'PUBLISHED') throw errors.precondition('Listing is not published');
  listing.status = 'UNPUBLISHED';
  await listing.save();
  return listing;
}

export async function archiveListing(partnerUserId: string, listingId: string): Promise<ListingDocument> {
  const listing = await requireOwnListing(partnerUserId, listingId);
  const activeBookings = await activeBookingCount(listing._id);
  if (activeBookings > 0) {
    throw errors.precondition('Wait for active bookings to finish before archiving this listing');
  }
  listing.status = 'ARCHIVED';
  listing.archivedAt = new Date();
  await listing.save();
  return listing;
}

async function activeBookingCount(listingId: Types.ObjectId): Promise<number> {
  return Booking.countDocuments({
    listing: listingId,
    status: { $in: [...BLOCKING_BOOKING_STATUSES, 'COMPLETED'] },
  });
}

export async function softDeleteListing(partnerUserId: string, listingId: string): Promise<void> {
  const listing = await requireOwnListing(partnerUserId, listingId);
  const active = await Booking.countDocuments({
    listing: listing._id,
    status: { $in: [...BLOCKING_BOOKING_STATUSES] },
  });
  if (active > 0) {
    throw errors.precondition('This listing has active bookings and cannot be deleted yet');
  }
  listing.deletedAt = new Date();
  listing.status = 'ARCHIVED';
  await listing.save();
}

export interface ListingDetailResult {
  listing: ListingLean;
  summary: ListingSummaryDTO;
  detail: ReturnType<typeof serializeListingDetail>;
}

export async function getPublicListing(
  slugOrId: string,
  viewerId?: string | null,
): Promise<{ listing: ListingLean; detail: ReturnType<typeof serializeListingDetail> }> {
  return buildListingDetail(slugOrId, viewerId, ['PUBLISHED']);
}

/** Owner-scoped variant used by the partner app (any non-deleted status). */
export async function getPartnerListingDetail(
  listingId: string,
  partnerUserId: string,
): Promise<{ listing: ListingLean; detail: ReturnType<typeof serializeListingDetail> }> {
  const owned = await requireOwnListing(partnerUserId, listingId);
  return buildListingDetail(String(owned._id), partnerUserId, undefined);
}

async function buildListingDetail(
  slugOrId: string,
  viewerId: string | null | undefined,
  statuses: ListingStatus[] | undefined,
): Promise<{ listing: ListingLean; detail: ReturnType<typeof serializeListingDetail> }> {
  const query = Types.ObjectId.isValid(slugOrId)
    ? { $or: [{ _id: new Types.ObjectId(slugOrId) }, { slug: slugOrId }] }
    : { slug: slugOrId };
  const listing = (await Listing.findOne({
    ...query,
    deletedAt: null,
    ...(statuses ? { status: { $in: statuses } } : {}),
  }).lean()) as ListingLean | null;
  if (!listing) throw errors.notFound('Listing not found');

  const [warehouse, equipment, service, availability, relatedRaw] = await Promise.all([
    listing.warehouse ? WarehouseDetails.findById(listing.warehouse).lean() : null,
    listing.equipment ? EquipmentDetails.findById(listing.equipment).lean() : null,
    listing.service ? ServiceDetails.findById(listing.service).lean() : null,
    getListingAvailability(String(listing._id)),
    Listing.find({
      status: 'PUBLISHED',
      type: listing.type,
      _id: { $ne: listing._id },
      ...(listing.category ? { category: listing.category } : {}),
      deletedAt: null,
    })
      .sort({ publishedAt: -1 })
      .limit(4)
      .lean(),
  ]);

  const partnerMap = await partnerSummariesFor([String(listing.partner)]);
  const categoryMap = await categoryNamesFor(
    listing.category ? [String(listing.category)] : [],
  );

  let isFavorite = false;
  if (viewerId) {
    isFavorite = Boolean(
      await Favorite.findOne({ user: viewerId, listing: listing._id }).select('_id').lean(),
    );
  }

  const today = new Date();
  const availableFrom =
    listing.availableFrom && listing.availableFrom > today ? listing.availableFrom : today;
  const dateCheck = checkDateRange(
    availability.rules,
    availability.blockedDates,
    availableFrom,
    null,
  );

  const totalCapacity =
    warehouse?.totalCapacity ?? (equipment ? equipment.quantity : null) ?? null;
  const capacityCheck = await checkCapacity({
    listing,
    startDate: availableFrom,
    endDate: null,
    requestedCapacity: listing.type === 'WAREHOUSE' ? Math.min(1, totalCapacity ?? 1) : null,
    quantity: 1,
    totalCapacity: totalCapacity ?? 0,
    dailyCapacity: service?.dailyCapacity ?? null,
  });

  const canRequestBooking = dateCheck.available && capacityCheck.available;

  const detail = serializeListingDetail(listing, {
    partner: partnerMap.get(String(listing.partner)) ?? {
      userId: String(listing.partner),
      businessName: 'Warehouse partner',
      verificationStatus: 'DRAFT',
    },
    categoryName: listing.category ? (categoryMap.get(String(listing.category)) ?? null) : null,
    isFavorite,
    warehouse: warehouse as WarehouseDetailsFields | null,
    equipment: equipment as EquipmentDetailsFields | null,
    service: service as ServiceDetailsFields | null,
    availabilityRules: availability.rules as AvailabilityRuleFields[],
    blockedDates: availability.blockedDates as AvailabilityExceptionFields[],
    availableFrom,
    canRequestBooking,
    totalCapacity,
    capacityUnit: warehouse?.capacityUnit ?? null,
    related: await serializeListingPage(relatedRaw as ListingLean[], { viewerId }),
  });

  return { listing, detail };
}

export async function incrementViewCount(listingId: Types.ObjectId): Promise<void> {
  await Listing.updateOne({ _id: listingId }, { $inc: { viewCount: 1 } }).exec();
}

export type { ListingType, ListingSort };
export { errors };
