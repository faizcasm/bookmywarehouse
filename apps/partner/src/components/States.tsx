import type { CSSProperties, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Inbox, WifiOff, RefreshCw } from 'lucide-react';
import { errorMessage } from '../lib/api';
import { fadeSoft, stagger, popIn } from '@bmw/ui';

export function Skeleton({
  width = '100%',
  height = '1rem',
  radius = 'var(--radius-sm)',
  style,
}: {
  width?: string;
  height?: string;
  radius?: string;
  style?: CSSProperties;
}) {
  return <span className="skeleton" style={{ width, height, borderRadius: radius, ...style }} aria-hidden="true" />;
}

export function ListSkeleton({ rows = 5, height = '3.25rem' }: { rows?: number; height?: string }) {
  return (
    <motion.div className="skeleton-list" role="status" aria-label="Loading" variants={stagger(0.06)} initial="hidden" animate="show">
      {Array.from({ length: rows }, (_, index) => (
        <motion.div key={index} variants={fadeSoft}>
          <Skeleton height={height} />
        </motion.div>
      ))}
    </motion.div>
  );
}

export function StatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <motion.div className="stat-grid" role="status" aria-label="Loading" variants={stagger(0.07)} initial="hidden" animate="show">
      {Array.from({ length: count }, (_, index) => (
        <motion.div className="card stat-card" key={index} variants={fadeSoft}>
          <Skeleton width="60%" height="0.8rem" />
          <Skeleton width="40%" height="1.7rem" style={{ marginTop: '0.75rem' }} />
        </motion.div>
      ))}
    </motion.div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  variant = 'default',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  variant?: 'default' | 'offline' | 'search';
}) {
  const IconComponent = variant === 'offline' ? WifiOff : variant === 'search' ? RefreshCw : Inbox;
  const iconColor = variant === 'offline' ? 'var(--warning-soft-fg)' : variant === 'search' ? 'var(--brand-soft-fg)' : 'var(--brand-soft-fg)';
  const iconBg = variant === 'offline' ? 'var(--warning-soft)' : variant === 'search' ? 'var(--brand-soft)' : 'var(--brand-soft)';

  return (
    <motion.div className="empty-state" variants={popIn} initial="hidden" animate="show">
      <div className="empty-state__icon" aria-hidden="true" style={{ background: iconBg, color: iconColor }}>
        {icon ?? <IconComponent size={26} strokeWidth={1.8} />}
      </div>
      <h3 className="empty-state__title">{title}</h3>
      {description ? <p className="empty-state__description">{description}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </motion.div>
  );
}

export function ErrorState({ error, onRetry, title = 'Could not load data' }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <motion.div className="error-state" role="alert" variants={popIn} initial="hidden" animate="show">
      <div className="error-state__icon" aria-hidden="true">
        <AlertTriangle size={18} strokeWidth={2.2} />
      </div>
      <div className="error-state__body">
        <strong>{title}</strong>
        <p>{errorMessage(error)}</p>
      </div>
      {onRetry ? (
        <button type="button" className="btn btn--secondary" onClick={onRetry}>
          <RefreshCw size={14} strokeWidth={2} aria-hidden="true" style={{ marginRight: '0.35rem' }} />
          Retry
        </button>
      ) : null}
    </motion.div>
  );
}

/* Crossfade wrapper for skeleton-to-content transitions */
export function ContentCrossfade({
  isLoading,
  children,
  skeleton,
}: {
  isLoading: boolean;
  children: ReactNode;
  skeleton: ReactNode;
}) {
  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div key="skeleton" variants={fadeSoft} initial="hidden" animate="show" exit="hidden">
          {skeleton}
        </motion.div>
      ) : (
        <motion.div key="content" variants={fadeSoft} initial="hidden" animate="show" exit="hidden">
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}