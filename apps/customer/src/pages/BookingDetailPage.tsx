import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { api, ApiError } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import { formatDayRange, formatDateTime, formatMoney, humanize, listingTypeLabel } from '../lib/format';
import type { BookingDTO, DisputeDTO } from '../lib/types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { ErrorState, PageLoader } from '../components/Skeleton';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { fadeUp, stagger } from '@bmw/ui';

const DISPUTE_REASONS = [
  'SERVICE_NOT_DELIVERED',
  'QUALITY_ISSUE',
  'OVERCHARGE',
  'CANCELLATION_REFUND',
  'DAMAGE',
  'OTHER',
] as const;

const CANCELLABLE_STATUSES = ['PENDING_APPROVAL', 'AWAITING_PAYMENT', 'CONFIRMED'];

export function BookingDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const bookingState = useAsyncData<BookingDTO>(() => api.get(`/bookings/${id}`), [id]);
  const booking = bookingState.data;

  useDocumentMeta({
    title: booking ? `${booking.reference} — Booking — BookMyWarehouse` : 'Booking — BookMyWarehouse',
    description: booking ? `Booking details for ${booking.listing.title}` : undefined,
  });

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState<(typeof DISPUTE_REASONS)[number]>('SERVICE_NOT_DELIVERED');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [disputeBusy, setDisputeBusy] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);

  const onCancel = async (event: FormEvent) => {
    event.preventDefault();
    setCancelBusy(true);
    setCancelError(null);
    try {
      const result = await api.post<{ booking: BookingDTO; refundAmountMinor?: number }>(
        `/bookings/${id}/cancel`,
        { reason: cancelReason.trim() },
      );
      const refund = result?.refundAmountMinor;
      toast.push(
        typeof refund === 'number' && refund > 0
          ? `Booking cancelled. Refund of ${formatMoney(refund, booking?.pricing.currency)} initiated.`
          : 'Booking cancelled.',
        'success',
      );
      setCancelOpen(false);
      bookingState.reload();
    } catch (error) {
      setCancelError(error instanceof ApiError ? error.message : 'Could not cancel the booking.');
    } finally {
      setCancelBusy(false);
    }
  };

  const onRaiseDispute = async (event: FormEvent) => {
    event.preventDefault();
    setDisputeBusy(true);
    setDisputeError(null);
    try {
      await api.post<DisputeDTO>(`/bookings/${id}/dispute`, {
        bookingId: id,
        reason: disputeReason,
        description: disputeDescription.trim(),
      });
      toast.push('Dispute raised. Our team will review it with both parties.', 'success');
      setDisputeOpen(false);
      bookingState.reload();
    } catch (error) {
      setDisputeError(error instanceof ApiError ? error.message : 'Could not raise the dispute.');
    } finally {
      setDisputeBusy(false);
    }
  };

  if (bookingState.loading) return <PageLoader label="Loading booking…" />;
  if (bookingState.error || !booking) {
    return (
      <div className="container page">
        <ErrorState message={bookingState.error?.message ?? 'Booking not found.'} onRetry={bookingState.reload} />
      </div>
    );
  }

  const canCancel = CANCELLABLE_STATUSES.includes(booking.status);
  const canDispute = booking.allowedTransitions?.includes('DISPUTED') ?? false;
  const canPay = booking.status === 'AWAITING_PAYMENT';

  return (
    <div className="container page">
      <motion.nav className="breadcrumbs reveal" aria-label="Breadcrumb" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Link to="/bookings">My bookings</Link> <span aria-hidden="true">/</span>{' '}
        <span aria-current="page">{booking.reference}</span>
      </motion.nav>

      <motion.div className="page-head booking-detail-head reveal" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div>
          <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            {booking.listing.title}
          </motion.h1>
          <motion.p className="muted" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
            {booking.reference} · {listingTypeLabel(booking.type)} · {booking.listing.city}
          </motion.p>
        </div>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 0.1 }}>
          <StatusBadge status={booking.status} />
        </motion.div>
      </motion.div>

      <motion.div className="detail-layout reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.15 }}>
        <div className="detail-main">
          <motion.section className="card section-card reveal" aria-labelledby="timeline-heading" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.5 }}>
            <h2 id="timeline-heading">Status timeline</h2>
            <motion.ol className="timeline" variants={stagger(0.08)} initial="hidden" animate="show">
              {booking.statusHistory.map((event, index) => (
                <motion.li key={`${event.status}-${index}`} className="timeline-item" variants={fadeUp}>
                  <span className="timeline-dot" aria-hidden="true" />
                  <div>
                    <strong>{humanize(event.status)}</strong>
                    <time dateTime={event.at}>{formatDateTime(event.at)}</time>
                    {event.byRole ? <span className="muted"> · by {humanize(event.byRole)}</span> : null}
                    {event.note ? <p className="muted">{event.note}</p> : null}
                  </div>
                </motion.li>
              ))}
            </motion.ol>
            {booking.cancellationReason ? (
              <motion.p className="text-danger" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                Cancellation reason: {booking.cancellationReason}
              </motion.p>
            ) : null}
            {booking.rejectionReason ? (
              <motion.p className="text-danger" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                Rejection reason: {booking.rejectionReason}
              </motion.p>
            ) : null}
          </motion.section>

          <motion.section className="card section-card reveal" aria-labelledby="items-heading" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.5, delay: 0.05 }}>
            <h2 id="items-heading">Booking items</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">Qty</th>
                    <th scope="col">Unit price</th>
                    <th scope="col">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {booking.items.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Item">{item.listingTitle}</td>
                      <td data-label="Qty">{item.quantity} {item.unitLabel ?? ''}</td>
                      <td data-label="Unit price">{formatMoney(item.unitPrice, item.currency)}</td>
                      <td data-label="Amount">{formatMoney(item.amount, item.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.section>

          <motion.section className="card section-card reveal" aria-labelledby="parties-heading" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.5, delay: 0.1 }}>
            <h2 id="parties-heading">Parties</h2>
            <div className="parties-grid">
              <div>
                <h3>Customer</h3>
                <p>
                  {booking.customer.avatarUrl ? (
                    <img src={booking.customer.avatarUrl} alt="" className="avatar" />
                  ) : null}
                  {booking.customer.name}
                </p>
              </div>
              <div>
                <h3>Partner</h3>
                <p>
                  {booking.partner.businessName}{' '}
                  {booking.partner.verified ? <span className="badge tone-success">✓ Verified</span> : null}
                </p>
                <button type="button" className="link-btn" onClick={() => navigate('/messages')}>
                  Message partner
                </button>
              </div>
            </div>
            {booking.notes ? (
              <>
                <h3>Your notes</h3>
                <p>{booking.notes}</p>
              </>
            ) : null}
            {booking.specialRequirements ? (
              <>
                <h3>Special requirements</h3>
                <p>{booking.specialRequirements}</p>
              </>
            ) : null}
          </motion.section>
        </div>

        <aside className="detail-side">
          <motion.div className="card section-card reveal" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }} variants={stagger(0.06)}>
            <h2>Summary</h2>
            <dl className="summary-list">
              <motion.div variants={fadeUp}>
                <dt>Dates</dt>
                <dd>{formatDayRange(booking.startDate, booking.endDate)}</dd>
              </motion.div>
              <motion.div variants={fadeUp}>
                <dt>Quantity</dt>
                <dd>{booking.quantity}</dd>
              </motion.div>
              {booking.requestedCapacity ? (
                <motion.div variants={fadeUp}>
                  <dt>Capacity</dt>
                  <dd>
                    {booking.requestedCapacity} {booking.capacityUnit ?? ''}
                  </dd>
                </motion.div>
              ) : null}
            </dl>
            <h3>Pricing</h3>
            <motion.ul className="quote-breakdown" variants={stagger(0.04)} initial="hidden" animate="show">
              {booking.pricing.breakdown.map((line, index) => (
                <motion.li key={index} variants={fadeUp}>
                  <span>{line.label}</span>
                  <span>{formatMoney(line.amount, booking.pricing.currency)}</span>
                </motion.li>
              ))}
            </motion.ul>
            <dl className="summary-list">
              <motion.div variants={fadeUp}>
                <dt>Subtotal</dt>
                <dd>{formatMoney(booking.pricing.subtotal, booking.pricing.currency)}</dd>
              </motion.div>
              <motion.div variants={fadeUp}>
                <dt>Platform fee</dt>
                <dd>{formatMoney(booking.pricing.platformFee, booking.pricing.currency)}</dd>
              </motion.div>
              <motion.div variants={fadeUp}>
                <dt>Taxes</dt>
                <dd>{formatMoney(booking.pricing.taxes, booking.pricing.currency)}</dd>
              </motion.div>
              {booking.pricing.discount > 0 ? (
                <motion.div variants={fadeUp}>
                  <dt>Discount</dt>
                  <dd>−{formatMoney(booking.pricing.discount, booking.pricing.currency)}</dd>
                </motion.div>
              ) : null}
              <motion.div className="summary-total" variants={fadeUp}>
                <dt>Total</dt>
                <dd>{formatMoney(booking.pricing.total, booking.pricing.currency)}</dd>
              </motion.div>
            </dl>
            <motion.p className="muted" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
              {booking.pricing.rateDescription}
            </motion.p>

            <motion.div className="action-stack" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} variants={stagger(0.06)}>
              {canPay ? (
                <motion.button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={() => navigate(`/pay/${booking.id}`)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  variants={fadeUp}
                >
                  Pay {formatMoney(booking.pricing.total, booking.pricing.currency)}
                </motion.button>
              ) : null}
              {booking.invoiceId ? (
                <motion.div variants={fadeUp} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Link to={`/invoices/${booking.invoiceId}`} className="btn btn-outline btn-block">
                    View invoice
                  </Link>
                </motion.div>
              ) : null}
              {canCancel ? (
                <motion.button
                  type="button"
                  className="btn btn-outline btn-block"
                  onClick={() => setCancelOpen(true)}
                  variants={fadeUp}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  Cancel booking
                </motion.button>
              ) : null}
              {canDispute ? (
                <motion.button
                  type="button"
                  className="btn btn-danger-ghost btn-block"
                  onClick={() => setDisputeOpen(true)}
                  variants={fadeUp}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  Raise a dispute
                </motion.button>
              ) : null}
              {!booking.reviewId && booking.status === 'COMPLETED' ? (
                <motion.div variants={fadeUp} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Link to="/reviews" className="btn btn-outline btn-block">
                    Write a review
                  </Link>
                </motion.div>
              ) : null}
            </motion.div>
          </motion.div>
        </aside>
      </motion.div>

      <Modal
        open={cancelOpen}
        title="Cancel booking"
        onClose={() => setCancelOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setCancelOpen(false)}>
              Keep booking
            </button>
            <motion.button
              type="submit"
              form="cancel-form"
              className="btn btn-danger"
              disabled={cancelBusy}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {cancelBusy ? 'Cancelling…' : 'Cancel booking'}
            </motion.button>
          </>
        }
      >
        <form id="cancel-form" onSubmit={onCancel}>
          <AnimatePresence>
            {cancelError ? (
              <motion.p className="text-danger" role="alert" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                {cancelError}
              </motion.p>
            ) : null}
          </AnimatePresence>
          <p className="muted">
            Cancellation is subject to the listing&apos;s cancellation policy. Any refund is
            calculated automatically and initiated with the original payment.
          </p>
          <div className="field">
            <label htmlFor="cancel-reason">Reason *</label>
            <textarea
              id="cancel-reason"
              className="textarea"
              rows={4}
              required
              minLength={3}
              maxLength={600}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={disputeOpen}
        title="Raise a dispute"
        onClose={() => setDisputeOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setDisputeOpen(false)}>
              Cancel
            </button>
            <motion.button
              type="submit"
              form="dispute-form"
              className="btn btn-primary"
              disabled={disputeBusy}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {disputeBusy ? 'Submitting…' : 'Submit dispute'}
            </motion.button>
          </>
        }
      >
        <form id="dispute-form" onSubmit={onRaiseDispute}>
          <AnimatePresence>
            {disputeError ? (
              <motion.p className="text-danger" role="alert" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                {disputeError}
              </motion.p>
            ) : null}
          </AnimatePresence>
          <div className="field">
            <label htmlFor="dispute-reason">Reason</label>
            <select
              id="dispute-reason"
              className="select"
              value={disputeReason}
              onChange={(event) => setDisputeReason(event.target.value as (typeof DISPUTE_REASONS)[number])}
            >
              {DISPUTE_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {humanize(reason)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="dispute-description">Description *</label>
            <textarea
              id="dispute-description"
              className="textarea"
              rows={4}
              required
              maxLength={2000}
              placeholder="Describe what went wrong…"
              value={disputeDescription}
              onChange={(event) => setDisputeDescription(event.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}