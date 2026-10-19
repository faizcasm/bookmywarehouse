import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage, isApiError, type Pagination as PaginationMeta } from '../lib/api';
import { formatDate, formatNumber } from '../lib/format';
import type { ReviewDTO } from '../lib/types';
import { Pagination } from '../components/Pagination';
import { Modal } from '../components/Modal';
import { RatingStars, StatusBadge } from '../components/StatusBadge';
import { EmptyState, ErrorState, ListSkeleton } from '../components/States';
import { useToast } from '../components/Toast';

export function ReviewsPage() {
  const toast = useToast();
  const [items, setItems] = useState<ReviewDTO[]>([]);
  const [average, setAverage] = useState<number | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [page, setPage] = useState(1);

  const [respondTarget, setRespondTarget] = useState<ReviewDTO | null>(null);
  const [respondText, setRespondText] = useState('');
  const [respondError, setRespondError] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.list<ReviewDTO, { items: ReviewDTO[]; average?: number }>('/me/reviews', { page, limit: 10 });
      setItems(result.items);
      setPagination(result.pagination);
      setAverage(typeof result.data.average === 'number' ? result.data.average : null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  function openRespond(review: ReviewDTO): void {
    setRespondTarget(review);
    setRespondText(review.response?.text ?? '');
    setRespondError(null);
  }

  async function submitResponse(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!respondTarget) return;
    if (!respondText.trim()) {
      setRespondError('A response cannot be empty');
      return;
    }
    setResponding(true);
    try {
      await api.post(`/reviews/${respondTarget.id}/respond`, { text: respondText.trim() });
      toast.success('Response published.');
      setRespondTarget(null);
      await load();
    } catch (error) {
      if (isApiError(error) && error.issues.length > 0) setRespondError(error.issues[0]?.message ?? error.message);
      else setRespondError(errorMessage(error, 'Could not publish the response'));
    } finally {
      setResponding(false);
    }
  }

  return (
    <div className="page">
      <section className="card reviews-summary" aria-label="Rating summary">
        <div className="reviews-summary__score">
          <span className="reviews-summary__number">{average !== null && average > 0 ? average.toFixed(1) : '—'}</span>
          <RatingStars value={average ?? 0} count={pagination?.total ?? 0} />
        </div>
        <p className="muted">
          Reviews are left by customers on completed bookings and apply to your listings.
          {pagination ? ` ${formatNumber(pagination.total)} review${pagination.total === 1 ? '' : 's'} in total.` : ''}
        </p>
      </section>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void load()} title="Could not load reviews" />
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState title="No reviews yet" description="Reviews appear after customers complete bookings on your listings." />
        </div>
      ) : (
        <>
          <div className="review-list">
            {items.map((review) => (
              <article key={review.id} className="card review-card">
                <header className="review-card__header">
                  <div>
                    <RatingStars value={review.rating} />
                    <div className="muted">
                      {review.author?.name} · {formatDate(review.createdAt)}
                    </div>
                  </div>
                  <div className="review-card__header-right">
                    <span className="muted">{review.listingTitle}</span>
                    <StatusBadge value={review.status} kind="review" />
                  </div>
                </header>
                {review.comment ? <p className="review-card__comment">{review.comment}</p> : null}
                {review.response ? (
                  <div className="review-card__response">
                    <strong>Your response</strong>
                    <p>{review.response.text}</p>
                    <span className="muted">{formatDate(review.response.at)}</span>
                  </div>
                ) : null}
                <div className="review-card__actions">
                  <button type="button" className="btn btn--secondary btn--sm" onClick={() => openRespond(review)}>
                    {review.response ? 'Edit response' : 'Respond'}
                  </button>
                </div>
              </article>
            ))}
          </div>
          <Pagination pagination={pagination} onPage={setPage} />
        </>
      )}

      <Modal
        open={Boolean(respondTarget)}
        title={respondTarget ? `Respond to ${respondTarget.author?.name ?? 'customer'}` : ''}
        onClose={() => setRespondTarget(null)}
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => setRespondTarget(null)} disabled={responding}>
              Cancel
            </button>
            <button type="submit" form="respond-form" className="btn btn--primary" disabled={responding}>
              {responding ? 'Publishing…' : 'Publish response'}
            </button>
          </>
        }
      >
        <form id="respond-form" onSubmit={(event) => void submitResponse(event)}>
          <div className="field">
            <label className="field__label" htmlFor="respond-text">
              Your response
            </label>
            <textarea
              id="respond-text"
              className={`input input--textarea ${respondError ? 'input--invalid' : ''}`}
              rows={4}
              placeholder="Thank you for your feedback!"
              value={respondText}
              onChange={(event) => setRespondText(event.target.value)}
            />
            {respondError ? <span className="field__error">{respondError}</span> : null}
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default ReviewsPage;
