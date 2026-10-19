import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import { formatDayRange, formatDateTime, formatMoney, humanize, listingTypeLabel } from '../lib/format';
import type { BookingDTO, DisputeDTO } from '../lib/types';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { ErrorState, PageLoader } from '../components/Skeleton';

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
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/bookings">My bookings</Link> <span aria-hidden="true">/</span>{' '}
        <span aria-current="page">{booking.reference}</span>
      </nav>

      <div className="page-head booking-detail-head">
        <div>
          <h1>{booking.listing.title}</h1>
          <p className="muted">
            {booking.reference} · {listingTypeLabel(booking.type)} · {booking.listing.city}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <section className="card section-card" aria-labelledby="timeline-heading">
            <h2 id="timeline-heading">Status timeline</h2>
            <ol className="timeline">
              {booking.statusHistory.map((event, index) => (
                <li key={`${event.status}-${index}`} className="timeline-item">
                  <span className="timeline-dot" aria-hidden="true" />
                  <div>
                    <strong>{humanize(event.status)}</strong>
                    <time dateTime={event.at}>{formatDateTime(event.at)}</time>
                    {event.byRole ? <span className="muted"> · by {humanize(event.byRole)}</span> : null}
                    {event.note ? <p className="muted">{event.note}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
            {booking.cancellationReason ? (
              <p className="text-danger">Cancellation reason: {booking.cancellationReason}</p>
            ) : null}
            {booking.rejectionReason ? (
              <p className="text-danger">Rejection reason: {booking.rejectionReason}</p>
            ) : null}
          </section>

          <section className="card section-card" aria-labelledby="items-heading">
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
                      <td>{item.listingTitle}</td>
                      <td>
                        {item.quantity} {item.unitLabel ?? ''}
                      </td>
                      <td>{formatMoney(item.unitPrice, item.currency)}</td>
                      <td>{formatMoney(item.amount, item.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card section-card" aria-labelledby="parties-heading">
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
          </section>
        </div>

        <aside className="detail-side">
          <div className="card section-card">
            <h2>Summary</h2>
            <dl className="summary-list">
              <div>
                <dt>Dates</dt>
                <dd>{formatDayRange(booking.startDate, booking.endDate)}</dd>
              </div>
              <div>
                <dt>Quantity</dt>
                <dd>{booking.quantity}</dd>
              </div>
              {booking.requestedCapacity ? (
                <div>
                  <dt>Capacity</dt>
                  <dd>
                    {booking.requestedCapacity} {booking.capacityUnit ?? ''}
                  </dd>
                </div>
              ) : null}
            </dl>
            <h3>Pricing</h3>
            <ul className="quote-breakdown">
              {booking.pricing.breakdown.map((line, index) => (
                <li key={index}>
                  <span>{line.label}</span>
                  <span>{formatMoney(line.amount, booking.pricing.currency)}</span>
                </li>
              ))}
            </ul>
            <dl className="summary-list">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatMoney(booking.pricing.subtotal, booking.pricing.currency)}</dd>
              </div>
              <div>
                <dt>Platform fee</dt>
                <dd>{formatMoney(booking.pricing.platformFee, booking.pricing.currency)}</dd>
              </div>
              <div>
                <dt>Taxes</dt>
                <dd>{formatMoney(booking.pricing.taxes, booking.pricing.currency)}</dd>
              </div>
              {booking.pricing.discount > 0 ? (
                <div>
                  <dt>Discount</dt>
                  <dd>−{formatMoney(booking.pricing.discount, booking.pricing.currency)}</dd>
                </div>
              ) : null}
              <div className="summary-total">
                <dt>Total</dt>
                <dd>{formatMoney(booking.pricing.total, booking.pricing.currency)}</dd>
              </div>
            </dl>
            <p className="muted">{booking.pricing.rateDescription}</p>

            <div className="action-stack">
              {canPay ? (
                <button type="button" className="btn btn-primary btn-block" onClick={() => navigate(`/pay/${booking.id}`)}>
                  Pay {formatMoney(booking.pricing.total, booking.pricing.currency)}
                </button>
              ) : null}
              {booking.invoiceId ? (
                <Link to={`/invoices/${booking.invoiceId}`} className="btn btn-outline btn-block">
                  View invoice
                </Link>
              ) : null}
              {canCancel ? (
                <button type="button" className="btn btn-outline btn-block" onClick={() => setCancelOpen(true)}>
                  Cancel booking
                </button>
              ) : null}
              {canDispute ? (
                <button type="button" className="btn btn-danger-ghost btn-block" onClick={() => setDisputeOpen(true)}>
                  Raise a dispute
                </button>
              ) : null}
              {!booking.reviewId && booking.status === 'COMPLETED' ? (
                <Link to="/reviews" className="btn btn-outline btn-block">
                  Write a review
                </Link>
              ) : null}
            </div>
          </div>
        </aside>
      </div>

      <Modal
        open={cancelOpen}
        title="Cancel booking"
        onClose={() => setCancelOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setCancelOpen(false)}>
              Keep booking
            </button>
            <button type="submit" form="cancel-form" className="btn btn-danger" disabled={cancelBusy}>
              {cancelBusy ? 'Cancelling…' : 'Cancel booking'}
            </button>
          </>
        }
      >
        <form id="cancel-form" onSubmit={onCancel}>
          {cancelError ? (
            <p className="text-danger" role="alert">
              {cancelError}
            </p>
          ) : null}
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
            <button type="submit" form="dispute-form" className="btn btn-primary" disabled={disputeBusy}>
              {disputeBusy ? 'Submitting…' : 'Submit dispute'}
            </button>
          </>
        }
      >
        <form id="dispute-form" onSubmit={onRaiseDispute}>
          {disputeError ? (
            <p className="text-danger" role="alert">
              {disputeError}
            </p>
          ) : null}
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
