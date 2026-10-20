import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ReasonDialog } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, PageHeader, Skeleton } from '../components/States';
import { useToast } from '../components/Toast';
import { apiSend } from '../lib/api';
import { errorMessage, useFetch } from '../lib/hooks';
import { formatDateTime, formatMoney } from '../lib/format';
import type { BookingDTO } from '../lib/types';

const CANCELLABLE: string[] = ['DRAFT', 'PENDING_APPROVAL', 'AWAITING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'];

export function BookingDetailPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const { data: b, loading, error, reload } = useFetch<BookingDTO>(id ? `/bookings/${id}` : null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const cancelBooking = async (reason: string) => {
    setBusy(true);
    setServerError(null);
    try {
      const res = await apiSend<{ booking?: BookingDTO; refundAmountMinor?: number }>('POST', `/bookings/${id}/cancel`, {
        reason,
      });
      const refund = res?.refundAmountMinor;
      toast.success(
        refund && refund > 0 ? `Booking cancelled — refund of ${formatMoney(refund, b?.pricing?.currency)} initiated.` : 'Booking cancelled.',
      );
      setCancelOpen(false);
      reload();
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Skeleton rows={10} />;
  if (error || !b) return <ErrorState error={error} onRetry={reload} />;

  const pricing = b.pricing;

  return (
    <>
      <PageHeader
        title={`Booking ${b.reference}`}
        subtitle={`${b.listing?.title ?? 'Listing'} · ${b.type}`}
        actions={
          <>
            <Link to="/bookings" className="btn btn--ghost btn--sm">
              <ArrowLeft aria-hidden="true" />
              All bookings
            </Link>
            {CANCELLABLE.includes(b.status) ? (
              <button type="button" className="btn btn--danger btn--sm" onClick={() => setCancelOpen(true)}>
                Cancel booking
              </button>
            ) : null}
          </>
        }
      />

      <div className="detail-head card">
        <div className="detail-head__status">
          <StatusBadge status={b.status} group="booking" />
          <span className="muted">Created {formatDateTime(b.createdAt)}</span>
        </div>
        {b.cancellationReason ? (
          <p className="alert alert--error">
            Cancellation reason: {b.cancellationReason}
          </p>
        ) : null}
        {b.rejectionReason ? (
          <p className="alert alert--error">
            Rejection reason: {b.rejectionReason}
          </p>
        ) : null}
      </div>

      <div className="detail-grid">
        <section className="card">
          <h2 className="card__title">Parties</h2>
          <dl className="kv">
            <div className="kv__row">
              <dt>Customer</dt>
              <dd>{b.customer?.name ?? '—'}</dd>
            </div>
            <div className="kv__row">
              <dt>Partner</dt>
              <dd>
                {b.partner?.businessName ?? '—'}{' '}
                {b.partner?.verified ? <span className="badge badge--success">Verified</span> : null}
              </dd>
            </div>
            <div className="kv__row">
              <dt>Listing</dt>
              <dd>{b.listing?.title ?? '—'}</dd>
            </div>
            <div className="kv__row">
              <dt>City</dt>
              <dd>{b.listing?.city ?? '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="card">
          <h2 className="card__title">Schedule</h2>
          <dl className="kv">
            <div className="kv__row">
              <dt>Start</dt>
              <dd>{formatDateTime(b.startDate)}</dd>
            </div>
            <div className="kv__row">
              <dt>End</dt>
              <dd>{formatDateTime(b.endDate)}</dd>
            </div>
            <div className="kv__row">
              <dt>Quantity</dt>
              <dd>
                {b.quantity}
                {b.capacityUnit ? ` ${b.capacityUnit.toLowerCase()}` : ''}
              </dd>
            </div>
            {b.notes ? (
              <div className="kv__row">
                <dt>Notes</dt>
                <dd>{b.notes}</dd>
              </div>
            ) : null}
            {b.specialRequirements ? (
              <div className="kv__row">
                <dt>Special requirements</dt>
                <dd>{b.specialRequirements}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      </div>

      <div className="detail-grid">
        <section className="card">
          <h2 className="card__title">Pricing</h2>
          {pricing ? (
            <>
              <p className="muted">{pricing.rateDescription}</p>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Line</th>
                      <th className="align-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pricing.breakdown ?? []).map((line, i) => (
                      <tr key={i}>
                        <td data-label="Line">{line.label}</td>
                        <td data-label="Amount" className="align-right">
                          {formatMoney(line.amount, pricing.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl className="kv kv--tight">
                <div className="kv__row">
                  <dt>Subtotal</dt>
                  <dd>{formatMoney(pricing.subtotal, pricing.currency)}</dd>
                </div>
                <div className="kv__row">
                  <dt>Platform fee</dt>
                  <dd>{formatMoney(pricing.platformFee, pricing.currency)}</dd>
                </div>
                <div className="kv__row">
                  <dt>Taxes</dt>
                  <dd>{formatMoney(pricing.taxes, pricing.currency)}</dd>
                </div>
                <div className="kv__row">
                  <dt>Discount</dt>
                  <dd>−{formatMoney(pricing.discount, pricing.currency)}</dd>
                </div>
                <div className="kv__row kv__row--strong">
                  <dt>Total</dt>
                  <dd>{formatMoney(pricing.total, pricing.currency)}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="muted">No pricing recorded.</p>
          )}
        </section>

        <section className="card">
          <h2 className="card__title">Timeline</h2>
          <ol className="timeline">
            {(b.statusHistory ?? []).map((event, i) => (
              <li key={i} className="timeline__item">
                <span className="timeline__dot" aria-hidden="true" />
                <div className="timeline__body">
                  <div className="timeline__head">
                    <StatusBadge status={event.status} group="booking" />
                    <span className="muted">{formatDateTime(event.at)}</span>
                  </div>
                  {event.note ? <p className="timeline__note">{event.note}</p> : null}
                  {event.byRole ? <p className="muted">by {event.byRole.toLowerCase()}</p> : null}
                </div>
              </li>
            ))}
            {(!b.statusHistory || b.statusHistory.length === 0) ? <p className="muted">No history.</p> : null}
          </ol>
        </section>
      </div>

      <ReasonDialog
        open={cancelOpen}
        title="Cancel booking"
        message={
          <>
            Cancelling <strong>{b.reference}</strong> notifies both parties and may trigger a refund depending on the
            cancellation policy.
          </>
        }
        reasonLabel="Cancellation reason"
        placeholder="Explain why this booking is being cancelled…"
        requireReason
        maxLength={600}
        confirmLabel="Cancel booking"
        busy={busy}
        serverError={serverError}
        onConfirm={(reason) => void cancelBooking(reason)}
        onCancel={() => setCancelOpen(false)}
      />
    </>
  );
}
