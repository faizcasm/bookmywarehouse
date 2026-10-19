import type { PaginationMeta } from '../lib/types';

export interface PaginationProps {
  pagination?: PaginationMeta | null;
  onPageChange: (page: number) => void;
}

function pageWindow(page: number, totalPages: number): (number | 'gap')[] {
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const output: (number | 'gap')[] = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous && p - previous > 1) output.push('gap');
    output.push(p);
    previous = p;
  }
  return output;
}

export function Pagination({ pagination, onPageChange }: PaginationProps) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, hasPreviousPage, hasNextPage, total, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination-summary">
        Showing {from}–{to} of {total}
      </span>
      <div className="pagination-pages">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPreviousPage}
        >
          ← Prev
        </button>
        {pageWindow(page, totalPages).map((entry, index) =>
          typeof entry === 'number' ? (
            <button
              key={entry}
              type="button"
              className={`page-btn ${entry === page ? 'is-active' : ''}`}
              aria-label={`Page ${entry}`}
              aria-current={entry === page ? 'page' : undefined}
              onClick={() => onPageChange(entry)}
            >
              {entry}
            </button>
          ) : (
            <span key={`gap-${index}`} className="page-gap" aria-hidden="true">
              …
            </span>
          ),
        )}
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNextPage}
        >
          Next →
        </button>
      </div>
    </nav>
  );
}
