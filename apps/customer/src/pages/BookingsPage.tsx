import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import { formatDayRange, formatMoney, listingTypeLabel } from '../lib/format';
import type { BookingDTO } from '../lib/types';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, PageLoader } from '../components/Skeleton';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { fadeUp, stagger } from '@bmw/ui';

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

  useDocumentMeta({
    title: 'My bookings — BookMyWarehouse',
    description: 'Track your booking requests, payments and completed bookings.',
  });

  const bookings = useAsyncData(
    () => api.getWithMeta<{ items: BookingDTO[] }>('/bookings', { status: status || undefined, page, limit: 10 }),
    [status, page],
  );

  const tabs = useMemo(() => STATUS_TABS, []);

  const paramsFor = (nextStatus: string, nextPage = 1): URLSearchParams => {
    const params = new URLSearchParams();
    if (nextStatus) params.set('status', nextStatus);
    if (nextPage > 1) params.set('page', String(nextPage));
    return params;
  };

  return (
    <div className="container page">
      <motion.div className="page-head reveal" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1>My bookings</h1>
        <p className="muted">Track requests, payments and completed bookings.</p>
      </motion.div>

      <motion.div className="tabs reveal" role="tablist" aria-label="Booking status" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
        {tabs.map((tab) => (
          <motion.button
            key={tab.value || 'ALL'}
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            className={`tab ${status === tab.value ? 'is-active' : ''}`}
            onClick={() => setSearchParams(paramsFor(tab.value))}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {tab.label}
          </motion.button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        {bookings.loading ? (
          <PageLoader key="loading" label="Loading bookings…" />
        ) : bookings.error ? (
          <ErrorState key="error" message={bookings.error.message} onRetry={bookings.reload} />
        ) : (bookings.data?.data?.items ?? []).length === 0 ? (
          <motion.div
            key="empty"
            className="state-block reveal"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="state-icon" aria-hidden="true">
              📋
            </div>
            <h3 className="state-title">{status ? 'No bookings with this status' : 'No bookings yet'}</h3>
            <p className="state-message">{status ? 'Try another status tab.' : 'When you request a booking it will show up here.'}</p>
            {!status && (
              <Link to="/search" className="btn btn-primary">
                Explore listings
              </Link>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <motion.ul className="booking-list" variants={stagger(0.06)} initial="hidden" animate="show">
              {(bookings.data?.data?.items ?? []).map((booking) => (
                <motion.li key={booking.id} className="card booking-row" variants={fadeUp} whileHover={{ y: -2, boxShadow: 'var(--shadow-md)' }}>
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
                </motion.li>
              ))}
            </motion.ul>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Pagination pagination={bookings.data?.meta?.pagination ?? null} onPageChange={(next) =>
                setSearchParams(paramsFor(status, next))
              } />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}