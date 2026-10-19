import type { Pagination as PaginationMeta } from '../lib/api';

export function Pagination({
  pagination,
  onPage,
  onLimit,
  limits = [10, 20, 50],
}: {
  pagination: PaginationMeta | null;
  onPage: (page: number) => void;
  onLimit?: (limit: number) => void;
  limits?: number[];
}) {
  if (!pagination) return null;
  const { page, totalPages, total, limit, hasNextPage, hasPreviousPage } = pagination;
  if (total === 0) return null;

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination__summary">
        Page {page} of {Math.max(totalPages, 1)} · {total} result{total === 1 ? '' : 's'}
      </span>
      <div className="pagination__controls">
        {onLimit ? (
          <label className="pagination__limit">
            Per page
            <select value={limit} onChange={(event) => onLimit(Number(event.target.value))}>
              {limits.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="button" className="btn btn--ghost" onClick={() => onPage(page - 1)} disabled={!hasPreviousPage}>
          ← Prev
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => onPage(page + 1)} disabled={!hasNextPage}>
          Next →
        </button>
      </div>
    </nav>
  );
}
