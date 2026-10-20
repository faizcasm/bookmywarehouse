import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../cn';

/** Animated number that counts up once scrolled into view. */
export function CountUp({
  value,
  format,
  duration = 1,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -40px 0px' });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {format ? format(display) : Math.round(display).toLocaleString()}
    </span>
  );
}

export interface StatProps {
  label: string;
  /** Numeric value animates a count-up; strings render as-is. */
  value: number | string;
  hint?: ReactNode;
  icon?: LucideIcon;
  /** Percent change pill, e.g. { value: 12.5, up: true }. */
  trend?: { value: number; up: boolean };
  format?: (n: number) => string;
  className?: string;
}

/** Dashboard statistic card with optional icon and trend. */
export function Stat({ label, value, hint, icon: Icon, trend, format, className }: StatProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-lg border border-line bg-surface p-5 shadow-sm',
        'transition-all duration-base ease-smooth hover:-translate-y-0.5 hover:shadow-md hover:border-line-strong',
        className
      )}
    >
      {Icon && (
        <span className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-brand-soft-fg transition-transform duration-base ease-smooth group-hover:scale-110">
          <Icon size={16} aria-hidden="true" />
        </span>
      )}
      <p className="text-[12px] font-semibold uppercase tracking-wider text-faint">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-fg-strong">
        {typeof value === 'number' ? <CountUp value={value} format={format} /> : value}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        {trend && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold',
              trend.up ? 'bg-success-soft text-success-soft-fg' : 'bg-danger-soft text-danger-soft-fg'
            )}
          >
            {trend.up ? <TrendingUp size={11} aria-hidden="true" /> : <TrendingDown size={11} aria-hidden="true" />}
            {Math.abs(trend.value)}%
          </span>
        )}
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
    </div>
  );
}
