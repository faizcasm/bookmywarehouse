import type { CategoryDTO, ListingType } from '@bmw/shared-types';
import { Category, Listing } from '../models/index.js';

export async function listPublicCategories(type?: ListingType): Promise<CategoryDTO[]> {
  const categories = await Category.find({ isActive: true, ...(type ? { type } : {}) })
    .sort({ type: 1, sortOrder: 1 })
    .lean();

  const counts = await Listing.aggregate<{ _id: unknown; count: number }>([
    { $match: { status: 'PUBLISHED', deletedAt: null } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  return categories.map((category) => ({
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    type: category.type,
    description: category.description ?? null,
    icon: category.icon ?? null,
    imageUrl: category.imageUrl ?? null,
    parentId: category.parent ? String(category.parent) : null,
    listingCount: countMap.get(String(category._id)) ?? 0,
    isActive: category.isActive,
    sortOrder: category.sortOrder,
  }));
}

export async function getCategoryBySlug(slug: string): Promise<CategoryDTO | null> {
  const category = await Category.findOne({ slug, isActive: true }).lean();
  if (!category) return null;
  return {
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    type: category.type,
    description: category.description ?? null,
    icon: category.icon ?? null,
    imageUrl: category.imageUrl ?? null,
    parentId: category.parent ? String(category.parent) : null,
    listingCount: 0,
    isActive: category.isActive,
    sortOrder: category.sortOrder,
  };
}
