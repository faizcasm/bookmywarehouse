import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { api, type Pagination as PaginationMeta } from '../lib/api';
import { formatDate, formatMoney } from '../lib/format';
import { BOOKING_STATUSES, type BookingDTO } from '../lib/types';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, ListSkeleton } from '../components/States';
import { fadeUp, stagger } from '@bmw/ui';

export function BookingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') ?? '';
  const page = Number(searchParams.get('page') ?? 1);
  const limit = Number(searchParams.get('limit') ?? 10);

  const [items, setItems] = useState<BookingDTO[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.list<BookingDTO>('/bookings', {
        status: status || undefined,
        page,
        limit,
      });
      setItems(result.items);
      setPagination(result.pagination);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [status, page, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateParams(patch: Record<string, string | number | undefined>): void {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    }
    setSearchParams(next);
  }

  const columns: Column<BookingDTO>[] = [
    {
      key: 'reference',
      header: 'Reference',
      render: (row) => (
        <div>
          <Link to={`/bookings/${row.id}`} className="link-strong">
            {row.reference}
          </Link>
          <div className="muted">{row.listing?.title}</div>
        </div>
      ),
    },
    { key: 'customer', header: 'Customer', render: (row) => row.customer?.name ?? '—' },
    {
      key: 'dates',
      header: 'Dates',
      render: (row) => (
        <span>
          {formatDate(row.startDate)}
          {row.endDate ? ` → ${formatDate(row.endDate)}` : ''}
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} kind="booking" /> },
    {
      key: 'total',
      header: 'Total',
      align: 'end',
      render: (row) => formatMoney(row.pricing?.total, row.pricing?.currency),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <Link className="btn btn--ghost btn--sm" to={`/bookings/${row.id}`}>
          View
        </Link>
      ),
    },
  ];

  return (
    <div className="page">
      <motion.div className="page__intro" variants={fadeUp} initial="hidden" animate="show">
        <h2>Bookings</h2>
        <p className="muted">View and manage all booking requests and confirmed reservations for your listings.</p>
      </motion.div>

      <motion.div className="page__toolbar" variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.1 }}>
        <div className="filters">
          <label className="filters__select">
            <span className="sr-only">Filter by status</span>
            <select className="input" value={status} onChange={(event) => updateParams({ status: event.target.value, page: 1 })}>
              <option value="">All statuses</option>
              {BOOKING_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value.replace('_', ' ').toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          {status ? (
            <button type="button" className="btn btn--ghost" onClick={() => updateParams({ status: undefined, page: 1 })}>
              Clear filter
            </button>
          ) : null}
        </div>
      </motion.div>

      {loading ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void load()} title="Could not load bookings" />
      ) : (
        <>
          <motion.div
            className="card card--flush"
            variants={stagger(0.05)}
            initial="hidden"
            animate="show"
          >
            {items.length === 0 ? (
              <EmptyState
                title={status ? 'No bookings with this status' : 'No bookings yet'}
                description={
                  status
                    ? 'Try a different status filter.'
                    : 'Booking requests from customers will appear here once your listings are live.'
                }
                action={
                  status ? (
                    <button type="button" className="btn btn--secondary" onClick={() => updateParams({ status: undefined, page: 1 })}>
                      Show all bookings
                    </button>
                  ) : (
                    <Link to="/listings" className="btn btn--primary">
                      Manage listings
                    </Link>
                  )
                }
              />
            ) : (
              <DataTable columns={columns} rows={items} rowKey={(row) => row.id} caption="Bookings" />
            )}
          </motion.div>
          <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.2 }}>
            <Pagination
              pagination={pagination}
              onPage={(nextPage) => updateParams({ page: nextPage })}
              onLimit={(nextLimit) => updateParams({ limit: nextLimit, page: 1 })}
            />
          </motion.div>
        </>
      )}
    </div>
  );
}

export default BookingsPage;