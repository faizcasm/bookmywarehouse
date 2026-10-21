import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/Modal';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, PageHeader, Skeleton } from '../components/States';
import { useToast } from '../components/Toast';
import { apiSend } from '../lib/api';
import { errorMessage, usePagedList } from '../lib/hooks';
import { STATUS_OPTIONS, formatDateTime, formatMoney, shortenId } from '../lib/format';
import type { RefundDTO } from '../lib/types';
import { motion } from 'motion/react';
import { fadeUp, stagger } from '@bmw/ui';

export function RefundsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? '1') || 1;
  const limit = Number(params.get('limit') ?? '20') || 20;
  const toast = useToast();

  const { items, pagination, loading, error, reload } = usePagedList<RefundDTO>('/admin/refunds', {
    status: status || undefined,
    page,
    limit,
  });

  const [target, setTarget] = useState<RefundDTO | null>(null);
  const [busy, setBusy] = useState(false);

  const processRefund = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await apiSend('POST', `/admin/refunds/${target.id}/process`);
      toast.success(`Refund ${formatMoney(target.amount, target.currency)} processed.`);
      setTarget(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const columns: Column<RefundDTO>[] = [
    { key: 'booking', header: 'Booking', render: (r) => <code>{shortenId(r.bookingId)}</code> },
    { key: 'payment', header: 'Payment', secondary: true, render: (r) => <code>{shortenId(r.paymentId)}</code> },
    { key: 'amount', header: 'Amount', align: 'right', render: (r) => formatMoney(r.amount, r.currency) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} tone={r.status === 'COMPLETED' ? 'success' : r.status === 'FAILED' || r.status === 'REJECTED' ? 'danger' : 'warning'} /> },
    { key: 'reason', header: 'Reason', render: (r) => r.reason ?? '—' },
    { key: 'created', header: 'Requested', secondary: true, render: (r) => formatDateTime(r.createdAt) },
    { key: 'processed', header: 'Processed', secondary: true, render: (r) => formatDateTime(r.processedAt) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) =>
        r.status === 'PENDING' ? (
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setTarget(r)}>
            Process
          </button>
        ) : null,
    },
  ];

  return (
    <>
      <motion.header variants={fadeUp} initial="hidden" animate="show">
        <PageHeader title="Refunds" subtitle="Review and process refund requests" />
      </motion.header>
      <motion.div className="toolbar glass-inset" variants={stagger(0.05)} initial="hidden" animate="show">
        <select className="select" value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Filter by status">
          {STATUS_OPTIONS.refund.map((s) => (
            <option key={s} value={s}>
              {s === '' ? 'All statuses' : s}
            </option>
          ))}
        </select>
      </motion.div>
      <motion.section className="card" variants={fadeUp} initial="hidden" animate="show">
        {loading ? (
          <Skeleton rows={5} />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <>
            <DataTable columns={columns} rows={items} getRowKey={(r) => r.id} emptyMessage="No refunds match these filters." />
            <Pagination
              meta={pagination}
              limit={limit}
              onPageChange={(p) => setParam('page', String(p))}
              onLimitChange={(l) => {
                const next = new URLSearchParams(params);
                next.set('limit', String(l));
                next.delete('page');
                setParams(next, { replace: true });
              }}
            />
          </>
        )}
      </motion.section>

      <ConfirmDialog
        open={target !== null}
        title="Process refund"
        message={
          target ? (
            <>
              Mark refund of <strong>{formatMoney(target.amount, target.currency)}</strong> as completed? This settles
              the payout to the customer.
            </>
          ) : null
        }
        confirmLabel="Process refund"
        danger={false}
        busy={busy}
        onConfirm={() => void processRefund()}
        onCancel={() => setTarget(null)}
      />
    </>
  );
}
