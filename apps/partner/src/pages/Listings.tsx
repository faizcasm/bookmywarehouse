import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, type Pagination as PaginationMeta } from '../lib/api';
import { formatDayShort, formatMoney } from '../lib/format';
import { LISTING_STATUSES, LISTING_TYPES, type ListingStatus, type ListingSummaryDTO, type ListingType } from '../lib/types';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { ConfirmDialog } from '../components/Modal';
import { EmptyState, ErrorState, ListSkeleton } from '../components/States';
import { useToast } from '../components/Toast';
import { enumOptions } from '../lib/listingForm';

type RowAction = 'publish' | 'unpublish' | 'archive' | 'delete';

const CAN_PUBLISH: ListingStatus[] = ['DRAFT', 'UNPUBLISHED', 'REJECTED', 'SUSPENDED'];

export function ListingsPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const status = searchParams.get('status') ?? '';
  const type = searchParams.get('type') ?? '';
  const q = searchParams.get('q') ?? '';
  const page = Number(searchParams.get('page') ?? 1);
  const limit = Number(searchParams.get('limit') ?? 10);

  const [items, setItems] = useState<ListingSummaryDTO[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [searchDraft, setSearchDraft] = useState(q);
  const [pending, setPending] = useState<{ action: RowAction; listing: ListingSummaryDTO } | null>(null);
  const [working, setWorking] = useState(false);

  const query = useMemo(
    () => ({ status: status || undefined, type: type || undefined, q: q || undefined, page, limit }),
    [status, type, q, page, limit],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.list<ListingSummaryDTO>('/partner/listings', query);
      setItems(result.items);
      setPagination(result.pagination);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [query]);

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

  async function runAction(action: RowAction, listing: ListingSummaryDTO): Promise<void> {
    setWorking(true);
    try {
      if (action === 'publish') {
        await api.post(`/partner/listings/${listing.id}/publish`);
        toast.success('Listing submitted for review — it will go live once approved (status: PENDING_REVIEW).');
      } else if (action === 'unpublish') {
        await api.post(`/partner/listings/${listing.id}/unpublish`);
        toast.success('Listing unpublished — it is hidden from the marketplace.');
      } else if (action === 'archive') {
        await api.post(`/partner/listings/${listing.id}/archive`);
        toast.success('Listing archived.');
      } else {
        await api.del(`/partner/listings/${listing.id}`);
        toast.success('Listing deleted.');
      }
      setPending(null);
      await load();
    } catch (err) {
      toast.errorFrom(err, 'Action failed');
    } finally {
      setWorking(false);
    }
  }

  const columns: Column<ListingSummaryDTO>[] = [
    {
      key: 'title',
      header: 'Listing',
      render: (row) => (
        <div className="listing-cell">
          {row.coverImage ? <img className="listing-cell__thumb" src={row.coverImage} alt="" /> : <span className="listing-cell__thumb listing-cell__thumb--placeholder" aria-hidden="true" />}
          <div>
            <Link to={`/listings/${row.id}`} className="link-strong">
              {row.title}
            </Link>
            <div className="muted">
              {row.type} · {row.city}
              {row.categoryName ? ` · ${row.categoryName}` : ''}
            </div>
          </div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge value={row.status} kind="listing" /> },
    {
      key: 'price',
      header: 'Price',
      align: 'end',
      render: (row) => (
        <span>
          {formatMoney(row.price?.amount, row.price?.currency)}
          <span className="muted"> {row.price?.unitLabel ?? (row.price?.period ? `/${row.price.period.toLowerCase()}` : '')}</span>
        </span>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      render: (row) => (row.rating && row.rating.count > 0 ? `${row.rating.average.toFixed(1)} ★ (${row.rating.count})` : <span className="muted">New</span>),
    },
    { key: 'updated', header: 'Created', render: (row) => formatDayShort(row.createdAt), hideOnMobile: true },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="row-actions">
          <Link className="btn btn--ghost btn--sm" to={`/listings/${row.id}`}>
            Edit
          </Link>
          {CAN_PUBLISH.includes(row.status) ? (
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setPending({ action: 'publish', listing: row })}>
              Publish
            </button>
          ) : null}
          {row.status === 'PUBLISHED' ? (
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setPending({ action: 'unpublish', listing: row })}>
              Unpublish
            </button>
          ) : null}
          {row.status !== 'ARCHIVED' ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPending({ action: 'archive', listing: row })}>
              Archive
            </button>
          ) : null}
          <button type="button" className="btn btn--danger-ghost btn--sm" onClick={() => setPending({ action: 'delete', listing: row })}>
            Delete
          </button>
        </div>
      ),
    },
  ];

  const confirmCopy: Record<RowAction, { title: string; message: string; confirmLabel: string }> = {
    publish: {
      title: 'Publish listing?',
      message: 'The listing is submitted for admin review (status PENDING_REVIEW) and goes live once approved.',
      confirmLabel: 'Submit for review',
    },
    unpublish: {
      title: 'Unpublish listing?',
      message: 'The listing will be hidden from the marketplace. You can publish it again later.',
      confirmLabel: 'Unpublish',
    },
    archive: {
      title: 'Archive listing?',
      message: 'Archived listings are kept for your records but cannot be booked.',
      confirmLabel: 'Archive',
    },
    delete: {
      title: 'Delete listing?',
      message: 'This removes the listing from your account. This cannot be undone.',
      confirmLabel: 'Delete',
    },
  };

  return (
    <div className="page">
      <div className="page__toolbar">
        <form
          className="filters"
          onSubmit={(event) => {
            event.preventDefault();
            updateParams({ q: searchDraft, page: 1 });
          }}
        >
          <label className="filters__search">
            <span className="sr-only">Search listings</span>
            <input
              className="input"
              placeholder="Search by title or city…"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
            />
          </label>
          <label className="filters__select">
            <span className="sr-only">Status</span>
            <select className="input" value={status} onChange={(event) => updateParams({ status: event.target.value, page: 1 })}>
              <option value="">All statuses</option>
              {LISTING_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value.replace('_', ' ').toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="filters__select">
            <span className="sr-only">Type</span>
            <select className="input" value={type} onChange={(event) => updateParams({ type: event.target.value, page: 1 })}>
              <option value="">All types</option>
              {enumOptions(LISTING_TYPES).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn--secondary">
            Search
          </button>
          {status || type || q ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setSearchDraft('');
                setSearchParams(new URLSearchParams());
              }}
            >
              Clear
            </button>
          ) : null}
        </form>
        <Link to="/listings/new" className="btn btn--primary">
          + New listing
        </Link>
      </div>

      {loading ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void load()} title="Could not load your listings" />
      ) : (
        <>
          <div className="card card--flush">
            {items.length === 0 ? (
              <EmptyState
                title={q || status || type ? 'No listings match these filters' : 'You have no listings yet'}
                description={q || status || type ? 'Try adjusting the filters.' : 'Create your first warehouse, equipment or service listing to start receiving bookings.'}
                action={
                  <Link to="/listings/new" className="btn btn--primary">
                    Create a listing
                  </Link>
                }
              />
            ) : (
              <DataTable columns={columns} rows={items} rowKey={(row) => row.id} caption="Your listings" />
            )}
          </div>
          <Pagination
            pagination={pagination}
            onPage={(nextPage) => updateParams({ page: nextPage })}
            onLimit={(nextLimit) => updateParams({ limit: nextLimit, page: 1 })}
          />
        </>
      )}

      <ConfirmDialog
        open={Boolean(pending)}
        title={pending ? confirmCopy[pending.action].title : ''}
        message={
          pending ? (
            <>
              {confirmCopy[pending.action].message}
              <br />
              <strong>{pending.listing.title}</strong>
            </>
          ) : (
            ''
          )
        }
        confirmLabel={pending ? confirmCopy[pending.action].confirmLabel : 'Confirm'}
        danger={pending?.action === 'delete'}
        loading={working}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && void runAction(pending.action, pending.listing)}
      />
    </div>
  );
}

export default ListingsPage;
