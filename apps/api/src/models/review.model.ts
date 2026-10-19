import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { REVIEW_STATUSES, type ReviewStatus } from '@bmw/shared-types';

export interface ReviewFields {
  booking: Types.ObjectId;
  listing: Types.ObjectId;
  author: Types.ObjectId;
  partner: Types.ObjectId;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  response: { text: string; at: Date } | null;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<ReviewFields>(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    listing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    partner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: null, maxlength: 2000 },
    status: { type: String, enum: REVIEW_STATUSES, default: 'PUBLISHED' },
    response: {
      type: new Schema<{ text: string; at: Date }>(
        { text: { type: String, required: true }, at: { type: Date, default: Date.now } },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
);

reviewSchema.index({ listing: 1, status: 1, createdAt: -1 });
reviewSchema.index({ author: 1, createdAt: -1 });
reviewSchema.index({ partner: 1, createdAt: -1 });

export interface FavoriteFields {
  user: Types.ObjectId;
  listing: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const favoriteSchema = new Schema<FavoriteFields>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    listing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
  },
  { timestamps: true },
);

favoriteSchema.index({ user: 1, listing: 1 }, { unique: true });
favoriteSchema.index({ user: 1, createdAt: -1 });

export const Review = model('Review', reviewSchema);
export const Favorite = model('Favorite',
  favoriteSchema,
);
