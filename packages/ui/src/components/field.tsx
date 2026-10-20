import type {
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '../cn';

export function Label({ className, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('mb-1.5 block text-[13px] font-semibold text-fg', className)} {...rest} />
  );
}

const CONTROL =
  'block w-full rounded-md border border-line bg-surface-2 text-[14px] text-fg shadow-sm ' +
  'transition-all duration-fast ease-smooth placeholder:text-faint ' +
  'hover:border-line-strong focus:border-brand focus:bg-surface focus:outline-none focus:shadow-[var(--ring)] ' +
  'disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:shadow-[0_0_0_3px_var(--danger-soft)]';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, 'h-10 px-3', className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, 'min-h-24 px-3 py-2.5', className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL, 'h-10 px-3', className)} {...rest}>
      {children}
    </select>
  );
}

export function FieldHint({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1.5 text-xs text-muted', className)} {...rest} />;
}

export function FieldError({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1.5 text-xs font-medium text-danger', className)} {...rest} />;
}
