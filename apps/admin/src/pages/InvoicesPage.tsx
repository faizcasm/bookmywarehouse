import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { fadeUp, stagger } from '@bmw/ui';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, PageHeader, Skeleton } from '../components/States';
import { usePagedList } from '../lib/hooks';
import { formatDateTime, formatMoney } from '../lib/format';
import type { InvoiceDTO } from '../lib/types';

export function InvoicesPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') ?? '1') || 1;
  const limit = Number(params.get('limit') ?? '20') || 20;

  const { items, pagination, loading, error, reload } = usePagedList<InvoiceDTO>('/admin/invoices', { page, limit });

  const columns: Column<InvoiceDTO>[] = [
    { key: 'number', header: 'Invoice', render: (i) => <code>{i.invoiceNumber}</code> },
    { key: 'booking', header: 'Booking', secondary: true, render: (i) => <code>{i.bookingReference || '—'}</code> },
    {
      key: 'customer',
      header: 'Issued to',
      render: (i) => (
        <div className="cell-stack">
          <span>{i.issuedTo?.name ?? '—'}</span>
          <span className="muted">{i.issuedTo?.email ?? ''}</span>
        </div>
      ),
    },
    { key: 'partner', header: 'Issued by', secondary: true, render: (i) => i.issuedBy?.businessName ?? '—' },
    { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} tone={i.status === 'PAID' ? 'success' : i.status === 'VOID' ? 'danger' : 'info'} /> },
    { key: 'total', header: 'Total', align: 'right', render: (i) => formatMoney(i.total, i.currency) },
    { key: 'paidAt', header: 'Paid at', secondary: true, render: (i) => formatDateTime(i.paidAt) },
    { key: 'created', header: 'Created', secondary: true, render: (i) => formatDateTime(i.createdAt) },
  ];

  return (
    <>
      <motion.header variants={fadeUp} initial="hidden" animate="show">
        <PageHeader title="Invoices" subtitle="Every invoice generated on the platform" />
      </motion.header>
      <motion.section className="card" variants={fadeUp} initial="hidden" animate="show">
        {loading ? (
          <Skeleton rows={6} />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <>
            <DataTable columns={columns} rows={items} getRowKey={(i) => i.id} emptyMessage="No invoices yet." />
            <motion.div variants={fadeUp} initial="hidden" animate="show">
              <Pagination
                meta={pagination}
                limit={limit}
                onPageChange={(p) => {
                  const next = new URLSearchParams(params);
                  next.set('page', String(p));
                  setParams(next, { replace: true });
                }}
                onLimitChange={(l) => {
                  const next = new URLSearchParams(params);
                  next.set('limit', String(l));
                  next.delete('page');
                  setParams(next, { replace: true });
                }}
              />
            </motion.div>
          </>
        )}
      </motion.section>
    </>
  );
}
