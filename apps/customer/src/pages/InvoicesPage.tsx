import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import { formatDate, formatMoney } from '../lib/format';
import type { InvoiceDTO } from '../lib/types';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, PageLoader } from '../components/Skeleton';

export function InvoicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10) || 1;

  const invoices = useAsyncData(
    () => api.getWithMeta<{ items: InvoiceDTO[] }>('/payments/invoices', { page, limit: 10 }),
    [page],
  );

  return (
    <div className="container page">
      <div className="page-head">
        <h1>Invoices</h1>
        <p className="muted">GST-ready invoices for all your paid bookings.</p>
      </div>

      {invoices.loading ? (
        <PageLoader label="Loading invoices…" />
      ) : invoices.error ? (
        <ErrorState message={invoices.error.message} onRetry={invoices.reload} />
      ) : (invoices.data?.data?.items ?? []).length === 0 ? (
        <EmptyState
          title="No invoices yet"
          message="Invoices are generated automatically once a booking payment succeeds."
          action={
            <Link to="/bookings" className="btn btn-outline">
              View my bookings
            </Link>
          }
        />
      ) : (
        <>
          <div className="table-wrap card">
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
              <tbody>
                {(invoices.data?.data?.items ?? []).map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="mono">{invoice.invoiceNumber}</td>
                    <td className="mono">{invoice.bookingReference}</td>
                    <td>{invoice.issuedTo.name}</td>
                    <td>{formatDate(invoice.paidAt ?? invoice.createdAt)}</td>
                    <td>
                      <StatusBadge status={invoice.status} kind="invoice" />
                    </td>
                    <td>{formatMoney(invoice.total, invoice.currency)}</td>
                    <td>
                      <Link to={`/invoices/${invoice.id}`} className="btn btn-outline btn-sm">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            pagination={invoices.data?.meta?.pagination ?? null}
            onPageChange={(next) => {
              const params = new URLSearchParams(searchParams);
              if (next > 1) params.set('page', String(next));
              else params.delete('page');
              setSearchParams(params);
            }}
          />
        </>
      )}
    </div>
  );
}
