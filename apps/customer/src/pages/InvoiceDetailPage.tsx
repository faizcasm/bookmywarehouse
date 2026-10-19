import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, apiText, api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import { formatDate, formatMoney } from '../lib/format';
import type { InvoiceDTO } from '../lib/types';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { ErrorState, PageLoader } from '../components/Skeleton';

export function InvoiceDetailPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const [printBusy, setPrintBusy] = useState(false);

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
      // revoke after the new tab had a chance to load
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
    <div className="container page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/invoices">Invoices</Link> <span aria-hidden="true">/</span>{' '}
        <span aria-current="page">{invoice.invoiceNumber}</span>
      </nav>

      <div className="page-head booking-detail-head">
        <div>
          <h1 className="mono">{invoice.invoiceNumber}</h1>
          <p className="muted">
            For booking <Link to={`/bookings/${invoice.bookingId}`}>{invoice.bookingReference}</Link>
          </p>
        </div>
        <div className="head-actions">
          <StatusBadge status={invoice.status} kind="invoice" />
          <button type="button" className="btn btn-outline" onClick={onOpenPrintable} disabled={printBusy}>
            {printBusy ? 'Loading…' : 'View printable'}
          </button>
        </div>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <section className="card section-card" aria-labelledby="line-items-heading">
            <h2 id="line-items-heading">Line items</h2>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Description</th>
                    <th scope="col">Qty</th>
                    <th scope="col">Unit amount</th>
                    <th scope="col">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lineItems.map((line, index) => (
                    <tr key={index}>
                      <td>{line.description}</td>
                      <td>{line.quantity}</td>
                      <td>{formatMoney(line.unitAmount, invoice.currency)}</td>
                      <td>{formatMoney(line.amount, invoice.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card section-card invoice-parties">
            <div>
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
            </div>
            <div>
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
            </div>
          </section>
        </div>

        <aside className="detail-side">
          <div className="card section-card">
            <h2>Totals</h2>
            <dl className="summary-list">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatMoney(invoice.subtotal, invoice.currency)}</dd>
              </div>
              <div>
                <dt>Platform fee</dt>
                <dd>{formatMoney(invoice.platformFee, invoice.currency)}</dd>
              </div>
              <div>
                <dt>Taxes</dt>
                <dd>{formatMoney(invoice.taxAmount, invoice.currency)}</dd>
              </div>
              <div className="summary-total">
                <dt>Total</dt>
                <dd>{formatMoney(invoice.total, invoice.currency)}</dd>
              </div>
            </dl>
            <dl className="summary-list">
              <div>
                <dt>Created</dt>
                <dd>{formatDate(invoice.createdAt)}</dd>
              </div>
              {invoice.paidAt ? (
                <div>
                  <dt>Paid</dt>
                  <dd>{formatDate(invoice.paidAt)}</dd>
                </div>
              ) : null}
            </dl>
            <p className="field-hint">Open the printable view to download or print a copy for your records.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
