import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../cn';
import { popIn } from '../motion';

export interface DropdownProps {
  /** Icon rendered inside the round trigger button. */
  icon: LucideIcon;
  label: string;
  /** Small count/notification pill on the trigger. */
  badge?: number;
  /** Show the chevron affordance (user menus). */
  chevron?: boolean;
  align?: 'start' | 'end';
  triggerClassName?: string;
  children: ReactNode;
}

/**
 * Icon-triggered menu (user menu, notifications). Handles open state,
 * outside-click + Esc close, focus return, aria-expanded/menu semantics.
 */
export function Dropdown({
  icon: Icon,
  label,
  badge,
  chevron = false,
  align = 'end',
  triggerClassName,
  children,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title={label}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative inline-flex h-9 items-center justify-center gap-1 rounded-full border border-line bg-surface px-2 text-muted',
          'transition-all duration-base ease-smooth hover:border-line-strong hover:text-fg hover:shadow-sm active:scale-95',
          triggerClassName
        )}
      >
        <Icon size={16} aria-hidden="true" />
        {typeof badge === 'number' && badge > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
        {chevron && <ChevronDown size={13} aria-hidden="true" className="opacity-60" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            aria-label={label}
            variants={popIn}
            initial="hidden"
            animate="show"
            exit="exit"
            className={cn(
              'absolute z-[70] mt-2 min-w-56 overflow-hidden rounded-lg border border-line bg-surface p-1.5 shadow-[var(--shadow-lg)]',
              align === 'end' ? 'right-0' : 'left-0'
            )}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export interface DropdownItemProps {
  onSelect?: () => void;
  icon?: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
  children: ReactNode;
}

export function DropdownItem({ onSelect, icon: Icon, danger, disabled, children }: DropdownItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        onSelect?.();
      }}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors duration-fast',
        danger
          ? 'text-danger hover:bg-danger-soft'
          : 'text-fg hover:bg-surface-2',
        disabled && 'pointer-events-none opacity-50'
      )}
    >
      {Icon && <Icon size={15} aria-hidden="true" className="opacity-70" />}
      {children}
    </button>
  );
}

export function DropdownSeparator() {
  return <div role="separator" className="my-1.5 h-px bg-line" />;
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
      {children}
    </p>
  );
}
