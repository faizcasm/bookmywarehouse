import { useMemo } from 'react';

export interface ChartDatum {
  label: string;
  /** Primary value (bar height). */
  value: number;
  /** Optional secondary value shown in the tooltip. */
  secondary?: number;
}

interface SimpleBarChartProps {
  data: ChartDatum[];
  height?: number;
  barColor?: string;
  formatValue?: (value: number) => string;
  formatSecondary?: (value: number) => string;
  ariaLabel?: string;
}

/**
 * Dependency-free bar chart rendered with divs — good enough for the
 * 14-day booking/gross trends on the dashboard.
 */
export function SimpleBarChart({
  data,
  height = 160,
  barColor,
  formatValue = (v) => String(v),
  formatSecondary,
  ariaLabel = 'Trend chart',
}: SimpleBarChartProps) {
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.value)), [data]);

  if (data.length === 0) {
    return <p className="chart__empty">No trend data for this period.</p>;
  }

  return (
    <div className="chart" role="img" aria-label={ariaLabel}>
      <div className="chart__bars" style={{ height }}>
        {data.map((d) => {
          const pct = Math.round((d.value / max) * 100);
          const tip =
            `${d.label}: ${formatValue(d.value)}` +
            (d.secondary !== undefined && formatSecondary ? ` · ${formatSecondary(d.secondary)}` : '');
          return (
            <div key={d.label} className="chart__col" title={tip}>
              <div
                className="chart__bar"
                style={{ height: `${Math.max(pct, d.value > 0 ? 4 : 1)}%`, background: barColor }}
              />
            </div>
          );
        })}
      </div>
      <div className="chart__labels">
        {data.map((d, i) => (
          <span key={d.label} className={`chart__label ${i % 2 === 1 ? 'chart__label--alt' : ''}`}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
