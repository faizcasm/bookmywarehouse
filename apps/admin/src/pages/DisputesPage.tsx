import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../components/States';
import { Tabs } from '../components/Tabs';
import { useToast } from '../components/Toast';
import { apiSend } from '../lib/api';
import { errorMessage, usePagedList } from '../lib/hooks';
import { formatDateTime, statusLabel } from '../lib/format';
import type { DisputeDTO } from '../lib/types';

const DISPUTE_TABS = [
  { id: '', label: 'All' },
  { id: 'OPEN', label: 'Open' },
  { id: 'UNDER_REVIEW', label: 'Under review' },
  { id: 'RESOLVED_CUSTOMER', label: 'Resolved · customer' },
  { id: 'RESOLVED_PARTNER', label: 'Resolved · partner' },
  { id: 'CLOSED', label: 'Closed' },
];

type Resolution = 'RESOLVED_CUSTOMER' | 'RESOLVED_PARTNER' | 'CLOSED';

export function DisputesPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? '1') || 1;
  const limit = Number(params.get('limit') ?? '20') || 20;
  const toast = useToast();

  const { items, pagination, loading, error, reload } = usePagedList<DisputeDTO>('/admin/disputes', {
    status: status || undefined,
    page,
    limit,
  });

  const setStatus = (next: string) => {
    const nextParams = new URLSearchParams(params);
    if (next) nextParams.set('status', next);
    else nextParams.delete('status');
    nextParams.delete('page');
    setParams(nextParams, { replace: true });
  };

  // ---- resolve form (disputeResolutionSchema) ----
  const [target, setTarget] = useState<DisputeDTO | null>(null);
  const [resolution, setResolution] = useState<Resolution>('RESOLVED_CUSTOMER');
  const [resolutionNote, setResolutionNote] = useState('');
  const [refundRupees, setRefundRupees] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (target) {
      setResolution('RESOLVED_CUSTOMER');
      setResolutionNote('');
      setRefundRupees('');
      setFormError(null);
      setServerError(null);
    }
  }, [target]);

  const submitResolve = async () => {
    if (!target) return;
    const note = resolutionNote.trim();
    if (note.length < 5) {
      setFormError('Explain the resolution (at least 5 characters).');
      return;
    }
    let refundAmount: number | undefined;
    if (refundRupees.trim() !== '') {
      const rupees = Number(refundRupees);
      if (!Number.isFinite(rupees) || rupees < 0) {
        setFormError('Refund amount must be a positive number.');
        return;
      }
      refundAmount = Math.round(rupees * 100); // minor units
    }
    setBusy(true);
    setServerError(null);
    try {
      await apiSend('POST', `/admin/disputes/${target.id}/resolve`, {
        resolution,
        resolutionNote: note,
        ...(refundAmount !== undefined ? { refundAmount } : {}),
      });
      toast.success(`Dispute ${target.reference} resolved.`);
      setTarget(null);
      reload();
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const canResolve = (d: DisputeDTO) => d.status === 'OPEN' || d.status === 'UNDER_REVIEW';

  const columns: Column<DisputeDTO>[] = [
    {
      key: 'reference',
      header: 'Dispute',
      render: (d) => (
        <div className="cell-stack">
          <code>{d.reference}</code>
          <span className="muted">{statusLabel(d.reason)}</span>
        </div>
      ),
    },
    {
      key: 'booking',
      header: 'Booking',
      render: (d) =>
        d.bookingId ? (
          <Link to={`/bookings/${d.bookingId}`} className="cell-link">
            <code>{d.bookingReference || 'View booking'}</code>
          </Link>
        ) : (
          '—'
        ),
    },
    { key: 'openedBy', header: 'Opened by', render: (d) => d.openedBy?.name ?? '—' },
    { key: 'against', header: 'Against', secondary: true, render: (d) => d.againstParty },
    {
      key: 'status',
      header: 'Status',
      render: (d) => <StatusBadge status={d.status} tone={d.status === 'OPEN' ? 'danger' : d.status === 'UNDER_REVIEW' ? 'warning' : 'success'} />,
    },
    { key: 'created', header: 'Opened', secondary: true, render: (d) => formatDateTime(d.createdAt) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (d) =>
        canResolve(d) ? (
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setTarget(d)}>
            Resolve
          </button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader title="Disputes" subtitle="Investigate and resolve booking disputes" />
      <Tabs tabs={DISPUTE_TABS} active={status} onChange={setStatus} ariaLabel="Dispute status" />

      <section className="card">
        {loading ? (
          <Skeleton rows={5} />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : items.length === 0 ? (
          <EmptyState title="No disputes" hint="Nothing matches the current filter." />
        ) : (
          <>
            <DataTable columns={columns} rows={items} getRowKey={(d) => d.id} />
            <Pagination
              meta={pagination}
              limit={limit}
              onPageChange={(p) => {
                const next = new URLSearchParams(params);
                next.set('page', String(p));
                setParams(next, { replace: true });
              }}
            />
          </>
        )}
      </section>

      {/* Resolve modal */}
      <Modal
        open={target !== null}
        title={`Resolve ${target?.reference ?? ''}`}
        onClose={() => setTarget(null)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setTarget(null)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" onClick={() => void submitResolve()} disabled={busy}>
              {busy ? 'Resolving…' : 'Resolve dispute'}
            </button>
          </>
        }
      >
        {target ? (
          <>
            <div className="dispute-summary">
              <p>
                <strong>Reason:</strong> {statusLabel(target.reason)}
              </p>
              <p className="muted">{target.description}</p>
            </div>

            <fieldset className="field">
              <legend className="field__label">Resolution</legend>
              <div className="radio-row radio-row--stack">
                {(
                  [
                    ['RESOLVED_CUSTOMER', 'Resolve in favour of the customer'],
                    ['RESOLVED_PARTNER', 'Resolve in favour of the partner'],
                    ['CLOSED', 'Close without action'],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className={`radio-card ${resolution === value ? 'radio-card--active' : ''}`}>
                    <input type="radio" name="resolution" value={value} checked={resolution === value} onChange={() => setResolution(value)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="field">
              <label className="field__label" htmlFor="dispute-note">
                Resolution note <span className="field__req">*</span>
              </label>
              <textarea
                id="dispute-note"
                className="textarea"
                rows={3}
                maxLength={2000}
                value={resolutionNote}
                placeholder="Explain the resolution (shown to the customer)…"
                onChange={(e) => {
                  setResolutionNote(e.target.value);
                  if (formError) setFormError(null);
                }}
              />
              <p className="field__counter">{resolutionNote.length}/2000</p>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="dispute-refund">
                Refund amount (₹) <span className="field__hint-inline">(optional — only for customer-favour resolutions)</span>
              </label>
              <input
                id="dispute-refund"
                className="input"
                type="number"
                min={0}
                step="0.01"
                value={refundRupees}
                placeholder="e.g. 1500"
                onChange={(e) => {
                  setRefundRupees(e.target.value);
                  if (formError) setFormError(null);
                }}
              />
            </div>

            {formError ? (
              <p className="field__error" role="alert">
                {formError}
              </p>
            ) : null}
            {serverError ? (
              <p className="field__error" role="alert">
                {serverError}
              </p>
            ) : null}
          </>
        ) : null}
      </Modal>
    </>
  );
}
