import { useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../cn';

export interface TabItem {
  id: string;
  label: ReactNode;
  /** Optional count pill (bookings by status etc). */
  badge?: number;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  /** Panel content for the active tab. */
  children?: ReactNode;
}

/** Accessible tablist with arrow-key navigation; controlled value. */
export function Tabs({ tabs, value, onChange, className, children }: TabsProps) {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const enabled = tabs.filter((t) => !t.disabled);
    const index = enabled.findIndex((t) => t.id === value);
    if (index < 0) return;
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % enabled.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + enabled.length) % enabled.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = enabled.length - 1;
    else return;
    event.preventDefault();
    onChange(enabled[next].id);
    listRef.current
      ?.querySelector<HTMLButtonElement>(`#${CSS.escape(`${baseId}-tab-${enabled[next].id}`)}`)
      ?.focus();
  };

  return (
    <div className={className}>
      <div
        ref={listRef}
        role="tablist"
        onKeyDown={onKeyDown}
        className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-md border border-line bg-surface-2 p-1"
      >
        {tabs.map((tab) => {
          const active = tab.id === value;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={active}
              aria-controls={`${baseId}-panel-${tab.id}`}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={cn(
                'inline-flex items-center gap-2 whitespace-nowrap rounded-sm px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-fast ease-smooth',
                active
                  ? 'bg-surface text-fg shadow-sm ring-1 ring-line'
                  : 'text-muted hover:text-fg',
                tab.disabled && 'pointer-events-none opacity-50'
              )}
            >
              {tab.label}
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                    active ? 'bg-brand-soft text-brand-soft-fg' : 'bg-surface-3 text-muted'
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {children && (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${value}`}
          aria-labelledby={`${baseId}-tab-${value}`}
          tabIndex={0}
          className="mt-4 focus:outline-none"
        >
          {children}
        </div>
      )}
    </div>
  );
}
