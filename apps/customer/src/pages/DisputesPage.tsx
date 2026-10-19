import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import { formatDateTime, humanize } from '../lib/format';
import type { DisputeDTO } from '../lib/types';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, ErrorState, PageLoader } from '../components/Skeleton';

export function DisputesPage() {
  const disputes = useAsyncData(() => api.getWithMeta<{ items: DisputeDTO[]; total: number }>('/disputes', { limit: 20 }), []);
  const items = disputes.data?.data?.items ?? [];

  return (
    <div className="container page">
      <div className="page-head">
        <h1>Disputes</h1>
        <p className="muted">
          {typeof disputes.data?.data?.total === 'number'
            ? `${disputes.data.data.total} dispute${disputes.data.data.total === 1 ? '' : 's'} raised by you.`
            : 'Disputes you have raised against bookings.'}
        </p>
      </div>

      {disputes.loading ? (
        <PageLoader label="Loading disputes…" />
      ) : disputes.error ? (
        <ErrorState message={disputes.error.message} onRetry={disputes.reload} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No disputes"
          message="If a booking goes wrong you can raise a dispute from the booking detail page."
          action={
            <Link to="/bookings" className="btn btn-outline">
              View my bookings
            </Link>
          }
        />
      ) : (
        <ul className="card-list">
          {items.map((dispute) => (
            <li key={dispute.id} className="card section-card dispute-card">
              <div className="booking-row-head">
                <strong className="mono">{dispute.reference}</strong>
                <StatusBadge status={dispute.status} kind="dispute" />
              </div>
              <p className="muted">
                Booking{' '}
                <Link to={`/bookings/${dispute.bookingId}`} className="mono">
                  {dispute.bookingReference}
                </Link>{' '}
                · Reason: <strong>{humanize(dispute.reason)}</strong> · Against {humanize(dispute.againstParty)}
              </p>
              <p>{dispute.description}</p>
              {dispute.resolutionNote ? (
                <p className="form-success">Resolution: {dispute.resolutionNote}</p>
              ) : null}
              <p className="muted">
                Opened {formatDateTime(dispute.createdAt)} · Updated {formatDateTime(dispute.updatedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
