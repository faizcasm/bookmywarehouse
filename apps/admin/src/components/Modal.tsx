import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'default' | 'wide';
}

export function Modal({ open, title, onClose, children, footer, size = 'default' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => {
      const el = dialogRef.current?.querySelector<HTMLElement>(
        'input, select, textarea, button:not([data-modal-x])',
      );
      el?.focus();
    }, 30);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={`modal modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
      >
        <header className="modal__header">
          <h2 id={titleId} className="modal__title">
            {title}
          </h2>
          <button type="button" className="modal__x" data-modal-x aria-label="Close dialog" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer ? <footer className="modal__footer">{footer}</footer> : null}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Simple destructive-action confirmation (no input). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="confirm-message">{message}</div>
    </Modal>
  );
}

interface ReasonDialogProps {
  open: boolean;
  title: string;
  message?: ReactNode;
  reasonLabel?: string;
  placeholder?: string;
  /** When true the reason cannot be empty. */
  requireReason?: boolean;
  maxLength?: number;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  serverError?: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/**
 * Confirmation dialog with a reason textarea — used for user moderation,
 * listing moderation and partner verification decisions. Reason may be
 * optional or required depending on the action (listing REJECT requires it).
 *
 * Keyed on `open` by callers via `<ReasonDialog key={...}>` semantics below:
 * state resets each time the dialog opens.
 */
export function ReasonDialog({
  open,
  title,
  message,
  reasonLabel = 'Reason',
  placeholder = 'Add an internal note explaining this action…',
  requireReason = false,
  maxLength = 800,
  confirmLabel = 'Confirm',
  danger = true,
  busy = false,
  serverError = null,
  onConfirm,
  onCancel,
}: ReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // reset internal state whenever the dialog re-opens
  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  const submit = () => {
    const trimmed = reason.trim();
    if (requireReason && trimmed.length < 3) {
      setError('A reason is required (at least 3 characters).');
      return;
    }
    if (trimmed.length > maxLength) {
      setError(`Keep the reason under ${maxLength} characters.`);
      return;
    }
    setError(null);
    onConfirm(trimmed);
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
            onClick={submit}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      {message ? <div className="confirm-message">{message}</div> : null}
      <div className="field">
        <label className="field__label" htmlFor="reason-dialog-input">
          {reasonLabel}
          {requireReason ? (
            <span className="field__req"> *</span>
          ) : (
            <span className="field__hint-inline">(optional)</span>
          )}
        </label>
        <textarea
          id="reason-dialog-input"
          className="textarea"
          rows={4}
          maxLength={maxLength}
          value={reason}
          placeholder={placeholder}
          onChange={(e) => {
            setReason(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={Boolean(error)}
        />
        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}
        {serverError ? (
          <p className="field__error" role="alert">
            {serverError}
          </p>
        ) : null}
        <p className="field__counter">
          {reason.length}/{maxLength}
        </p>
      </div>
    </Modal>
  );
}
