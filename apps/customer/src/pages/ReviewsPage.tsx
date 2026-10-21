import { useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ApiError, api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import { formatDate, formatDayRange } from '../lib/format';
import type { BookingDTO, ReviewDTO } from '../lib/types';
import { RatingStars } from '../components/RatingStars';
import { Pagination } from '../components/Pagination';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { EmptyState, ErrorState, PageLoader } from '../components/Skeleton';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { fadeUp, stagger } from '@bmw/ui';

export function ReviewsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10) || 1;
  const toast = useToast();

  useDocumentMeta({
    title: 'My reviews — BookMyWarehouse',
    description: 'Reviews you have written after completed bookings.',
  });

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
      <motion.div className="page-head booking-detail-head reveal" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div>
          <h1>My reviews</h1>
          <p className="muted">Reviews you have written after completed bookings.</p>
        </div>
        <motion.button
          type="button"
          className="btn btn-primary"
          onClick={() => openModal()}
          disabled={completedState.loading || reviewableBookings.length === 0}
          title={reviewableBookings.length === 0 ? 'All your completed bookings already have a review' : undefined}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          Write a review
        </motion.button>
      </motion.div>

      <AnimatePresence mode="wait">
        {reviewsState.loading ? (
          <PageLoader key="loading" label="Loading reviews…" />
        ) : reviewsState.error ? (
          <ErrorState key="error" message={reviewsState.error.message} onRetry={reviewsState.reload} />
        ) : (reviewsState.data?.data?.items ?? []).length === 0 ? (
          <motion.div
            key="empty"
            className="state-block reveal"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="state-icon" aria-hidden="true">
              ⭐
            </div>
            <h3 className="state-title">No reviews yet</h3>
            <p className="state-message">Once a booking is completed you can review it here.</p>
            <Link to="/bookings" className="btn btn-outline">
              View my bookings
            </Link>
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <motion.ul className="review-list card-list" variants={stagger(0.06)} initial="hidden" animate="show">
              {(reviewsState.data?.data?.items ?? []).map((review) => (
                <motion.li key={review.id} className="card section-card review-item" variants={fadeUp} whileHover={{ y: -2, boxShadow: 'var(--shadow-md)' }}>
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
                </motion.li>
              ))}
            </motion.ul>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Pagination
                pagination={reviewsState.data?.meta?.pagination ?? null}
                onPageChange={(next) => {
                  const params = new URLSearchParams(searchParams);
                  if (next > 1) params.set('page', String(next));
                  else params.delete('page');
                  setSearchParams(params);
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal
        open={modalOpen}
        title="Write a review"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <motion.button
              type="submit"
              form="review-form"
              className="btn btn-primary"
              disabled={busy}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {busy ? 'Submitting…' : 'Submit review'}
            </motion.button>
          </>
        }
      >
        <form id="review-form" onSubmit={onSubmit}>
          <AnimatePresence>
            {error ? (
              <motion.p className="form-error" role="alert" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                {error}
              </motion.p>
            ) : null}
          </AnimatePresence>
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