import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { LISTING_TYPES } from '@bmw/shared-types';

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    type: { type: String, enum: LISTING_TYPES, required: true, index: true },
    description: { type: String, trim: true, maxlength: 600, default: null },
    icon: { type: String, trim: true, maxlength: 60, default: null },
    imageUrl: { type: String, default: null },
    parent: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

categorySchema.index({ type: 1, isActive: 1, sortOrder: 1 });

export type CategoryDocument = HydratedDocument<InferSchemaType<typeof categorySchema>>;
export const Category = model('Category', categorySchema);
