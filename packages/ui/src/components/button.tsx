import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

type Variant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'outline' | 'danger' | 'danger-ghost';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary:
    'text-white bg-[image:var(--grad-brand)] shadow-[var(--shadow-brand)] hover:brightness-[1.08] hover:shadow-[var(--shadow-brand-lg)] hover:-translate-y-0.5 active:translate-y-0',
  secondary:
    'bg-surface-2 text-fg border border-line hover:border-line-strong hover:bg-surface-3 hover:shadow-sm',
  soft: 'bg-brand-soft text-brand-soft-fg hover:brightness-[1.04]',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  outline:
    'border border-line-strong text-fg bg-transparent hover:bg-surface-2 hover:border-line-strong/80',
  danger:
    'text-white bg-danger shadow-[0_8px_22px_-10px_var(--danger)] hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0',
  'danger-ghost': 'text-danger hover:bg-danger-soft',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] rounded-sm gap-1.5',
  md: 'h-10 px-4 text-sm rounded-md gap-2',
  lg: 'h-12 px-6 text-[15px] rounded-md gap-2',
  icon: 'h-9 w-9 rounded-full',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center font-semibold',
        'transition-all duration-base ease-smooth',
        'disabled:pointer-events-none disabled:opacity-50',
        'active:scale-[0.98]',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Circular icon-only button (nav actions, close buttons). */
export function IconButton({
  className,
  label,
  children,
  ...rest
}: ButtonProps & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-full text-muted',
        'transition-all duration-base ease-smooth hover:bg-surface-2 hover:text-fg',
        'active:scale-95 disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
