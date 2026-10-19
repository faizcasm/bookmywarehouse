import type { Pagination as PaginationMeta } from '../lib/api';

interface PaginationProps {
  meta: PaginationMeta | undefined | null;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  limit?: number;
}

const LIMITS = [10, 20, 50];

export function Pagination({ meta, onPageChange, onLimitChange, limit }: PaginationProps) {
  if (!meta || meta.total === 0) return null;
  const { page, totalPages, total, hasNextPage, hasPreviousPage } = meta;

  return (
    <div className="pagination">
      <span className="pagination__info">
        Page {page} of {Math.max(totalPages, 1)} · {total.toLocaleString('en-IN')} total
      </span>
      <div className="pagination__controls">
        {onLimitChange ? (
          <label className="pagination__limit">
            <span>Rows</span>
            <select
              className="select select--sm"
              value={limit ?? meta.limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {LIMITS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPreviousPage}
        >
          ← Prev
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNextPage}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
