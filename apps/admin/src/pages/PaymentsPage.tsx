import { useSearchParams } from 'react-router-dom';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, PageHeader, Skeleton } from '../components/States';
import { usePagedList } from '../lib/hooks';
import { STATUS_OPTIONS, formatDateTime, formatMoney, shortenId } from '../lib/format';
import type { PaymentDTO } from '../lib/types';

export function PaymentsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const page = Number(params.get('page') ?? '1') || 1;
  const limit = Number(params.get('limit') ?? '20') || 20;

  const { items, pagination, loading, error, reload } = usePagedList<PaymentDTO>('/admin/payments', {
    status: status || undefined,
    page,
    limit,
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const columns: Column<PaymentDTO>[] = [
    { key: 'booking', header: 'Booking', render: (p) => <code>{p.reference || shortenId(p.bookingId)}</code> },
    {
      key: 'status',
      header: 'Status',
      render: (p) => <StatusBadge status={p.status} tone={p.status === 'SUCCEEDED' ? 'success' : p.status === 'FAILED' ? 'danger' : p.status === 'PENDING' || p.status === 'PROCESSING' ? 'warning' : 'info'} />,
    },
    { key: 'amount', header: 'Amount', align: 'right', render: (p) => formatMoney(p.amount, p.currency) },
    { key: 'provider', header: 'Provider', secondary: true, render: (p) => p.provider },
    { key: 'method', header: 'Method', secondary: true, render: (p) => p.method ?? '—' },
    { key: 'providerId', header: 'Provider ref', secondary: true, render: (p) => <code>{p.providerPaymentId ?? '—'}</code> },
    { key: 'paidAt', header: 'Paid at', render: (p) => formatDateTime(p.paidAt ?? p.createdAt) },
  ];

  return (
    <>
      <PageHeader title="Payments" subtitle="All payment attempts across the platform" />
      <div className="toolbar">
        <select className="select" value={status} onChange={(e) => setParam('status', e.target.value)} aria-label="Filter by status">
          {STATUS_OPTIONS.payment.map((s) => (
            <option key={s} value={s}>
              {s === '' ? 'All statuses' : s}
            </option>
          ))}
        </select>
      </div>
      <section className="card">
        {loading ? (
          <Skeleton rows={6} />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <>
            <DataTable columns={columns} rows={items} getRowKey={(p) => p.id} emptyMessage="No payments match these filters." />
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
      </section>
    </>
  );
}
