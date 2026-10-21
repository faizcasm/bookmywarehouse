import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { motion } from 'motion/react';
import { fadeUp, stagger } from '@bmw/ui';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, PageHeader, Skeleton } from '../components/States';
import { useToast } from '../components/Toast';
import { usePagedList, errorMessage } from '../lib/hooks';
import { apiGetBlob } from '../lib/api';
import { downloadBlob, exportCsvFilename } from '../lib/csv';
import { STATUS_OPTIONS, formatDate, formatMoney } from '../lib/format';
import type { BookingDTO } from '../lib/types';

export function BookingsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const type = params.get('type') ?? '';
  const q = params.get('q') ?? '';
  const page = Number(params.get('page') ?? '1') || 1;
  const limit = Number(params.get('limit') ?? '20') || 20;
  const [searchDraft, setSearchDraft] = useState(q);
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const blob = await apiGetBlob('/admin/exports/bookings.csv');
      downloadBlob(blob, exportCsvFilename('bookings'));
      toast.success('Bookings CSV downloaded.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  // Admin booking list lives at /bookings?scope=admin (API_REFERENCE §5) —
  // there is no /admin/bookings endpoint.
  const { items, pagination, loading, error, reload } = usePagedList<BookingDTO>('/bookings', {
    scope: 'admin',
    status: status || undefined,
    type: type || undefined,
    q: q || undefined,
    page,
    limit,
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const columns: Column<BookingDTO>[] = [
    {
      key: 'reference',
      header: 'Reference',
      render: (b) => (
        <Link to={`/bookings/${b.id}`} className="cell-link">
          <code>{b.reference}</code>
        </Link>
      ),
    },
    {
      key: 'listing',
      header: 'Listing',
      render: (b) => (
        <div className="cell-stack">
          <span>{b.listing?.title ?? '—'}</span>
          <span className="muted">{b.listing?.city ?? ''}</span>
        </div>
      ),
    },
    { key: 'customer', header: 'Customer', render: (b) => b.customer?.name ?? '—' },
    { key: 'partner', header: 'Partner', secondary: true, render: (b) => b.partner?.businessName ?? '—' },
    { key: 'status', header: 'Status', render: (b) => <StatusBadge status={b.status} group="booking" /> },
    { key: 'dates', header: 'Dates', secondary: true, render: (b) => `${formatDate(b.startDate)} → ${formatDate(b.endDate)}` },
    { key: 'total', header: 'Total', align: 'right', render: (b) => formatMoney(b.pricing?.total, b.pricing?.currency) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (b) => (
        <Link className="btn btn--ghost btn--sm" to={`/bookings/${b.id}`}>
          View
        </Link>
      ),
    },
  ];

  return (
    <>
      <motion.header variants={fadeUp} initial="hidden" animate="show">
        <PageHeader
          title="Bookings"
          subtitle="All marketplace bookings across every partner"
          actions={
            <button type="button" className="btn btn--ghost" onClick={() => void handleExportCsv()} disabled={exporting}>
              <Download aria-hidden="true" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          }
        />
      </motion.header>

      <motion.div className="toolbar glass-inset" variants={stagger(0.05)} initial="hidden" animate="show">
        <form
          className="toolbar__search"
          onSubmit={(e) => {
            e.preventDefault();
            setParam('q', searchDraft.trim());
          }}
        >
          <input
            className="input"
            type="search"
            placeholder="Search reference, listing or customer…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            aria-label="Search bookings"
          />
          <button type="submit" className="btn btn--ghost btn--sm">
            Search
          </button>
        </form>
        <select className="select" value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Filter by status">
          {STATUS_OPTIONS.booking.map((s) => (
            <option key={s} value={s}>
              {s === '' ? 'All statuses' : s}
            </option>
          ))}
        </select>
        <select className="select" value={type} onChange={(e) => setParam('type', e.target.value)} aria-label="Filter by type">
          {STATUS_OPTIONS.listingType.map((t) => (
            <option key={t} value={t}>
              {t === '' ? 'All types' : t}
            </option>
          ))}
        </select>
      </motion.div>

      <motion.section className="card" variants={fadeUp} initial="hidden" animate="show">
        {loading ? (
          <Skeleton rows={6} />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <>
            <DataTable columns={columns} rows={items} getRowKey={(b) => b.id} emptyMessage="No bookings match these filters." />
            <Pagination
              meta={pagination}
              limit={limit}
              onPageChange={(p) => setParam('page', String(p))}
              onLimitChange={(l) => {
                const next = new URLSearchParams(params);
                next.set('limit', String(l));
                next.delete('page');
                setParams(next, { replace: true });
              }}
            />
          </>
        )}
      </motion.section>
    </>
  );
}
