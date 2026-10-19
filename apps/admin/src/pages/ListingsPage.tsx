import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Pagination } from '../components/Pagination';
import { ReasonDialog } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../components/States';
import { useToast } from '../components/Toast';
import { apiSend } from '../lib/api';
import { errorMessage, usePagedList } from '../lib/hooks';
import { STATUS_OPTIONS, formatMoney } from '../lib/format';
import type { AdminListingItem } from '../lib/types';

type ListingDecision = 'APPROVE' | 'REJECT' | 'SUSPEND' | 'UNSUSPEND';

interface PendingAction {
  listing: AdminListingItem;
  decision: ListingDecision;
}

export function ListingsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const type = params.get('type') ?? '';
  const q = params.get('q') ?? '';
  const page = Number(params.get('page') ?? '1') || 1;
  const limit = Number(params.get('limit') ?? '12') || 12;
  const [searchDraft, setSearchDraft] = useState(q);
  const toast = useToast();

  const { items, pagination, loading, error, reload } = usePagedList<AdminListingItem>('/admin/listings', {
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

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const runDecision = async (reason: string) => {
    if (!pending) return;
    setBusy(true);
    setServerError(null);
    try {
      await apiSend('PATCH', `/admin/listings/${pending.listing.id}`, {
        decision: pending.decision,
        reason: reason || null,
      });
      toast.success(`${pending.listing.title}: ${pending.decision.toLowerCase()} recorded.`);
      setPending(null);
      reload();
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const actionsFor = (l: AdminListingItem): ListingDecision[] => {
    switch (l.status) {
      case 'PENDING_REVIEW':
      case 'DRAFT':
      case 'UNPUBLISHED':
        return ['APPROVE', 'REJECT', 'SUSPEND'];
      case 'PUBLISHED':
        return ['SUSPEND', 'REJECT'];
      case 'REJECTED':
        return ['APPROVE', 'SUSPEND'];
      case 'SUSPENDED':
        return ['UNSUSPEND', 'REJECT'];
      case 'ARCHIVED':
        return ['APPROVE'];
      default:
        return [];
    }
  };

  const decisionLabel: Record<ListingDecision, string> = {
    APPROVE: 'Approve',
    REJECT: 'Reject',
    SUSPEND: 'Suspend',
    UNSUSPEND: 'Unsuspend',
  };

  return (
    <>
      <PageHeader title="Listings" subtitle="Moderate marketplace inventory" />

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
            placeholder="Search title or city…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            aria-label="Search listings"
          />
          <button type="submit" className="btn btn--ghost btn--sm">
            Search
          </button>
        </form>
        <select className="select" value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Filter by status">
          {STATUS_OPTIONS.listing.map((s) => (
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
      </div>

      {loading ? (
        <Skeleton rows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState title="No listings" hint="No listings match the current filters." />
      ) : (
        <>
          <div className="listing-grid listing-grid--admin">
            {items.map((l) => (
              <article key={l.id} className="card listing-card">
                {l.coverImage ? (
                  <img src={l.coverImage} alt="" className="listing-card__img" loading="lazy" />
                ) : (
                  <div className="listing-card__img listing-card__img--placeholder" aria-hidden="true">
                    📦
                  </div>
                )}
                <div className="listing-card__body">
                  <div className="listing-card__top">
                    <h3 className="listing-card__title">{l.title}</h3>
                    <StatusBadge status={l.status} group="listing" />
                  </div>
                  <p className="listing-card__meta">
                    {l.type} · {l.city}
                    {l.categoryName ? ` · ${l.categoryName}` : ''}
                  </p>
                  <p className="listing-card__partner">
                    Partner:{' '}
                    <Link to={`/partners/${l.partner.id}`} className="cell-link">
                      {l.partner.businessName}
                    </Link>
                    {!l.partner.verified ? <span className="badge badge--warning">Unverified</span> : null}
                  </p>
                  <p className="listing-card__price">
                    {formatMoney(l.price.amount, l.price.currency)}{' '}
                    {l.price.unitLabel ?? (l.price.period ? `/ ${l.price.period.toLowerCase()}` : '')}
                  </p>
                  <div className="cell-actions">
                    {actionsFor(l).map((decision) => (
                      <button
                        key={decision}
                        type="button"
                        className={`btn btn--sm ${decision === 'APPROVE' || decision === 'UNSUSPEND' ? 'btn--primary' : 'btn--danger-ghost'}`}
                        onClick={() => {
                          setServerError(null);
                          setPending({ listing: l, decision });
                        }}
                      >
                        {decisionLabel[decision]}
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
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

      <ReasonDialog
        open={pending !== null}
        title={`${decisionLabel[pending?.decision ?? 'APPROVE']} listing`}
        message={
          pending ? (
            <>
              <strong>{pending.listing.title}</strong> by {pending.listing.partner.businessName} will be marked{' '}
              {pending.decision === 'APPROVE'
                ? 'published'
                : pending.decision === 'REJECT'
                  ? 'rejected'
                  : pending.decision === 'SUSPEND'
                    ? 'suspended'
                    : 'published again'}
              .
            </>
          ) : null
        }
        requireReason={pending?.decision === 'REJECT'}
        reasonLabel={pending?.decision === 'REJECT' ? 'Rejection reason' : 'Reason'}
        confirmLabel={pending ? decisionLabel[pending.decision] : 'Confirm'}
        danger={pending?.decision === 'REJECT' || pending?.decision === 'SUSPEND'}
        busy={busy}
        serverError={serverError}
        onConfirm={(reason) => void runDecision(reason)}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
