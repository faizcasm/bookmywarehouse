import type {
  AdditionalChargeDTO,
  AvailabilityExceptionDTO,
  AvailabilityRuleDTO,
  CancellationTermDTO,
  Currency,
  EquipmentDetailsDTO,
  FacilityType,
  ListingDetailDTO,
  ListingPriceDTO,
  ListingSummaryDTO,
  ListingType,
  LocationDTO,
  PartnerListingSummaryDTO,
  PricingModel,
  PricingPeriod,
  RatingSummaryDTO,
  ServiceDetailsDTO,
  WarehouseDetailsDTO,
} from '@bmw/shared-types';
import type { ListingFields, LocationFields, PriceFields } from '../models/index.js';
import type {
  AvailabilityExceptionFields,
  AvailabilityRuleFields,
  EquipmentDetailsFields,
  ServiceDetailsFields,
  WarehouseDetailsFields,
} from '../models/index.js';

export function serializeLocation(location: LocationFields): LocationDTO {
  return {
    addressLine1: location.addressLine1,
    addressLine2: location.addressLine2 ?? null,
    landmark: location.landmark ?? null,
    city: location.city,
    state: location.state,
    postalCode: location.postalCode,
    country: location.country,
    region: location.region ?? null,
    coordinates:
      location.coordinates && location.coordinates.lat != null && location.coordinates.lng != null
        ? { lat: location.coordinates.lat, lng: location.coordinates.lng }
        : null,
    serviceRadiusKm: location.serviceRadiusKm ?? null,
  };
}

function serializeCharges(
  charges: PriceFields['additionalCharges'] = [],
): AdditionalChargeDTO[] {
  return charges.map((charge) => ({
    label: charge.label,
    amount: charge.amount,
    taxable: charge.taxable,
  }));
}

export function serializePrice(price: PriceFields): ListingPriceDTO {
  return {
    model: price.model as PricingModel,
    amount: price.amountMinor,
    currency: (price.currency ?? 'INR') as Currency,
    period: (price.period ?? null) as PricingPeriod | null,
    unitLabel: price.unitLabel ?? null,
    minQuantity: price.minQuantity ?? null,
    additionalCharges: serializeCharges(price.additionalCharges),
  };
}

export function serializeCancellationTerms(
  terms: ListingFields['cancellationTerms'],
): CancellationTermDTO {
  return {
    policy: terms.policy,
    description: terms.description,
    customerRefundPercent: terms.customerRefundPercent,
    note: terms.note ?? null,
  };
}

export interface PartnerSummaryInput {
  userId: string;
  businessName: string;
  logoUrl?: string | null;
  verificationStatus: string;
  responseRate?: number | null;
  joinedAt?: Date | string | null;
  rating?: RatingSummaryDTO;
}

export function serializePartnerSummary(input: PartnerSummaryInput): PartnerListingSummaryDTO {
  return {
    id: input.userId,
    businessName: input.businessName,
    verified: input.verificationStatus === 'VERIFIED',
    logoUrl: input.logoUrl ?? null,
    rating: input.rating ?? { average: 0, count: 0 },
    responseRate: input.responseRate ?? null,
    joinedAt: input.joinedAt ? new Date(input.joinedAt).toISOString() : new Date(0).toISOString(),
  };
}

export interface ListingSummaryOptions {
  partner: PartnerSummaryInput;
  categoryName?: string | null;
  isFavorite?: boolean;
  totalCapacity?: number | null;
  capacityUnit?: string | null;
}

export function serializeListingSummary(
  listing: ListingFields & { _id: unknown },
  options: ListingSummaryOptions,
): ListingSummaryDTO {
  const price = serializePrice(listing.price);
  return {
    id: String(listing._id),
    type: listing.type as ListingType,
    title: listing.title,
    slug: listing.slug,
    status: listing.status,
    categoryId: listing.category ? String(listing.category) : null,
    categoryName: options.categoryName ?? null,
    location: serializeLocation(listing.location),
    city: listing.location.city,
    state: listing.location.state,
    price,
    totalCapacity: options.totalCapacity ?? null,
    capacityUnit: (options.capacityUnit ?? null) as ListingSummaryDTO['capacityUnit'],
    rating: {
      average: Number(listing.rating?.average ?? 0),
      count: Number(listing.rating?.count ?? 0),
    },
    coverImage: listing.images[0] ?? null,
    images: listing.images,
    partner: serializePartnerSummary(options.partner),
    availableFrom: listing.availableFrom ? new Date(listing.availableFrom).toISOString() : null,
    isFavorite: options.isFavorite ?? false,
    createdAt: new Date(listing.createdAt).toISOString(),
    publishedAt: listing.publishedAt ? new Date(listing.publishedAt).toISOString() : null,
  };
}

export function serializeWarehouseDetails(details: WarehouseDetailsFields): WarehouseDetailsDTO {
  return {
    facilityType: details.facilityType as FacilityType,
    storageTypes: details.storageTypes,
    totalCapacity: details.totalCapacity,
    capacityUnit: details.capacityUnit,
    numberOfUnits: details.numberOfUnits ?? null,
    unitDimensions: details.unitDimensions ?? null,
    ceilingHeightM: details.ceilingHeightM ?? null,
    floorLoadCapacityKg: details.floorLoadCapacityKg ?? null,
    loadingDocks: details.loadingDocks,
    driveways: details.driveways,
    temperatureControlled: details.temperatureControlled,
    humidityControlled: details.humidityControlled,
    powerBackup: details.powerBackup,
    fireSafety: details.fireSafety,
    cctv: details.cctv,
    certifications: details.certifications,
    operatingHours: details.operatingHours ?? null,
  };
}

export function serializeEquipmentDetails(details: EquipmentDetailsFields): EquipmentDetailsDTO {
  return {
    equipmentCategory: details.equipmentCategory,
    brand: details.brand ?? null,
    model: details.model ?? null,
    manufactureYear: details.manufactureYear ?? null,
    quantity: details.quantity,
    rentalPeriod: details.rentalPeriod,
    deliveryAvailable: details.deliveryAvailable,
    operatorAvailable: details.operatorAvailable,
    operatorChargePerDay: details.operatorChargePerDayMinor ?? null,
    minRentalDuration: details.minRentalDuration ?? null,
    specifications: details.specifications ?? {},
  };
}

export function serializeServiceDetails(details: ServiceDetailsFields): ServiceDetailsDTO {
  return {
    serviceType: details.serviceType,
    serviceAreas: details.serviceAreas,
    estimatedDurationHours: details.estimatedDurationHours ?? null,
    teamSize: details.teamSize ?? null,
    dailyCapacity: details.dailyCapacity ?? null,
    requirements: details.requirements ?? null,
  };
}

export function serializeAvailabilityRule(rule: AvailabilityRuleFields): AvailabilityRuleDTO {
  return {
    id: String(rule._id),
    daysOfWeek: rule.daysOfWeek,
    startTime: rule.startTime,
    endTime: rule.endTime,
    startDate: rule.startDate ? new Date(rule.startDate).toISOString() : null,
    endDate: rule.endDate ? new Date(rule.endDate).toISOString() : null,
  };
}

export function serializeAvailabilityException(
  exception: AvailabilityExceptionFields,
): AvailabilityExceptionDTO {
  return {
    id: String(exception._id),
    date: new Date(exception.date).toISOString(),
    reason: exception.reason ?? null,
    isAvailable: exception.isAvailable,
  };
}

export interface ListingDetailOptions extends ListingSummaryOptions {
  warehouse?: WarehouseDetailsFields | null;
  equipment?: EquipmentDetailsFields | null;
  service?: ServiceDetailsFields | null;
  availabilityRules?: AvailabilityRuleFields[];
  blockedDates?: AvailabilityExceptionFields[];
  related?: ListingSummaryDTO[];
  availableFrom?: Date | string | null;
  canRequestBooking: boolean;
}

export function serializeListingDetail(
  listing: ListingFields & { _id: unknown },
  options: ListingDetailOptions,
): ListingDetailDTO {
  const summary = serializeListingSummary(listing, options);
  const totalCapacity =
    options.totalCapacity ??
    options.warehouse?.totalCapacity ??
    (options.equipment ? options.equipment.quantity : null) ??
    null;
  const capacityUnit = (options.capacityUnit ??
    (options.warehouse ? options.warehouse.capacityUnit : null)) as ListingDetailDTO['capacityUnit'];
  return {
    ...summary,
    totalCapacity,
    capacityUnit,
    description: listing.description,
    amenities: listing.amenities,
    safetyFeatures: listing.safetyFeatures,
    rules: listing.rules,
    minBookingDuration: listing.minBookingDuration ?? null,
    cancellationTerms: serializeCancellationTerms(listing.cancellationTerms),
    warehouse: options.warehouse ? serializeWarehouseDetails(options.warehouse) : null,
    equipment: options.equipment ? serializeEquipmentDetails(options.equipment) : null,
    service: options.service ? serializeServiceDetails(options.service) : null,
    availabilityRules: (options.availabilityRules ?? []).map(serializeAvailabilityRule),
    blockedDates: (options.blockedDates ?? []).map(serializeAvailabilityException),
    availableFrom: options.availableFrom
      ? new Date(options.availableFrom).toISOString()
      : summary.availableFrom,
    canRequestBooking: options.canRequestBooking,
    related: options.related ?? [],
  };
}
