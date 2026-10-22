import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../components/States';
import { useToast } from '../components/Toast';
import { apiSend } from '../lib/api';
import { errorMessage, usePagedList } from '../lib/hooks';
import { formatDate, shortenId } from '../lib/format';
import type { RawReviewDoc } from '../lib/types';

/**
 * The reviews endpoint returns a hydrated DTO (`id`, `listingId`, `bookingId`,
 * `author: { id, name, … }`) while older payloads used raw ObjectIds. Render
 * both shapes safely.
 */
type ReviewRow = Omit<RawReviewDoc, '_id' | 'id' | 'author' | 'listing' | 'booking'> &
  Partial<Pick<RawReviewDoc, '_id' | 'id' | 'listing' | 'booking'>> & {
    author: string | { id?: string; name?: string | null };
    listingId?: string;
    bookingId?: string;
    listingTitle?: string;
  };

const reviewId = (r?: ReviewRow | null): string => r?.id ?? r?._id ?? '';

type ModerationStatus = 'PUBLISHED' | 'HIDDEN' | 'REMOVED';

export function ReviewsPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') ?? '1') || 1;
  const limit = Number(params.get('limit') ?? '20') || 20;
  const toast = useToast();

  const { items, pagination, loading, error, reload } = usePagedList<ReviewRow>('/admin/reviews', {
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

  // ---- moderation (reviewModerationSchema) ----
  const [target, setTarget] = useState<{ review: ReviewRow; status: ModerationStatus } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const moderate = async () => {
    if (!target) return;
    setBusy(true);
    setServerError(null);
    try {
      await apiSend('POST', `/admin/reviews/${reviewId(target.review)}/moderate`, {
        status: target.status,
        note: note.trim() || null,
      });
      toast.success(`Review marked ${target.status.toLowerCase()}.`);
      setTarget(null);
      setNote('');
      reload();
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const statusActions = (current: string): ModerationStatus[] =>
    (['PUBLISHED', 'HIDDEN', 'REMOVED'] as ModerationStatus[]).filter((s) => s !== current);

  return (
    <>
      <PageHeader
        title="Reviews"
        subtitle="Moderate customer reviews across the marketplace"
        actions={
          <select className="select select--sm" value={''} onChange={(e) => setParam('status', e.target.value)} aria-label="Filter by status (server-side not supported)" disabled>
            <option value="">All statuses</option>
          </select>
        }
      />

      <section className="card">
        {loading ? (
          <Skeleton rows={5} />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : items.length === 0 ? (
          <EmptyState title="No reviews" hint="No reviews have been submitted yet." />
        ) : (
          <>
            <div className="review-list">
              {items.map((r) => (
                <article key={reviewId(r)} className="review-item">
                  <div className="review-item__main">
                    <div className="review-item__head">
                      <span className="review-item__stars" aria-label={`${r.rating} out of 5`}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={15}
                            aria-hidden="true"
                            className={i < r.rating ? 'star star--on' : 'star'}
                            fill={i < r.rating ? 'currentColor' : 'none'}
                          />
                        ))}
                      </span>
                      <StatusBadge status={r.status} tone={r.status === 'PUBLISHED' ? 'success' : r.status === 'REMOVED' ? 'danger' : 'warning'} />
                      <span className="muted">{formatDate(r.createdAt)}</span>
                    </div>
                    <p className="review-item__comment">{r.comment ?? <em className="muted">No comment.</em>}</p>
                    <p className="review-item__meta muted">
                      Listing <code>{shortenId(r.listing ?? r.listingId)}</code> · booking{' '}
                      <code>{shortenId(r.booking ?? r.bookingId)}</code> · author{' '}
                      <code>
                        {typeof r.author === 'string'
                          ? shortenId(r.author)
                          : (r.author?.name ?? shortenId(r.author?.id))}
                      </code>
                    </p>
                    {r.response ? <p className="review-item__response">Partner response: {r.response.text}</p> : null}
                  </div>
                  <div className="review-item__actions">
                    {statusActions(r.status).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`btn btn--sm ${s === 'PUBLISHED' ? 'btn--primary' : 'btn--danger-ghost'}`}
                        onClick={() => {
                          setServerError(null);
                          setNote('');
                          setTarget({ review: r, status: s });
                        }}
                      >
                        {s === 'PUBLISHED' ? 'Publish' : s === 'HIDDEN' ? 'Hide' : 'Remove'}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <Pagination
              meta={pagination}
              limit={limit}
              onPageChange={(p) => {
                const next = new URLSearchParams(params);
                next.set('page', String(p));
                setParams(next, { replace: true });
              }}
            />
          </>
        )}
      </section>

      <Modal
        open={target !== null}
        title={target ? `Mark review ${target.status.toLowerCase()}` : ''}
        onClose={() => setTarget(null)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setTarget(null)} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className={`btn ${target?.status === 'PUBLISHED' ? 'btn--primary' : 'btn--danger'}`}
              onClick={() => void moderate()}
              disabled={busy}
            >
              {busy ? 'Saving…' : 'Confirm'}
            </button>
          </>
        }
      >
        <p className="confirm-message">
          Review <code>{shortenId(reviewId(target?.review))}</code> will be marked{' '}
          <strong>{target?.status.toLowerCase()}</strong>.
        </p>
        <div className="field">
          <label className="field__label" htmlFor="review-note">
            Note <span className="field__hint-inline">(optional, max 400 — recorded in the audit log)</span>
          </label>
          <textarea id="review-note" className="textarea" rows={3} maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {serverError ? (
          <p className="field__error" role="alert">
            {serverError}
          </p>
        ) : null}
      </Modal>
    </>
  );
}
