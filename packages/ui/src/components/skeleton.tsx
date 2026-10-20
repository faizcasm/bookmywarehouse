import { cn } from '../cn';

/** Shimmering placeholder block. */
export function Skeleton({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-md bg-[linear-gradient(100deg,var(--surface-2)_40%,var(--surface-3)_50%,var(--surface-2)_60%)] bg-[length:200%_100%]',
        className
      )}
      {...rest}
    />
  );
}

/** Indeterminate spinner (button loaders, inline waits). */
export function Spinner({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={cn(
        'inline-block animate-spin rounded-full border-2 border-current border-t-transparent opacity-80',
        className
      )}
    />
  );
}

/** Full-viewport loader for route guards. */
export function FullPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-muted"
    >
      <span className="relative flex h-12 w-12 items-center justify-center">
        <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-brand/20 border-t-brand" />
        <span className="h-2 w-2 rounded-full bg-brand" />
      </span>
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}
