import { forwardRef, useId } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../cn';

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
}

/** Accessible toggle (role=switch) for settings rows. */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onCheckedChange, label, className, ...rest },
  ref
) {
  const id = useId();
  return (
    <span className="inline-flex items-center gap-3">
      <button
        ref={ref}
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        aria-label={label}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-base ease-smooth',
          checked ? 'bg-brand' : 'bg-line-strong/60',
          className
        )}
        {...rest}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-base ease-smooth',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          )}
        />
      </button>
      {label && (
        <label htmlFor={id} className="cursor-pointer text-sm text-fg select-none">
          {label}
        </label>
      )}
    </span>
  );
});
