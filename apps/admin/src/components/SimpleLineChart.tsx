import { useId } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface LineDatum {
  label: string;
  value: number;
}

interface LineTooltipProps {
  active?: boolean;
  payload?: { payload?: LineDatum }[];
  formatValue: (value: number) => string;
}

function LineTooltip({ active, payload, formatValue }: LineTooltipProps) {
  const datum = payload?.[0]?.payload;
  if (!active || !datum) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip__label">{datum.label}</p>
      <p className="chart-tooltip__row">
        <span className="chart-legend__swatch" style={{ background: 'var(--accent)' }} aria-hidden="true" />
        {formatValue(datum.value)}
      </p>
    </div>
  );
}

interface SimpleLineChartProps {
  data: LineDatum[];
  height?: number;
  lineColor?: string;
  formatValue?: (value: number) => string;
  ariaLabel?: string;
}

/**
 * Recharts line chart (with a soft gradient area fill) for revenue-style
 * trends. The wrapper preserves the `role="img"` + aria-label contract.
 */
export function SimpleLineChart({
  data,
  height = 200,
  lineColor = 'var(--accent)',
  formatValue = (v) => String(v),
  ariaLabel = 'Trend chart',
}: SimpleLineChartProps) {
  const gradientId = useId();

  if (data.length === 0) {
    return <p className="chart__empty">No trend data for this period.</p>;
  }

  return (
    <div className="chart" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.28} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--faint)', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--line)' }}
            interval="preserveStartEnd"
            minTickGap={10}
          />
          <YAxis
            tick={{ fill: 'var(--faint)', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v: number) => formatValue(v).replace(/\s+/g, '')}
          />
          <Tooltip
            cursor={{ stroke: 'var(--line-strong)', strokeDasharray: '3 3' }}
            content={<LineTooltip formatValue={formatValue} />}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4.5, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
