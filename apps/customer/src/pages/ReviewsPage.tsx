import { useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import { formatDate, formatDayRange } from '../lib/format';
import type { BookingDTO, ReviewDTO } from '../lib/types';
import { RatingStars } from '../components/RatingStars';
import { Pagination } from '../components/Pagination';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { EmptyState, ErrorState, PageLoader } from '../components/Skeleton';

export function ReviewsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10) || 1;
  const toast = useToast();

  const reviewsState = useAsyncData(
    () => api.getWithMeta<{ items: ReviewDTO[]; average?: number }>('/me/reviews', { page, limit: 10 }),
    [page],
  );

  const completedState = useAsyncData<{ items: BookingDTO[] } | BookingDTO[]>(
    () => api.get('/bookings', { status: 'COMPLETED', limit: 50 }),
    [],
  );

  const reviewableBookings = useMemo(() => {
    const payload = completedState.data;
    const items = Array.isArray(payload) ? payload : (payload?.items ?? []);
    return items.filter((booking) => !booking.reviewId);
  }, [completedState.data]);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openModal = (bookingId?: string) => {
    setSelectedBookingId(bookingId ?? reviewableBookings[0]?.id ?? '');
    setRating(5);
    setComment('');
    setError(null);
    setModalOpen(true);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedBookingId) {
      setError('Choose a booking to review.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post('/reviews', { bookingId: selectedBookingId, rating, comment: comment.trim() || null });
      toast.push('Thanks for your review!', 'success');
      setModalOpen(false);
      reviewsState.reload();
      completedState.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit the review.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page">
      <div className="page-head booking-detail-head">
        <div>
          <h1>My reviews</h1>
          <p className="muted">Reviews you have written after completed bookings.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => openModal()}
          disabled={completedState.loading || reviewableBookings.length === 0}
          title={reviewableBookings.length === 0 ? 'All your completed bookings already have a review' : undefined}
        >
          Write a review
        </button>
      </div>

      {reviewsState.loading ? (
        <PageLoader label="Loading reviews…" />
      ) : reviewsState.error ? (
        <ErrorState message={reviewsState.error.message} onRetry={reviewsState.reload} />
      ) : (reviewsState.data?.data?.items ?? []).length === 0 ? (
        <EmptyState
          title="No reviews yet"
          message="Once a booking is completed you can review it here."
          action={
            <Link to="/bookings" className="btn btn-outline">
              View my bookings
            </Link>
          }
        />
      ) : (
        <>
          <ul className="review-list card-list">
            {(reviewsState.data?.data?.items ?? []).map((review) => (
              <li key={review.id} className="card section-card review-item">
                <div className="review-head">
                  <Link to={`/listing/${review.listingId}`} className="booking-title">
                    {review.listingTitle}
                  </Link>
                  <RatingStars value={review.rating} />
                  <time className="muted" dateTime={review.createdAt}>
                    {formatDate(review.createdAt)}
                  </time>
                </div>
                {review.comment ? <p>{review.comment}</p> : null}
                {review.response ? (
                  <div className="review-response">
                    <strong>Partner response:</strong>
                    <p>{review.response.text}</p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          <Pagination
            pagination={reviewsState.data?.meta?.pagination ?? null}
            onPageChange={(next) => {
              const params = new URLSearchParams(searchParams);
              if (next > 1) params.set('page', String(next));
              else params.delete('page');
              setSearchParams(params);
            }}
          />
        </>
      )}

      <Modal
        open={modalOpen}
        title="Write a review"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="review-form" className="btn btn-primary" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit review'}
            </button>
          </>
        }
      >
        <form id="review-form" onSubmit={onSubmit}>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="field">
            <label htmlFor="review-booking">Booking</label>
            <select
              id="review-booking"
              className="select"
              value={selectedBookingId}
              onChange={(event) => setSelectedBookingId(event.target.value)}
            >
              {reviewableBookings.map((booking) => (
                <option key={booking.id} value={booking.id}>
                  {booking.listing.title} · {formatDayRange(booking.startDate, booking.endDate)} · {booking.reference}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="field-label" id="review-rating-label">
              Rating
            </span>
            <RatingStars value={rating} interactive onChange={setRating} label="Rating" />
          </div>
          <div className="field">
            <label htmlFor="review-comment">Comment (optional)</label>
            <textarea
              id="review-comment"
              className="textarea"
              rows={4}
              maxLength={2000}
              placeholder="How was your experience?"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
