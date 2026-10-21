import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Printer } from 'lucide-react';
import { ApiError, apiText, api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import { formatDate, formatMoney } from '../lib/format';
import type { InvoiceDTO } from '../lib/types';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { ErrorState, PageLoader } from '../components/Skeleton';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { fadeUp, stagger } from '@bmw/ui';

export function InvoiceDetailPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const [printBusy, setPrintBusy] = useState(false);

  useDocumentMeta({
    title: 'Invoice — BookMyWarehouse',
    description: 'View and print your invoice.',
  });

  const invoiceState = useAsyncData<InvoiceDTO>(() => api.get(`/payments/invoices/${id}`), [id]);
  const invoice = invoiceState.data;

  const onOpenPrintable = async () => {
    setPrintBusy(true);
    try {
      const html = await apiText(`/payments/invoices/${id}/html`);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) toast.push('Allow pop-ups to open the printable invoice.', 'error');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      toast.push(error instanceof ApiError ? error.message : 'Could not load the printable invoice.', 'error');
    } finally {
      setPrintBusy(false);
    }
  };

  if (invoiceState.loading) return <PageLoader label="Loading invoice…" />;
  if (invoiceState.error || !invoice) {
    return (
      <div className="container page">
        <ErrorState message={invoiceState.error?.message ?? 'Invoice not found.'} onRetry={invoiceState.reload} />
      </div>
    );
  }

  return (
    <div className="container page invoice-print-area">
      <motion.nav className="breadcrumbs reveal" aria-label="Breadcrumb" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Link to="/invoices">Invoices</Link> <span aria-hidden="true">/</span>{' '}
        <span aria-current="page">{invoice.invoiceNumber}</span>
      </motion.nav>

      <motion.div className="page-head booking-detail-head reveal" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div>
          <motion.h1 className="mono" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            {invoice.invoiceNumber}
          </motion.h1>
          <motion.p className="muted" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
            For booking <Link to={`/bookings/${invoice.bookingId}`}>{invoice.bookingReference}</Link>
          </motion.p>
        </div>
        <motion.div className="head-actions" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, delay: 0.1 }}>
          <StatusBadge status={invoice.status} kind="invoice" />
          <motion.button
            type="button"
            className="btn btn-outline print-btn"
            onClick={() => window.print()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Printer size={16} aria-hidden="true" /> Print / Save as PDF
          </motion.button>
          <motion.button
            type="button"
            className="btn btn-outline"
            onClick={onOpenPrintable}
            disabled={printBusy}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {printBusy ? 'Loading…' : 'View printable'}
          </motion.button>
        </motion.div>
      </motion.div>

      <motion.div className="detail-layout reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.15 }}>
        <div className="detail-main">
          <motion.section className="card section-card reveal" aria-labelledby="line-items-heading" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.5 }}>
            <h2 id="line-items-heading">Line items</h2>
            <motion.div className="table-wrap" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Description</th>
                    <th scope="col">Qty</th>
                    <th scope="col">Unit amount</th>
                    <th scope="col">Amount</th>
                  </tr>
                </thead>
                <motion.tbody variants={stagger(0.05)} initial="hidden" animate="show">
                  {invoice.lineItems.map((line, index) => (
                    <motion.tr key={index} variants={fadeUp} whileHover={{ background: 'var(--surface-2)' }}>
                      <td data-label="Description">{line.description}</td>
                      <td data-label="Qty">{line.quantity}</td>
                      <td data-label="Unit amount">{formatMoney(line.unitAmount, invoice.currency)}</td>
                      <td data-label="Amount">{formatMoney(line.amount, invoice.currency)}</td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </table>
            </motion.div>
          </motion.section>

          <motion.section className="card section-card invoice-parties reveal" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.5, delay: 0.05 }}>
            <motion.div variants={fadeUp}>
              <h2>Billed to</h2>
              <p>
                <strong>{invoice.issuedTo.name}</strong>
                <br />
                {invoice.issuedTo.email}
                {invoice.issuedTo.address ? (
                  <>
                    <br />
                    {invoice.issuedTo.address}
                  </>
                ) : null}
              </p>
            </motion.div>
            <motion.div variants={fadeUp}>
              <h2>Issued by</h2>
              <p>
                <strong>{invoice.issuedBy.businessName}</strong>
                {invoice.issuedBy.address ? (
                  <>
                    <br />
                    {invoice.issuedBy.address}
                  </>
                ) : null}
                {invoice.issuedBy.gstNumber ? (
                  <>
                    <br />
                    GSTIN: {invoice.issuedBy.gstNumber}
                  </>
                ) : null}
              </p>
            </motion.div>
          </motion.section>
        </div>

        <aside className="detail-side">
          <motion.div className="card section-card reveal" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }} variants={stagger(0.06)}>
            <h2>Totals</h2>
            <motion.dl className="summary-list" variants={stagger(0.05)} initial="hidden" animate="show">
              <motion.div variants={fadeUp}>
                <dt>Subtotal</dt>
                <dd>{formatMoney(invoice.subtotal, invoice.currency)}</dd>
              </motion.div>
              <motion.div variants={fadeUp}>
                <dt>Platform fee</dt>
                <dd>{formatMoney(invoice.platformFee, invoice.currency)}</dd>
              </motion.div>
              <motion.div variants={fadeUp}>
                <dt>Taxes</dt>
                <dd>{formatMoney(invoice.taxAmount, invoice.currency)}</dd>
              </motion.div>
              <motion.div className="summary-total" variants={fadeUp}>
                <dt>Total</dt>
                <dd>{formatMoney(invoice.total, invoice.currency)}</dd>
              </motion.div>
            </motion.dl>
            <motion.dl className="summary-list" variants={stagger(0.05)} initial="hidden" animate="show">
              <motion.div variants={fadeUp}>
                <dt>Created</dt>
                <dd>{formatDate(invoice.createdAt)}</dd>
              </motion.div>
              {invoice.paidAt ? (
                <motion.div variants={fadeUp}>
                  <dt>Paid</dt>
                  <dd>{formatDate(invoice.paidAt)}</dd>
                </motion.div>
              ) : null}
            </motion.dl>
            <motion.p className="field-hint" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
              Open the printable view to download or print a copy for your records.
            </motion.p>
          </motion.div>
        </aside>
      </motion.div>
    </div>
  );
}