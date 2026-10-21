import { Link } from 'react-router-dom';
import type { ListingSummaryDTO } from '../lib/types';
import { formatNumber, listingTypeLabel } from '../lib/format';
import { placeholderCover } from '../lib/placeholderCover';
import { PriceTag } from './PriceTag';
import { RatingStars } from './RatingStars';

export interface ListingCardProps {
  listing: ListingSummaryDTO;
  onToggleFavorite?: (listing: ListingSummaryDTO) => void;
}

export function ListingCard({ listing, onToggleFavorite }: ListingCardProps) {
  return (
    <article className="card listing-card">
      <div className="listing-media">
        <Link to={`/listing/${listing.slug}`} tabIndex={-1} aria-hidden="true">
          {listing.coverImage ? (
            <img src={listing.coverImage} alt="" loading="lazy" />
          ) : (
            <img src={placeholderCover(listing.type, listing.title)} alt="" loading="lazy" />
          )}
        </Link>
        <span className="badge tone-accent listing-type-badge">{listingTypeLabel(listing.type)}</span>
        {onToggleFavorite ? (
          <button
            type="button"
            className={`fav-btn ${listing.isFavorite ? 'is-active' : ''}`}
            aria-label={listing.isFavorite ? `Remove ${listing.title} from favorites` : `Add ${listing.title} to favorites`}
            aria-pressed={Boolean(listing.isFavorite)}
            onClick={() => onToggleFavorite(listing)}
          >
            {listing.isFavorite ? '♥' : '♡'}
          </button>
        ) : null}
      </div>
      <div className="listing-card-body">
        <div className="listing-card-meta">
          <span className="listing-city">
            📍 {listing.city}, {listing.state}
          </span>
          {listing.categoryName ? <span className="listing-category">{listing.categoryName}</span> : null}
        </div>
        <h3 className="listing-title">
          <Link to={`/listing/${listing.slug}`}>{listing.title}</Link>
        </h3>
        <div className="listing-card-foot">
          <PriceTag
            amount={listing.price.amount}
            currency={listing.price.currency}
            unitLabel={listing.price.unitLabel}
            period={listing.price.period}
            size="sm"
          />
          {listing.rating && listing.rating.count > 0 ? (
            <RatingStars value={listing.rating.average} count={listing.rating.count} />
          ) : (
            <span className="rating-none">No reviews yet</span>
          )}
        </div>
        {listing.partner?.verified ? (
          <span className="verified-chip" title="Verified partner">
            ✓ Verified partner
          </span>
        ) : null}
        {listing.totalCapacity ? (
          <span className="capacity-chip">
            {formatNumber(listing.totalCapacity)} {listing.capacityUnit ?? ''}
          </span>
        ) : null}
      </div>
    </article>
  );
}
