import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { fadeUp, stagger } from '@bmw/ui';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Hide this column on narrow screens (card layout and < 1024px). */
  secondary?: boolean;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  /** Rendered when rows is empty (and not loading). */
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

/**
 * Dense admin table. Below 760px it degrades to stacked cards using
 * data-label attributes (see styles.css).
 * Rows stagger in on mount for a polished entrance.
 */
export function DataTable<T>({ columns, rows, getRowKey, emptyMessage = 'No records found.', onRowClick }: DataTableProps<T>) {
  if (rows.length === 0) {
    return <div className="table-empty">{emptyMessage}</div>;
  }
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={c.width ? { width: c.width } : undefined} className={c.secondary ? 'col-secondary' : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <motion.tr
              key={getRowKey(row)}
              className={onRowClick ? 'row-clickable' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              transition={{ delay: rowIndex * 0.04, duration: Math.min(0.2 + rowIndex * 0.01, 0.4) }}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  data-label={c.header}
                  className={[
                    c.align ? `align-${c.align}` : '',
                    c.secondary ? 'col-secondary' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {c.render(row)}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}