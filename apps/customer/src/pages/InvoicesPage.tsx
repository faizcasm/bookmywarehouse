import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import { formatDate, formatMoney } from '../lib/format';
import type { InvoiceDTO } from '../lib/types';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, PageLoader } from '../components/Skeleton';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { fadeUp, stagger } from '@bmw/ui';

export function InvoicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10) || 1;

  useDocumentMeta({
    title: 'Invoices — BookMyWarehouse',
    description: 'GST-ready invoices for all your paid bookings.',
  });

  const invoices = useAsyncData(
    () => api.getWithMeta<{ items: InvoiceDTO[] }>('/payments/invoices', { page, limit: 10 }),
    [page],
  );

  return (
    <div className="container page">
      <motion.div className="page-head reveal" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1>Invoices</h1>
        <p className="muted">GST-ready invoices for all your paid bookings.</p>
      </motion.div>

      <AnimatePresence mode="wait">
        {invoices.loading ? (
          <PageLoader key="loading" label="Loading invoices…" />
        ) : invoices.error ? (
          <ErrorState key="error" message={invoices.error.message} onRetry={invoices.reload} />
        ) : (invoices.data?.data?.items ?? []).length === 0 ? (
          <motion.div
            key="empty"
            className="state-block reveal"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="state-icon" aria-hidden="true">
              🧾
            </div>
            <h3 className="state-title">No invoices yet</h3>
            <p className="state-message">Invoices are generated automatically once a booking payment succeeds.</p>
            <Link to="/bookings" className="btn btn-outline">
              View my bookings
            </Link>
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <motion.div className="table-wrap card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Invoice</th>
                    <th scope="col">Booking</th>
                    <th scope="col">Issued to</th>
                    <th scope="col">Date</th>
                    <th scope="col">Status</th>
                    <th scope="col">Total</th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <motion.tbody variants={stagger(0.05)} initial="hidden" animate="show">
                  {(invoices.data?.data?.items ?? []).map((invoice) => (
                    <motion.tr key={invoice.id} variants={fadeUp} whileHover={{ background: 'var(--surface-2)' }}>
                      <td data-label="Invoice" className="mono">{invoice.invoiceNumber}</td>
                      <td data-label="Booking" className="mono">{invoice.bookingReference}</td>
                      <td data-label="Issued to">{invoice.issuedTo.name}</td>
                      <td data-label="Date">{formatDate(invoice.paidAt ?? invoice.createdAt)}</td>
                      <td data-label="Status">
                        <StatusBadge status={invoice.status} kind="invoice" />
                      </td>
                      <td data-label="Total">{formatMoney(invoice.total, invoice.currency)}</td>
                      <td data-label="Actions">
                        <Link to={`/invoices/${invoice.id}`} className="btn btn-outline btn-sm">
                          View
                        </Link>
                      </td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </table>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Pagination
                pagination={invoices.data?.meta?.pagination ?? null}
                onPageChange={(next) => {
                  const params = new URLSearchParams(searchParams);
                  if (next > 1) params.set('page', String(next));
                  else params.delete('page');
                  setSearchParams(params);
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}