import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import { formatDayRange, formatMoney, listingTypeLabel } from '../lib/format';
import type { BookingDTO } from '../lib/types';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, PageLoader } from '../components/Skeleton';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'PENDING_APPROVAL', label: 'Pending' },
  { value: 'AWAITING_PAYMENT', label: 'Awaiting payment' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'DISPUTED', label: 'Disputed' },
];

export function BookingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? '';
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10) || 1;

  const bookings = useAsyncData(() => api.getWithMeta<BookingDTO[]>('/bookings', { status: status || undefined, page, limit: 10 }), [
    status,
    page,
  ]);

  const tabs = useMemo(() => STATUS_TABS, []);

  const paramsFor = (nextStatus: string, nextPage = 1): URLSearchParams => {
    const params = new URLSearchParams();
    if (nextStatus) params.set('status', nextStatus);
    if (nextPage > 1) params.set('page', String(nextPage));
    return params;
  };

  return (
    <div className="container page">
      <div className="page-head">
        <h1>My bookings</h1>
        <p className="muted">Track requests, payments and completed bookings.</p>
      </div>

      <div className="tabs" role="tablist" aria-label="Booking status">
        {tabs.map((tab) => (
          <button
            key={tab.value || 'ALL'}
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            className={`tab ${status === tab.value ? 'is-active' : ''}`}
            onClick={() => setSearchParams(paramsFor(tab.value))}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {bookings.loading ? (
        <PageLoader label="Loading bookings…" />
      ) : bookings.error ? (
        <ErrorState message={bookings.error.message} onRetry={bookings.reload} />
      ) : (bookings.data?.data ?? []).length === 0 ? (
        <EmptyState
          title={status ? 'No bookings with this status' : 'No bookings yet'}
          message={status ? 'Try another status tab.' : 'When you request a booking it will show up here.'}
          action={
            <Link to="/search" className="btn btn-primary">
              Explore listings
            </Link>
          }
        />
      ) : (
        <>
          <ul className="booking-list">
            {(bookings.data?.data ?? []).map((booking) => (
              <li key={booking.id} className="card booking-row">
                <div className="booking-row-media">
                  {booking.listing.coverImage ? (
                    <img src={booking.listing.coverImage} alt="" loading="lazy" />
                  ) : (
                    <div className="listing-media-placeholder">{listingTypeLabel(booking.listing.type)}</div>
                  )}
                </div>
                <div className="booking-row-main">
                  <div className="booking-row-head">
                    <Link to={`/bookings/${booking.id}`} className="booking-title">
                      {booking.listing.title}
                    </Link>
                    <StatusBadge status={booking.status} />
                  </div>
                  <p className="muted">
                    {booking.reference} · {listingTypeLabel(booking.type)} · {booking.listing.city}
                  </p>
                  <p>
                    {formatDayRange(booking.startDate, booking.endDate)} · {booking.quantity} ×{' '}
                    {booking.capacityUnit ?? 'unit'}
                  </p>
                </div>
                <div className="booking-row-side">
                  <strong className="booking-total">{formatMoney(booking.pricing.total, booking.pricing.currency)}</strong>
                  <Link to={`/bookings/${booking.id}`} className="btn btn-outline btn-sm">
                    View details
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          <Pagination pagination={bookings.data?.meta?.pagination ?? null} onPageChange={(next) =>
            setSearchParams(paramsFor(status, next))
          } />
        </>
      )}
    </div>
  );
}
