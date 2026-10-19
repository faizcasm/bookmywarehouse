import { Types } from 'mongoose';
import type { FavoriteDTO } from '@bmw/shared-types';
import { errors } from '../lib/errors.js';
import { Favorite, Listing, PartnerProfile } from '../models/index.js';
import { serializeListingSummary } from '../serializers/listing.serializer.js';
import type { ListingLean } from './listing.service.js';

export async function toggleFavorite(
  userId: string,
  listingId: string,
): Promise<{ favorited: boolean }> {
  if (!Types.ObjectId.isValid(listingId)) throw errors.notFound('Listing not found');
  const listing = await Listing.findOne({ _id: listingId, status: 'PUBLISHED', deletedAt: null })
    .select('_id')
    .lean();
  if (!listing) throw errors.notFound('Listing not found');

  const existing = await Favorite.findOne({ user: userId, listing: listingId });
  if (existing) {
    await existing.deleteOne();
    return { favorited: false };
  }
  await Favorite.create({ user: userId, listing: listingId });
  return { favorited: true };
}

export async function listFavorites(
  userId: string,
  page: number,
  limit: number,
): Promise<{ items: FavoriteDTO[]; total: number }> {
  const [favorites, total] = await Promise.all([
    Favorite.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Favorite.countDocuments({ user: userId }),
  ]);

  const listingIds = favorites.map((f) => f.listing);
  const listings = (await Listing.find({
    _id: { $in: listingIds },
    deletedAt: null,
  }).lean()) as unknown as ListingLean[];
  const listingMap = new Map(listings.map((l) => [String(l._id), l]));

  const partnerIds = listings.map((l) => String(l.partner));
  const partners = partnerIds.length
    ? await PartnerProfile.find({ user: { $in: partnerIds } }).lean()
    : [];
  const partnerMap = new Map(partners.map((p) => [String(p.user), p]));

  const items: FavoriteDTO[] = [];
  for (const favorite of favorites) {
    const listing = listingMap.get(String(favorite.listing));
    if (!listing) continue;
    const partner = partnerMap.get(String(listing.partner));
    items.push({
      id: String(favorite._id),
      createdAt: new Date(favorite.createdAt).toISOString(),
      listing: serializeListingSummary(listing, {
        partner: partner
          ? {
              userId: String(partner.user),
              businessName: partner.businessName,
              logoUrl: partner.logoUrl,
              verificationStatus: partner.verificationStatus,
              responseRate: partner.responseRate,
              joinedAt: partner.createdAt,
            }
          : { userId: String(listing.partner), businessName: 'Warehouse partner', verificationStatus: 'DRAFT' },
        isFavorite: true,
      }),
    });
  }
  return { items, total };
}

export async function favoriteListingIds(userId: string, listingIds: string[]): Promise<Set<string>> {
  const favorites = await Favorite.find({
    user: userId,
    listing: { $in: listingIds.map((id) => new Types.ObjectId(id)) },
  })
    .select('listing')
    .lean();
  return new Set(favorites.map((f) => String(f.listing)));
}
