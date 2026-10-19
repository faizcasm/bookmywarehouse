import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDate, formatDateTime, formatMoney, humanize } from '../lib/format';
import type { BookingDTO } from '../lib/types';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, ListSkeleton } from '../components/States';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';

function ReasonModal({
  open,
  title,
  label,
  placeholder,
  confirmLabel,
  optional = false,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  title: string;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  optional?: boolean;
  onCancel: () => void;
  onSubmit: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValue('');
      setError(null);
    }
  }, [open]);

  async function handleConfirm(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!value.trim() && !optional) {
      setError('This field is required');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(value.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="reason-modal-form" className="btn btn--primary" disabled={saving}>
            {saving ? 'Saving…' : confirmLabel}
          </button>
        </>
      }
    >
      <form id="reason-modal-form" onSubmit={(event) => void handleConfirm(event)}>
        <div className="field">
          <label className="field__label" htmlFor="reason-input">
            {label}
          </label>
          <textarea
            id="reason-input"
            className={`input input--textarea ${error ? 'input--invalid' : ''}`}
            rows={3}
            placeholder={placeholder}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          {error ? <span className="field__error">{error}</span> : null}
        </div>
      </form>
    </Modal>
  );
}

export function BookingDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [booking, setBooking] = useState<BookingDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [working, setWorking] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBooking(await api.get<BookingDTO>(`/bookings/${id}`));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function action(name: 'accept' | 'reject' | 'start' | 'complete', body?: Record<string, unknown>, successMessage?: string): Promise<void> {
    setWorking(true);
    try {
      await api.post(`/bookings/${id}/${name}`, body);
      toast.success(successMessage ?? 'Booking updated.');
      await load();
    } catch (err) {
      toast.errorFrom(err, 'Action failed');
    } finally {
      setWorking(false);
    }
  }

  async function messageCustomer(): Promise<void> {
    if (!booking) return;
    setWorking(true);
    try {
      const result = await api.post<{ conversationId: string }>('/conversations', {
        toUserId: booking.customer.id,
        subject: `Booking ${booking.reference}`,
        body: `Hello ${booking.customer.name.split(' ')[0]}, about your booking ${booking.reference} for ${booking.listing.title}…`,
      });
      navigate(`/messages/${result.conversationId}`);
    } catch (err) {
      toast.errorFrom(err, 'Could not start a conversation');
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <ListSkeleton rows={6} />
      </div>
    );
  }
  if (error || !booking) {
    return (
      <div className="page">
        <ErrorState error={error} onRetry={() => void load()} title="Could not load the booking" />
      </div>
    );
  }

  const canAccept = booking.status === 'PENDING_APPROVAL';
  const canStart = booking.status === 'CONFIRMED';
  const canComplete = booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS';

  return (
    <div className="page">
      <div className="page__intro booking-heading">
        <div>
          <h2>
            {booking.reference} <StatusBadge value={booking.status} kind="booking" />
          </h2>
          <p className="muted">
            Created {formatDateTime(booking.createdAt)} · {humanize(booking.type)} booking
          </p>
        </div>
        <div className="row-actions">
          <Link to="/bookings" className="btn btn--ghost">
            ← All bookings
          </Link>
          {canAccept ? (
            <>
              <button type="button" className="btn btn--primary" onClick={() => void action('accept', undefined, 'Booking accepted — awaiting payment.')} disabled={working}>
                Accept
              </button>
              <button type="button" className="btn btn--danger" onClick={() => setRejectOpen(true)} disabled={working}>
                Reject
              </button>
            </>
          ) : null}
          {canStart ? (
            <button type="button" className="btn btn--primary" onClick={() => void action('start', undefined, 'Booking started.')} disabled={working}>
              Start
            </button>
          ) : null}
          {canComplete ? (
            <button type="button" className="btn btn--primary" onClick={() => setCompleteOpen(true)} disabled={working}>
              Complete
            </button>
          ) : null}
          <button type="button" className="btn btn--secondary" onClick={() => void messageCustomer()} disabled={working}>
            Message customer
          </button>
        </div>
      </div>

      {booking.status === 'REJECTED' && booking.rejectionReason ? (
        <div className="alert alert--error" role="alert">
          <strong>Rejected:</strong> {booking.rejectionReason}
        </div>
      ) : null}
      {booking.status === 'CANCELLED' && booking.cancellationReason ? (
        <div className="alert alert--warning" role="alert">
          <strong>Cancelled:</strong> {booking.cancellationReason}
        </div>
      ) : null}

      <div className="detail-grid">
        <section className="card" aria-label="Booking summary">
          <h3 className="card__title">Booking</h3>
          <dl className="detail-list">
            <div>
              <dt>Listing</dt>
              <dd>
                <Link to={`/listings/${booking.listing.id}`}>{booking.listing.title}</Link>
                <span className="muted"> · {booking.listing.city}</span>
              </dd>
            </div>
            <div>
              <dt>Customer</dt>
              <dd>{booking.customer?.name ?? '—'}</dd>
            </div>
            <div>
              <dt>Dates</dt>
              <dd>
                {formatDate(booking.startDate)}
                {booking.endDate ? ` → ${formatDate(booking.endDate)}` : ''}
              </dd>
            </div>
            <div>
              <dt>Quantity</dt>
              <dd>{booking.quantity}</dd>
            </div>
            {booking.requestedCapacity ? (
              <div>
                <dt>Requested capacity</dt>
                <dd>
                  {booking.requestedCapacity} {booking.capacityUnit ?? ''}
                </dd>
              </div>
            ) : null}
            {booking.notes ? (
              <div>
                <dt>Customer notes</dt>
                <dd>{booking.notes}</dd>
              </div>
            ) : null}
            {booking.specialRequirements ? (
              <div>
                <dt>Special requirements</dt>
                <dd>{booking.specialRequirements}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="card" aria-label="Pricing breakdown">
          <h3 className="card__title">Pricing</h3>
          <p className="muted">{booking.pricing?.rateDescription}</p>
          <table className="price-table">
            <tbody>
              {booking.pricing?.breakdown?.map((line, index) => (
                <tr key={index}>
                  <td>{line.label}</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(line.amount, booking.pricing.currency)}</td>
                </tr>
              ))}
              <tr>
                <td>Subtotal</td>
                <td style={{ textAlign: 'right' }}>{formatMoney(booking.pricing?.subtotal, booking.pricing?.currency)}</td>
              </tr>
              {booking.pricing?.platformFee ? (
                <tr>
                  <td>Platform fee</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(booking.pricing.platformFee, booking.pricing.currency)}</td>
                </tr>
              ) : null}
              {booking.pricing?.taxes ? (
                <tr>
                  <td>Taxes</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(booking.pricing.taxes, booking.pricing.currency)}</td>
                </tr>
              ) : null}
              {booking.pricing?.discount ? (
                <tr>
                  <td>Discount</td>
                  <td style={{ textAlign: 'right' }}>-{formatMoney(booking.pricing.discount, booking.pricing.currency)}</td>
                </tr>
              ) : null}
              <tr className="price-table__total">
                <td>
                  <strong>Total</strong>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <strong>{formatMoney(booking.pricing?.total, booking.pricing?.currency)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <section className="card" aria-label="Status timeline">
        <h3 className="card__title">Status timeline</h3>
        <ol className="timeline">
          {booking.statusHistory?.map((event, index) => (
            <li key={index} className="timeline__item">
              <span className="timeline__dot" aria-hidden="true" />
              <div>
                <div className="timeline__head">
                  <strong>{humanize(event.status)}</strong>
                  {event.byRole ? <span className="muted"> by {humanize(event.byRole)}</span> : null}
                </div>
                {event.note ? <p className="timeline__note">{event.note}</p> : null}
                <span className="muted">{formatDateTime(event.at)}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <ReasonModal
        open={rejectOpen}
        title="Reject booking"
        label="Reason for rejection *"
        placeholder="e.g. Space unavailable for those dates"
        confirmLabel="Reject booking"
        onCancel={() => setRejectOpen(false)}
        onSubmit={async (reason) => {
          await action('reject', { reason }, 'Booking rejected.');
          setRejectOpen(false);
        }}
      />

      <ReasonModal
        open={completeOpen}
        title="Complete booking"
        label="Completion note (optional)"
        placeholder="e.g. Handover finished, goods inventoried"
        confirmLabel="Mark as completed"
        optional
        onCancel={() => setCompleteOpen(false)}
        onSubmit={async (note) => {
          await action('complete', { note }, 'Booking completed.');
          setCompleteOpen(false);
        }}
      />
    </div>
  );
}

export default BookingDetailPage;
