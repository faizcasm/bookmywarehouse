import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, PageHeader, Skeleton } from '../components/States';
import { usePagedList } from '../lib/hooks';
import { STATUS_OPTIONS, formatDate, formatNumber } from '../lib/format';
import type { AdminPartnerListItem } from '../lib/types';

export function PartnersPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const verificationStatus = params.get('verificationStatus') ?? '';
  const page = Number(params.get('page') ?? '1') || 1;
  const limit = Number(params.get('limit') ?? '20') || 20;
  const [searchDraft, setSearchDraft] = useState(q);

  const { items, pagination, loading, error, reload } = usePagedList<AdminPartnerListItem>('/admin/partners', {
    q: q || undefined,
    verificationStatus: verificationStatus || undefined,
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

  const columns: Column<AdminPartnerListItem>[] = [
    {
      key: 'business',
      header: 'Business',
      render: (p) => (
        <div className="cell-stack">
          <Link to={`/partners/${p.partnerId}`} className="cell-link">
            <strong>{p.businessName}</strong>
          </Link>
          <span className="muted">{p.user?.email ?? '—'}</span>
        </div>
      ),
    },
    {
      key: 'verification',
      header: 'Verification',
      render: (p) => <StatusBadge status={p.verificationStatus} group="verification" />,
    },
    { key: 'owner', header: 'Owner', secondary: true, render: (p) => p.user?.name ?? '—' },
    { key: 'city', header: 'City', render: (p) => p.city ?? '—' },
    { key: 'listings', header: 'Listings', align: 'right', render: (p) => formatNumber(p.listingCount) },
    { key: 'bookings', header: 'Bookings', align: 'right', secondary: true, render: (p) => formatNumber(p.totalBookings) },
    { key: 'created', header: 'Joined', secondary: true, render: (p) => formatDate(p.createdAt) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (p) => (
        <Link className="btn btn--ghost btn--sm" to={`/partners/${p.partnerId}`}>
          Manage
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Partners" subtitle="Business accounts, verification and listings" />

      <div className="toolbar">
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
            placeholder="Search by business name…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            aria-label="Search partners"
          />
          <button type="submit" className="btn btn--ghost btn--sm">
            Search
          </button>
        </form>
        <select
          className="select"
          value={verificationStatus}
          onChange={(e) => setParam('verificationStatus', e.target.value)}
          aria-label="Filter by verification status"
        >
          {STATUS_OPTIONS.verification.map((s) => (
            <option key={s} value={s}>
              {s === '' ? 'All verifications' : s}
            </option>
          ))}
        </select>
        <Link to="/verification-queue" className="btn btn--ghost btn--sm">
          Verification queue
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>

      <section className="card">
        {loading ? (
          <Skeleton rows={5} />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <>
            <DataTable columns={columns} rows={items} getRowKey={(p) => p.partnerId} emptyMessage="No partners match these filters." />
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
      </section>
    </>
  );
}
