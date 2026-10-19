import type { FilterQuery } from 'mongoose';
import { Types } from 'mongoose';
import type { z } from 'zod';
import type { ListingSort, ListingSummaryDTO, SearchFacetsDTO } from '@bmw/shared-types';
import { toMinorUnits } from '@bmw/shared-types';
import type { listingSearchQuerySchema } from '@bmw/validation';
import {
  Category,
  EquipmentDetails,
  Listing,
  PartnerProfile,
  ServiceDetails,
  WarehouseDetails,
  type EquipmentDetailsFields,
  type ListingFields,
  type WarehouseDetailsFields,
} from '../models/index.js';
import { serializeListingPage, type ListingLean } from './listing.service.js';

export type SearchParams = z.infer<typeof listingSearchQuerySchema>;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function idsFromDetails(
  params: SearchParams,
): Promise<{ warehouseIds?: Types.ObjectId[]; equipmentIds?: Types.ObjectId[]; serviceIds?: Types.ObjectId[] }> {
  const result: Awaited<ReturnType<typeof idsFromDetails>> = {};
  if (params.facilityType || params.storageType || params.capacityMin != null || params.capacityMax != null) {
    const query: FilterQuery<WarehouseDetailsFields> = {};
    if (params.facilityType) query.facilityType = params.facilityType;
    if (params.storageType) query.storageTypes = params.storageType;
    if (params.capacityMin != null || params.capacityMax != null) {
      query.totalCapacity = {
        ...(params.capacityMin != null ? { $gte: params.capacityMin } : {}),
        ...(params.capacityMax != null ? { $lte: params.capacityMax } : {}),
      };
    }
    const docs = await WarehouseDetails.find(query).select('_id').lean();
    result.warehouseIds = docs.map((d) => d._id);
  }
  if (params.equipmentCategory || params.capacityMin != null || params.capacityMax != null) {
    const query: FilterQuery<EquipmentDetailsFields> = {};
    if (params.equipmentCategory) query.equipmentCategory = params.equipmentCategory;
    if (params.capacityMin != null || params.capacityMax != null) {
      query.quantity = {
        ...(params.capacityMin != null ? { $gte: params.capacityMin } : {}),
        ...(params.capacityMax != null ? { $lte: params.capacityMax } : {}),
      };
    }
    const docs = await EquipmentDetails.find(query).select('_id').lean();
    result.equipmentIds = docs.map((d) => d._id);
  }
  if (params.serviceType) {
    const docs = await ServiceDetails.find({ serviceType: params.serviceType })
      .select('_id')
      .lean();
    result.serviceIds = docs.map((d) => d._id);
  }
  return result;
}

export function buildListingFilter(params: SearchParams): FilterQuery<ListingFields> {
  const filter: FilterQuery<ListingFields> = { status: 'PUBLISHED', deletedAt: null };
  if (params.type) filter.type = params.type;
  if (params.city) filter['location.city'] = new RegExp(`^${escapeRegex(params.city)}$`, 'i');
  if (params.state) filter['location.state'] = new RegExp(`^${escapeRegex(params.state)}$`, 'i');
  if (params.region) filter['location.region'] = new RegExp(escapeRegex(params.region), 'i');
  if (params.categoryId) filter.category = new Types.ObjectId(params.categoryId);
  if (params.minPrice != null || params.maxPrice != null) {
    filter['price.amountMinor'] = {
      ...(params.minPrice != null ? { $gte: toMinorUnits(params.minPrice) } : {}),
      ...(params.maxPrice != null ? { $lte: toMinorUnits(params.maxPrice) } : {}),
    };
  }
  if (params.minRating != null) filter['rating.average'] = { $gte: params.minRating };
  if (params.amenities) {
    const list = params.amenities
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    if (list.length > 0) filter.amenities = { $all: list };
  }
  if (params.availableTo) {
    const until = new Date(params.availableTo);
    filter.$or = [
      { availableFrom: null },
      { availableFrom: { $lte: until } },
      { availableFrom: { $exists: false } },
    ];
  }
  if (params.lat != null && params.lng != null) {
    const radiusKm = params.radiusKm ?? 50;
    filter.geo = {
      $geoWithin: {
        $centerSphere: [
          [params.lng, params.lat],
          radiusKm / 6378.1,
        ],
      },
    };
  }
  return filter;
}

function sortSpec(sort: ListingSort, textSearch: boolean): Record<string, 1 | -1 | { $meta: string }> {
  switch (sort) {
    case 'price_asc':
      return { 'price.amountMinor': 1, publishedAt: -1 };
    case 'price_desc':
      return { 'price.amountMinor': -1, publishedAt: -1 };
    case 'capacity_desc':
      return { capacitySort: -1, publishedAt: -1 };
    case 'rating_desc':
      return { 'rating.average': -1, 'rating.count': -1 };
    case 'newest':
      return { publishedAt: -1 };
    case 'oldest':
      return { publishedAt: 1 };
    case 'relevance':
    default:
      return textSearch ? { score: { $meta: 'textScore' } } : { publishedAt: -1 };
  }
}

export interface SearchResult {
  items: ListingSummaryDTO[];
  facets: SearchFacetsDTO;
  total: number;
  page: number;
  limit: number;
  sort: ListingSort;
}

export async function searchListings(
  params: SearchParams,
  viewerId?: string | null,
): Promise<SearchResult> {
  const filter = buildListingFilter(params);

  if (params.q) {
    // Prefer the text index; fall back to a regex scan when the text query
    // matches nothing (e.g. single character or special symbols).
    filter.$text = { $search: params.q };
  }

  if (params.verifiedOnly) {
    const verifiedPartners = await PartnerProfile.find({ verificationStatus: 'VERIFIED' })
      .select('user')
      .lean();
    filter.partner = { $in: verifiedPartners.map((p) => p.user) };
  }

  if (
    params.facilityType ||
    params.storageType ||
    params.equipmentCategory ||
    params.serviceType ||
    params.capacityMin != null ||
    params.capacityMax != null
  ) {
    const detailIds = await idsFromDetails(params);
    const ids = [
      ...(detailIds.warehouseIds ?? []),
      ...(detailIds.equipmentIds ?? []),
      ...(detailIds.serviceIds ?? []),
    ];
    if (params.type === 'WAREHOUSE' && detailIds.warehouseIds) {
      filter.warehouse = { $in: detailIds.warehouseIds };
    } else if (params.type === 'EQUIPMENT' && detailIds.equipmentIds) {
      filter.equipment = { $in: detailIds.equipmentIds };
    } else if (params.type === 'SERVICE' && detailIds.serviceIds) {
      filter.service = { $in: detailIds.serviceIds };
    } else if (ids.length === 0) {
      filter._id = { $in: [] as Types.ObjectId[] };
    } else if (!params.type) {
      filter.$or = [
        { warehouse: { $in: detailIds.warehouseIds ?? [] } },
        { equipment: { $in: detailIds.equipmentIds ?? [] } },
        { service: { $in: detailIds.serviceIds ?? [] } },
      ];
    }
  }

  const textSearch = Boolean(params.q);
  const sort = sortSpec(params.sort, textSearch);
  const skip = (params.page - 1) * params.limit;

  let total: number;
  let docs: ListingLean[];

  try {
    [total, docs] = await Promise.all([
      Listing.countDocuments(filter),
      Listing.find(filter)
        .sort(sort as never)
        .skip(skip)
        .limit(params.limit)
        .lean(),
    ]);
  } catch (error) {
    // Some text queries are invalid (rare operators); retry with a regex match.
    if (!textSearch) throw error;
    delete filter.$text;
    const regex = new RegExp(escapeRegex(params.q ?? ''), 'i');
    filter.$or = [{ title: regex }, { description: regex }, { 'location.city': regex }];
    [total, docs] = await Promise.all([
      Listing.countDocuments(filter),
      Listing.find(filter)
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(params.limit)
        .lean(),
    ]);
  }

  const items = await serializeListingPage(docs, { viewerId });
  const facets = await computeFacets(params);
  return { items, facets, total, page: params.page, limit: params.limit, sort: params.sort };
}

export async function computeFacets(params: SearchParams): Promise<SearchFacetsDTO> {
  const base = buildListingFilter({ ...params, page: 1 });
  delete base.$text;

  const [cityAgg, priceAgg, categoryAgg] = await Promise.all([
    Listing.aggregate<{ _id: string; count: number }>([
      { $match: base },
      { $group: { _id: '$location.city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ]),
    Listing.aggregate<{ min: number | null; max: number | null }>([
      { $match: base },
      {
        $group: {
          _id: null,
          min: { $min: '$price.amountMinor' },
          max: { $max: '$price.amountMinor' },
        },
      },
    ]),
    Listing.aggregate<{ _id: Types.ObjectId; count: number; name?: string }>([
      { $match: base },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ]),
  ]);

  const categoryIds = categoryAgg.map((c) => c._id).filter(Boolean);
  const categories = categoryIds.length
    ? await Category.find({ _id: { $in: categoryIds } }).select('name slug').lean()
    : [];
  const nameMap = new Map(categories.map((c) => [String(c._id), c]));

  const range = priceAgg[0];
  return {
    cities: cityAgg
      .filter((c) => c._id)
      .map((c) => ({ value: c._id, count: c.count })),
    categories: categoryAgg
      .filter((c) => c._id && nameMap.has(String(c._id)))
      .map((c) => ({
        value: String(c._id),
        label: nameMap.get(String(c._id))!.name,
        count: c.count,
      })),
    priceRange:
      range && range.min != null && range.max != null
        ? { min: range.min, max: range.max, currency: 'INR' }
        : null,
  };
}
