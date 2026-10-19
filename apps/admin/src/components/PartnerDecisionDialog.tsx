import { useEffect, useState } from 'react';
import { Modal } from './Modal';

export type PartnerDecision = 'APPROVE' | 'REJECT' | 'SUSPEND';

interface PartnerDecisionDialogProps {
  open: boolean;
  businessName: string;
  currentStatus: string;
  busy?: boolean;
  serverError?: string | null;
  onConfirm: (input: { decision: PartnerDecision; reason: string | null; notes: string | null }) => void;
  onCancel: () => void;
}

/**
 * Partner KYC decision form (partnerDecisionSchema):
 * decision APPROVE|REJECT|SUSPEND + optional reason/notes.
 * REJECT/SUSPEND require a reason in the UI.
 */
export function PartnerDecisionDialog({
  open,
  businessName,
  currentStatus,
  busy = false,
  serverError = null,
  onConfirm,
  onCancel,
}: PartnerDecisionDialogProps) {
  const [decision, setDecision] = useState<PartnerDecision>('APPROVE');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDecision('APPROVE');
      setReason('');
      setNotes('');
      setError(null);
    }
  }, [open]);

  const submit = () => {
    const trimmedReason = reason.trim();
    if (decision !== 'APPROVE' && trimmedReason.length < 3) {
      setError('A reason is required for reject/suspend decisions.');
      return;
    }
    setError(null);
    onConfirm({
      decision,
      reason: trimmedReason || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <Modal
      open={open}
      title="Verification decision"
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${decision === 'APPROVE' ? 'btn--primary' : 'btn--danger'}`}
            onClick={submit}
            disabled={busy}
          >
            {busy ? 'Saving…' : 'Submit decision'}
          </button>
        </>
      }
    >
      <p className="confirm-message">
        <strong>{businessName}</strong> · current status <strong>{currentStatus}</strong>
      </p>

      <fieldset className="field">
        <legend className="field__label">Decision</legend>
        <div className="radio-row">
          {(
            [
              ['APPROVE', 'Approve — mark verified'],
              ['REJECT', 'Reject — needs attention'],
              ['SUSPEND', 'Suspend — block account'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className={`radio-card ${decision === value ? `radio-card--${value.toLowerCase()}` : ''}`}>
              <input
                type="radio"
                name="partner-decision"
                value={value}
                checked={decision === value}
                onChange={() => setDecision(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label className="field__label" htmlFor="pd-reason">
          Reason {decision !== 'APPROVE' ? <span className="field__req">*</span> : <span className="field__hint-inline">(optional)</span>}
        </label>
        <textarea
          id="pd-reason"
          className="textarea"
          rows={3}
          maxLength={800}
          value={reason}
          placeholder="Shown to the partner (e.g. GST document unreadable)."
          onChange={(e) => {
            setReason(e.target.value);
            if (error) setError(null);
          }}
        />
        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="field">
        <label className="field__label" htmlFor="pd-notes">
          Internal notes <span className="field__hint-inline">(optional)</span>
        </label>
        <textarea
          id="pd-notes"
          className="textarea"
          rows={2}
          maxLength={2000}
          value={notes}
          placeholder="Only visible to admins."
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {serverError ? (
        <p className="field__error" role="alert">
          {serverError}
        </p>
      ) : null}
    </Modal>
  );
}
