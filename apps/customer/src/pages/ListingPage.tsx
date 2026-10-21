import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../auth/AuthContext';
import { ApiError, api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import { placeholderCover } from '../lib/placeholderCover';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import {
  formatDate,
  formatDaysOfWeek,
  formatMoney,
  formatNumber,
  humanize,
  listingTypeLabel,
  periodWord,
} from '../lib/format';
import type {
  AvailabilityDTO,
  ListingDetailDTO,
  QuoteResponseDTO,
  ReviewDTO,
} from '../lib/types';
import { ImageGallery } from '../components/ImageGallery';
import { PriceTag } from '../components/PriceTag';
import { RatingStars } from '../components/RatingStars';
import { Pagination } from '../components/Pagination';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { EmptyState, ErrorState, PageLoader } from '../components/Skeleton';
import { fadeUp, stagger } from '@bmw/ui';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ListingPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const listingState = useAsyncData<ListingDetailDTO>(() => api.get(`/catalog/listings/${slug}`), [slug]);
  const listing = listingState.data;

  const listingSnippet = listing?.description
    ? `${listing.description.slice(0, 157).trimEnd()}…`
    : undefined;
  useDocumentMeta({
    title: listing ? `${listing.title} — BookMyWarehouse` : 'Listing — BookMyWarehouse',
    description: listingSnippet,
  });

  const availabilityState = useAsyncData<AvailabilityDTO | null>(
    () => (listing ? api.get(`/catalog/listings/${listing.id}/availability`) : Promise.resolve(null)),
    [listing?.id],
  );
  const similarState = useAsyncData<{ items: ListingDetailDTO['related'] }>(
    () => api.get(`/catalog/listings/${slug}/similar`),
    [slug],
  );

  const [reviewPage, setReviewPage] = useState(1);
  const reviewsState = useAsyncData(
    () =>
      api.getWithMeta<{ items: ReviewDTO[]; average?: number }>(`/catalog/listings/${slug}/reviews`, {
        page: reviewPage,
        limit: 5,
      }),
    [slug, reviewPage],
  );

  /* ------------------------------ booking panel ------------------------------ */

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [capacity, setCapacity] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [deliveryRequired, setDeliveryRequired] = useState(false);
  const [operatorRequired, setOperatorRequired] = useState(false);
  const [notes, setNotes] = useState('');
  const [quote, setQuote] = useState<QuoteResponseDTO | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<ApiError | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);

  const needsCapacity = listing?.type === 'WAREHOUSE';

  useEffect(() => {
    if (!listing) return undefined;
    if (!startDate) {
      setQuote(null);
      setQuoteError(null);
      return undefined;
    }
    let cancelled = false;
    setQuoteLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await api.post<QuoteResponseDTO>('/bookings/quote', {
          listingId: listing.id,
          startDate,
          endDate: endDate || undefined,
          capacity: needsCapacity && capacity ? Number(capacity) : undefined,
          quantity: needsCapacity ? undefined : Number(quantity) || 1,
          deliveryRequired,
          operatorRequired,
        });
        if (cancelled) return;
        setQuote(result);
        setQuoteError(null);
      } catch (error) {
        if (cancelled) return;
        setQuote(null);
        setQuoteError(error instanceof ApiError ? error.message : 'Unable to fetch the quote.');
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [listing, startDate, endDate, capacity, quantity, deliveryRequired, operatorRequired, needsCapacity]);

  const onToggleFavorite = async () => {
    if (!listing) return;
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/listing/${slug}`)}`);
      return;
    }
    setFavoriteBusy(true);
    try {
      const result = await api.post<{ active?: boolean; favorited?: boolean }>('/favorites', { listingId: listing.id });
      const resolved = typeof result?.favorited === 'boolean' ? result.favorited : result?.active;
      const active = typeof resolved === 'boolean' ? resolved : !listing.isFavorite;
      toast.push(active ? 'Added to favorites' : 'Removed from favorites', 'success');
      listingState.reload();
    } catch (error) {
      toast.push(error instanceof ApiError ? error.message : 'Could not update favorites', 'error');
    } finally {
      setFavoriteBusy(false);
    }
  };

  const onRequestBooking = async (event: FormEvent) => {
    event.preventDefault();
    if (!listing) return;
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/listing/${slug}`)}`);
      return;
    }
    setBooking(true);
    setBookingError(null);
    try {
      const created = await api.post<{ id: string }>('/bookings', {
        listingId: listing.id,
        startDate,
        endDate: endDate || undefined,
        capacity: needsCapacity && capacity ? Number(capacity) : undefined,
        quantity: needsCapacity ? 1 : Number(quantity) || 1,
        deliveryRequired,
        operatorRequired,
        notes: notes.trim() || undefined,
      });
      toast.push('Booking request sent to the partner', 'success');
      navigate(`/bookings/${created.id}`);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      setBookingError(apiError);
      toast.push(apiError?.message ?? 'Could not create the booking', 'error');
    } finally {
      setBooking(false);
    }
  };

  /* ------------------------------ message modal ------------------------------ */

  const [messageOpen, setMessageOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [messageBusy, setMessageBusy] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  useEffect(() => {
    if (listing) setSubject(`Question about ${listing.title}`);
  }, [listing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!listing) return;
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/listing/${slug}`)}`);
      return;
    }
    setMessageBusy(true);
    setMessageError(null);
    try {
      const result = await api.post<{ conversationId: string }>('/conversations', {
        listingId: listing.id,
        subject,
        body,
      });
      toast.push('Message sent to the partner', 'success');
      setMessageOpen(false);
      setBody('');
      navigate(`/messages/${result.conversationId}`);
    } catch (error) {
      setMessageError(error instanceof ApiError ? error.message : 'Could not send the message.');
    } finally {
      setMessageBusy(false);
    }
  };

  /* --------------------------------- render --------------------------------- */

  const similar = useMemo(() => (similarState.data?.items ?? []).slice(0, 4), [similarState.data]);

  if (listingState.loading) return <PageLoader label="Loading listing…" />;
  if (listingState.error || !listing) {
    return (
      <div className="container page">
        <ErrorState message={listingState.error?.message ?? 'Listing not found.'} onRetry={listingState.reload} />
        <div className="center-action">
          <Link to="/search" className="btn btn-outline">
            Back to search
          </Link>
        </div>
      </div>
    );
  }

  const availability = availabilityState.data;
  const reviewsPayload = reviewsState.data?.data;
  const canQuote = Boolean(startDate) && (!needsCapacity || Boolean(capacity));

  return (
    <div className="container page listing-page">
      <motion.nav className="breadcrumbs reveal" aria-label="Breadcrumb" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Link to="/">Home</Link> <span aria-hidden="true">/</span>{' '}
        <Link to={`/search?type=${listing.type}`}>{listingTypeLabel(listing.type)}s</Link>{' '}
        <span aria-hidden="true">/</span> <span aria-current="page">{listing.title}</span>
      </motion.nav>

      <motion.div className="listing-hero reveal" variants={stagger(0.1)} initial="hidden" animate="show">
        <motion.div
          className="gallery-wrapper"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <ImageGallery
            images={
              listing.images?.length
                ? listing.images
                : [listing.coverImage || placeholderCover(listing.type, listing.title)]
            }
            alt={listing.title}
          />
        </motion.div>
        <motion.div
          className="listing-hero-side"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="listing-hero-head">
            <span className="badge tone-accent">{listingTypeLabel(listing.type)}</span>
            {listing.categoryName ? <span className="badge tone-neutral">{listing.categoryName}</span> : null}
            {listing.partner?.verified ? <span className="badge tone-success">✓ Verified partner</span> : null}
            <button
              type="button"
              className={`fav-btn fav-btn-inline ${listing.isFavorite ? 'is-active' : ''}`}
              aria-pressed={Boolean(listing.isFavorite)}
              disabled={favoriteBusy}
              onClick={() => void onToggleFavorite()}
            >
              {listing.isFavorite ? '♥ Saved' : '♡ Save'}
            </button>
          </div>
          <motion.h1 className="listing-h1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            {listing.title}
          </motion.h1>
          <motion.p className="listing-loc" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
            📍 {listing.location.addressLine1}, {listing.city}, {listing.state} {listing.location.postalCode}
          </motion.p>
          <motion.div className="listing-rating-row" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
            {listing.rating.count > 0 ? (
              <RatingStars value={listing.rating.average} count={listing.rating.count} size="md" />
            ) : (
              <span className="rating-none">No reviews yet</span>
            )}
            {listing.availableFrom ? (
              <span className="muted">Available from {formatDate(listing.availableFrom)}</span>
            ) : null}
          </motion.div>
          <motion.div className="listing-quickfacts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
            {listing.totalCapacity ? (
              <span>
                <strong>{formatNumber(listing.totalCapacity)}</strong> {listing.capacityUnit ?? 'capacity'}
              </span>
            ) : null}
            {listing.price.period ? (
              <span>
                <strong>{formatMoney(listing.price.amount, listing.price.currency)}</strong> per{' '}
                {periodWord(listing.price.period)}
              </span>
            ) : (
              <span>
                <strong>{formatMoney(listing.price.amount, listing.price.currency)}</strong>
              </span>
            )}
          </motion.div>
          <motion.button
            type="button"
            className="btn btn-outline"
            onClick={() => setMessageOpen(true)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            ✉️ Message partner
          </motion.button>
        </motion.div>
      </motion.div>

      <motion.div className="listing-layout reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.2 }}>
        <div className="listing-main">
          <motion.section className="card section-card reveal" aria-labelledby="about-heading" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.5 }}>
            <h2 id="about-heading">About this listing</h2>
            <p className="listing-description">{listing.description}</p>
            {listing.amenities.length > 0 ? (
              <>
                <h3>Amenities</h3>
                <ul className="chip-list">
                  {listing.amenities.map((amenity) => (
                    <li className="chip" key={amenity}>
                      {amenity}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {listing.safetyFeatures.length > 0 ? (
              <>
                <h3>Safety features</h3>
                <ul className="chip-list">
                  {listing.safetyFeatures.map((feature) => (
                    <li className="chip chip-safety" key={feature}>
                      🛡️ {feature}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {listing.rules.length > 0 ? (
              <>
                <h3>House rules</h3>
                <ul className="bullet-list">
                  {listing.rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </motion.section>

          {(listing.warehouse || listing.equipment || listing.service) && (
            <motion.section className="card section-card reveal" aria-labelledby="details-heading" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.5, delay: 0.05 }}>
              <h2 id="details-heading">{listingTypeLabel(listing.type)} details</h2>
              {listing.warehouse ? (
                <dl className="spec-list">
                  <div>
                    <dt>Facility type</dt>
                    <dd>{humanize(listing.warehouse.facilityType)}</dd>
                  </div>
                  <div>
                    <dt>Storage types</dt>
                    <dd>{listing.warehouse.storageTypes.map(humanize).join(', ')}</dd>
                  </div>
                  <div>
                    <dt>Total capacity</dt>
                    <dd>
                      {formatNumber(listing.warehouse.totalCapacity)} {listing.warehouse.capacityUnit}
                    </dd>
                  </div>
                  {listing.warehouse.numberOfUnits ? (
                    <div>
                      <dt>Units</dt>
                      <dd>{listing.warehouse.numberOfUnits}</dd>
                    </div>
                  ) : null}
                  {listing.warehouse.unitDimensions ? (
                    <div>
                      <dt>Unit dimensions</dt>
                      <dd>{listing.warehouse.unitDimensions}</dd>
                    </div>
                  ) : null}
                  {listing.warehouse.ceilingHeightM ? (
                    <div>
                      <dt>Ceiling height</dt>
                      <dd>{listing.warehouse.ceilingHeightM} m</dd>
                    </div>
                  ) : null}
                  {listing.warehouse.floorLoadCapacityKg ? (
                    <div>
                      <dt>Floor load</dt>
                      <dd>{formatNumber(listing.warehouse.floorLoadCapacityKg)} kg</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Loading docks</dt>
                    <dd>{listing.warehouse.loadingDocks ?? 0}</dd>
                  </div>
                  <div>
                    <dt>Features</dt>
                    <dd>
                      {[
                        listing.warehouse.temperatureControlled && 'Temperature controlled',
                        listing.warehouse.humidityControlled && 'Humidity controlled',
                        listing.warehouse.powerBackup && 'Power backup',
                        listing.warehouse.fireSafety && 'Fire safety',
                        listing.warehouse.cctv && 'CCTV',
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </dd>
                  </div>
                  {listing.warehouse.certifications.length > 0 ? (
                    <div>
                      <dt>Certifications</dt>
                      <dd>{listing.warehouse.certifications.join(', ')}</dd>
                    </div>
                  ) : null}
                  {listing.warehouse.operatingHours ? (
                    <div>
                      <dt>Operating hours</dt>
                      <dd>{listing.warehouse.operatingHours}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
              {listing.equipment ? (
                <dl className="spec-list">
                  <div>
                    <dt>Category</dt>
                    <dd>{humanize(listing.equipment.equipmentCategory)}</dd>
                  </div>
                  {listing.equipment.brand ? (
                    <div>
                      <dt>Brand</dt>
                      <dd>{listing.equipment.brand}</dd>
                    </div>
                  ) : null}
                  {listing.equipment.model ? (
                    <div>
                      <dt>Model</dt>
                      <dd>{listing.equipment.model}</dd>
                    </div>
                  ) : null}
                  {listing.equipment.manufactureYear ? (
                    <div>
                      <dt>Manufactured</dt>
                      <dd>{listing.equipment.manufactureYear}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Units available</dt>
                    <dd>{listing.equipment.quantity}</dd>
                  </div>
                  <div>
                    <dt>Rental period</dt>
                    <dd>{periodWord(listing.equipment.rentalPeriod)}</dd>
                  </div>
                  <div>
                    <dt>Delivery</dt>
                    <dd>{listing.equipment.deliveryAvailable ? 'Available' : 'Not available'}</dd>
                  </div>
                  <div>
                    <dt>Operator</dt>
                    <dd>
                      {listing.equipment.operatorAvailable
                        ? `Available${listing.equipment.operatorChargePerDay ? ` (${formatMoney(listing.equipment.operatorChargePerDay, listing.price.currency)}/day)` : ''}`
                        : 'Not available'}
                    </dd>
                  </div>
                  {Object.entries(listing.equipment.specifications ?? {}).map(([key, value]) => (
                    <div key={key}>
                      <dt>{humanize(key)}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {listing.service ? (
                <dl className="spec-list">
                  <div>
                    <dt>Service type</dt>
                    <dd>{humanize(listing.service.serviceType)}</dd>
                  </div>
                  <div>
                    <dt>Service areas</dt>
                    <dd>{listing.service.serviceAreas.join(', ')}</dd>
                  </div>
                  {listing.service.estimatedDurationHours ? (
                    <div>
                      <dt>Estimated duration</dt>
                      <dd>{listing.service.estimatedDurationHours} hours</dd>
                    </div>
                  ) : null}
                  {listing.service.teamSize ? (
                    <div>
                      <dt>Team size</dt>
                      <dd>{listing.service.teamSize}</dd>
                    </div>
                  ) : null}
                  {listing.service.dailyCapacity ? (
                    <div>
                      <dt>Daily capacity</dt>
                      <dd>{listing.service.dailyCapacity} bookings/day</dd>
                    </div>
                  ) : null}
                  {listing.service.requirements ? (
                    <div>
                      <dt>Requirements</dt>
                      <dd>{listing.service.requirements}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </motion.section>
          )}

          <motion.section className="card section-card reveal" aria-labelledby="availability-heading" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.5, delay: 0.1 }}>
            <h2 id="availability-heading">Availability</h2>
            {availabilityState.loading ? (
              <p className="muted">Loading availability…</p>
            ) : availabilityState.error ? (
              <ErrorState message={availabilityState.error.message} onRetry={availabilityState.reload} />
            ) : (
              <>
                <h3>Operating rules</h3>
                {availability && availability.rules.length > 0 ? (
                  <ul className="bullet-list">
                    {availability.rules.map((rule) => (
                      <li key={rule.id}>
                        {formatDaysOfWeek(rule.daysOfWeek)} · {rule.startTime}–{rule.endTime}
                        {rule.startDate || rule.endDate
                          ? ` (${formatDate(rule.startDate)}${rule.endDate ? ` → ${formatDate(rule.endDate)}` : ''})`
                          : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No special opening rules — contact the partner for timings.</p>
                )}
                <h3>Blocked dates</h3>
                {availability && availability.blockedDates.length > 0 ? (
                  <ul className="bullet-list">
                    {availability.blockedDates.map((blocked) => (
                      <li key={blocked.id}>
                        <strong>{formatDate(blocked.date)}</strong> —{' '}
                        {blocked.isAvailable ? 'open (exception)' : 'blocked'}
                        {blocked.reason ? ` · ${blocked.reason}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No blocked dates on the calendar.</p>
                )}
              </>
            )}
          </motion.section>

          <motion.section className="card section-card reveal" aria-labelledby="cancellation-heading" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.5, delay: 0.15 }}>
            <h2 id="cancellation-heading">Cancellation terms</h2>
            <p>
              <span className="badge tone-info">{humanize(listing.cancellationTerms.policy)}</span>{' '}
              {listing.cancellationTerms.description}
            </p>
            <p>
              Customer refund:{' '}
              <strong>{listing.cancellationTerms.customerRefundPercent}% of the booking amount</strong> when you
              cancel before the start date.
            </p>
            {listing.cancellationTerms.note ? <p className="muted">{listing.cancellationTerms.note}</p> : null}
          </motion.section>

          <motion.section className="card section-card reveal" aria-labelledby="partner-heading" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.5, delay: 0.2 }}>
            <h2 id="partner-heading">About the partner</h2>
            <div className="partner-row">
              {listing.partner.logoUrl ? (
                <img src={listing.partner.logoUrl} alt="" className="avatar avatar-lg" />
              ) : (
                <span className="avatar avatar-fallback avatar-lg" aria-hidden="true">
                  {listing.partner.businessName.charAt(0)}
                </span>
              )}
              <div>
                <h3 className="partner-name">
                  {listing.partner.businessName}{' '}
                  {listing.partner.verified ? <span className="badge tone-success">✓ Verified</span> : null}
                </h3>
                {listing.partner.rating && listing.partner.rating.count > 0 ? (
                  <RatingStars value={listing.partner.rating.average} count={listing.partner.rating.count} />
                ) : (
                  <span className="muted">No ratings yet</span>
                )}
                {listing.partner.responseRate ? (
                  <span className="muted"> · Responds to {listing.partner.responseRate}% of messages</span>
                ) : null}
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setMessageOpen(true)}>
                Message
              </button>
            </div>
          </motion.section>

          <motion.section className="card section-card reveal" aria-labelledby="reviews-heading" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.5, delay: 0.25 }}>
            <div className="section-head">
              <h2 id="reviews-heading">Reviews</h2>
              {reviewsPayload?.average !== undefined ? (
                <RatingStars value={reviewsPayload.average} count={reviewsPayload?.items.length} size="md" />
              ) : null}
            </div>
            {reviewsState.loading ? (
              <p className="muted">Loading reviews…</p>
            ) : reviewsState.error ? (
              <ErrorState message={reviewsState.error.message} onRetry={reviewsState.reload} />
            ) : (reviewsPayload?.items ?? []).length === 0 ? (
              <EmptyState title="No reviews yet" message="Be the first to book and review this listing." />
            ) : (
              <>
                <ul className="review-list">
                  {(reviewsPayload?.items ?? []).map((review) => (
                    <li key={review.id} className="review-item">
                      <div className="review-head">
                        <strong>{review.author.name}</strong>
                        <RatingStars value={review.rating} />
                        <time className="muted" dateTime={review.createdAt}>
                          {formatDate(review.createdAt)}
                        </time>
                      </div>
                      {review.comment ? <p>{review.comment}</p> : null}
                      {review.response ? (
                        <div className="review-response">
                          <strong>Response from {listing.partner.businessName}:</strong>
                          <p>{review.response.text}</p>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <Pagination pagination={reviewsState.data?.meta?.pagination ?? null} onPageChange={setReviewPage} />
              </>
            )}
          </motion.section>

          {similar.length > 0 ? (
            <motion.section className="section-card reveal" aria-labelledby="similar-heading" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.5, delay: 0.3 }}>
              <h2 id="similar-heading">Similar listings</h2>
              <motion.div className="grid grid-similar" variants={stagger(0.08)} initial="hidden" animate="show">
                {similar.map((item) => (
                  <motion.div key={item.id} variants={fadeUp}>
                    <Link to={`/listing/${item.slug}`} className="card similar-card">
                      {item.coverImage ? <img src={item.coverImage} alt="" loading="lazy" /> : null}
                      <div>
                        <strong>{item.title}</strong>
                        <span className="muted">{item.city}</span>
                        <PriceTag
                          amount={item.price.amount}
                          currency={item.price.currency}
                          unitLabel={item.price.unitLabel}
                          period={item.price.period}
                          size="sm"
                        />
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            </motion.section>
          ) : null}
        </div>

        <aside className="listing-side">
          <motion.form
            className="card booking-panel glass-strong"
            onSubmit={onRequestBooking}
            aria-labelledby="booking-heading"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <h2 id="booking-heading" className="visually-hidden">Request a booking</h2>
            <div className="booking-price">
              <PriceTag
                amount={listing.price.amount}
                currency={listing.price.currency}
                unitLabel={listing.price.unitLabel}
                period={listing.price.period}
                size="lg"
              />
              {listing.price.minQuantity ? (
                <span className="muted">Minimum {listing.price.minQuantity} units</span>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="bk-start">Start date *</label>
              <input
                id="bk-start"
                className="input"
                type="date"
                required
                min={todayIso()}
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="bk-end">End date (optional)</label>
              <input
                id="bk-end"
                className="input"
                type="date"
                min={startDate || todayIso()}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>

            {needsCapacity ? (
              <div className="field">
                <label htmlFor="bk-capacity">
                  Capacity ({listing.capacityUnit ?? 'units'}) *
                </label>
                <input
                  id="bk-capacity"
                  className="input"
                  type="number"
                  min={1}
                  required
                  placeholder={`e.g. ${listing.totalCapacity ?? 100}`}
                  value={capacity}
                  onChange={(event) => setCapacity(event.target.value)}
                />
              </div>
            ) : (
              <div className="field">
                <label htmlFor="bk-quantity">Quantity *</label>
                <input
                  id="bk-quantity"
                  className="input"
                  type="number"
                  min={1}
                  required
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </div>
            )}

            {listing.equipment?.deliveryAvailable ? (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={deliveryRequired}
                  onChange={(event) => setDeliveryRequired(event.target.checked)}
                />
                <span>Delivery required</span>
              </label>
            ) : null}
            {listing.equipment?.operatorAvailable ? (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={operatorRequired}
                  onChange={(event) => setOperatorRequired(event.target.checked)}
                />
                <span>Operator required</span>
              </label>
            ) : null}

            <div className="field">
              <label htmlFor="bk-notes">Notes for the partner</label>
              <textarea
                id="bk-notes"
                className="textarea"
                rows={2}
                maxLength={1000}
                placeholder="Anything the partner should know…"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>

            <AnimatePresence mode="wait">
              {!startDate ? (
                <motion.div key="empty" className="quote-box" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <p className="muted">Pick your dates {needsCapacity ? 'and capacity ' : ''}to see a live quote.</p>
                </motion.div>
              ) : quoteLoading ? (
                <motion.div key="loading" className="quote-box" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <p className="muted">Fetching quote…</p>
                </motion.div>
              ) : quoteError ? (
                <motion.div key="error" className="quote-box" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <p className="text-danger">{quoteError}</p>
                </motion.div>
              ) : quote ? (
                <motion.div key="quote" className="quote-box" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <div className="quote-availability">
                    {quote.available ? (
                      <span className="badge tone-success">✓ Available</span>
                    ) : (
                      <span className="badge tone-danger">Unavailable</span>
                    )}
                    {typeof quote.remainingCapacity === 'number' ? (
                      <span className="muted">Remaining capacity: {formatNumber(quote.remainingCapacity)}</span>
                    ) : null}
                  </div>
                  {!quote.available && quote.unavailableReason ? (
                    <p className="text-danger">{quote.unavailableReason}</p>
                  ) : null}
                  {quote.pricing ? (
                    <>
                      <ul className="quote-breakdown">
                        {quote.pricing.breakdown.map((line, index) => (
                          <li key={index}>
                            <span>{line.label}</span>
                            <span>{formatMoney(line.amount, quote.currency)}</span>
                          </li>
                        ))}
                        <li className="quote-total">
                          <span>Total</span>
                          <span>{formatMoney(quote.pricing.total, quote.currency)}</span>
                        </li>
                      </ul>
                      <p className="quote-rate muted">{quote.pricing.rateDescription}</p>
                    </>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>

            {bookingError ? (
              <motion.p className="text-danger" role="alert" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                {bookingError.message}
              </motion.p>
            ) : null}

            {!listing.canRequestBooking ? (
              <p className="muted">This listing is not accepting booking requests right now.</p>
            ) : null}

            <motion.button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={
                booking ||
                !listing.canRequestBooking ||
                !canQuote ||
                (quote !== null && !quote.available)
              }
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              {booking ? 'Sending request…' : 'Request booking'}
            </motion.button>
            {!user ? (
              <p className="field-hint">
                You&apos;ll be asked to <Link to={`/login?next=${encodeURIComponent(`/listing/${slug}`)}`}>sign in</Link> first.
              </p>
            ) : null}
            <p className="field-hint">The partner reviews your request before payment.</p>
            <motion.button
              type="button"
              className="btn btn-outline btn-block"
              onClick={() => setMessageOpen(true)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              ✉️ Message partner
            </motion.button>
          </motion.form>
        </aside>
      </motion.div>

      <Modal
        open={messageOpen}
        title={`Message ${listing.partner.businessName}`}
        onClose={() => setMessageOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setMessageOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="message-form" className="btn btn-primary" disabled={messageBusy}>
              {messageBusy ? 'Sending…' : 'Send message'}
            </button>
          </>
        }
      >
        <form id="message-form" onSubmit={onSendMessage}>
          {messageError ? (
            <p className="text-danger" role="alert">
              {messageError}
            </p>
          ) : null}
          <div className="field">
            <label htmlFor="msg-subject">Subject</label>
            <input
              id="msg-subject"
              className="input"
              type="text"
              required
              minLength={3}
              maxLength={160}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="msg-body">Message</label>
            <textarea
              id="msg-body"
              className="textarea"
              rows={5}
              required
              maxLength={4000}
              placeholder="Ask about availability, pricing or logistics…"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}