import { useId } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface ChartDatum {
  label: string;
  /** Primary value (bar height). */
  value: number;
  /** Optional secondary value shown in the tooltip. */
  secondary?: number;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: { payload?: ChartDatum }[];
  formatValue: (value: number) => string;
  formatSecondary?: (value: number) => string;
}

function ChartTooltip({ active, payload, formatValue, formatSecondary }: ChartTooltipProps) {
  const datum = payload?.[0]?.payload;
  if (!active || !datum) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">{datum.label}</p>
      <p className="chart-tooltip__row">
        <span className="chart-legend__swatch" style={{ background: 'var(--brand)' }} aria-hidden="true" />
        {formatValue(datum.value)}
      </p>
      {datum.secondary !== undefined && formatSecondary ? (
        <p className="chart-tooltip__row">
          <span className="chart-legend__swatch" style={{ background: 'var(--accent)' }} aria-hidden="true" />
          {formatSecondary(datum.secondary)}
        </p>
      ) : null}
    </div>
  );
}

interface SimpleBarChartProps {
  data: ChartDatum[];
  height?: number;
  /** Bar fill color — any CSS color/var. Defaults to the brand token. */
  barColor?: string;
  formatValue?: (value: number) => string;
  formatSecondary?: (value: number) => string;
  ariaLabel?: string;
}

/**
 * Recharts bar chart for dashboard trends. Colors are CSS vars so both themes
 * render correctly. The wrapper keeps the `role="img"` + aria-label contract
 * (recharts paints decorative SVG that assistive tech should skip).
 */
export function SimpleBarChart({
  data,
  height = 200,
  barColor = 'var(--brand)',
  formatValue = (v) => String(v),
  formatSecondary,
  ariaLabel = 'Trend chart',
}: SimpleBarChartProps) {
  const gradientId = useId();

  if (data.length === 0) {
    return <p className="chart__empty">No trend data for this period.</p>;
  }

  return (
    <div className="chart" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }} barCategoryGap="22%">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={barColor} stopOpacity={0.95} />
              <stop offset="100%" stopColor={barColor} stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--faint)', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--line)' }}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: 'var(--faint)', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={40}
            domain={[0, 'dataMax + 1']}
          />
          <Tooltip
            cursor={{ fill: 'var(--brand-soft)', fillOpacity: 0.5 }}
            content={
              <ChartTooltip formatValue={formatValue} formatSecondary={formatSecondary} />
            }
          />
          <Bar dataKey="value" fill={`url(#${gradientId})`} radius={[5, 5, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
