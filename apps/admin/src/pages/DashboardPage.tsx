import { Link } from 'react-router-dom';
import { RevenueBlock, StatCard } from '../components/StatCard';
import { SimpleBarChart } from '../components/SimpleBarChart';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, PageHeader, Skeleton } from '../components/States';
import { useFetch } from '../lib/hooks';
import { formatDayLabel, formatMoney, formatMoneyCompact, formatNumber } from '../lib/format';
import type { AdminDashboardDTO, RawBookingDoc } from '../lib/types';

function bookingId(b: RawBookingDoc): string {
  return b.id ?? b._id;
}

export function DashboardPage() {
  const { data, loading, error, reload } = useFetch<AdminDashboardDTO>('/admin/dashboard');

  if (loading) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Marketplace health at a glance" />
        <Skeleton rows={8} />
      </>
    );
  }
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;

  const { totals, revenue, trends, recentBookings } = data;
  const currency = revenue.currency ?? 'INR';

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Marketplace health at a glance"
        actions={
          <>
            <Link to="/verification-queue" className="btn btn--ghost btn--sm">
              Verification queue{totals.pendingVerifications > 0 ? ` (${totals.pendingVerifications})` : ''}
            </Link>
            <Link to="/listings?status=PENDING_REVIEW" className="btn btn--ghost btn--sm">
              Pending listings{totals.pendingListings > 0 ? ` (${totals.pendingListings})` : ''}
            </Link>
          </>
        }
      />

      <section className="stat-grid" aria-label="Platform totals">
        <StatCard label="Customers" value={formatNumber(totals.customers)} to="/users?role=CUSTOMER" />
        <StatCard label="Partners" value={formatNumber(totals.partners)} to="/partners" />
        <StatCard
          label="Verified partners"
          value={formatNumber(totals.verifiedPartners)}
          to="/partners?verificationStatus=VERIFIED"
          tone="success"
        />
        <StatCard label="Listings" value={formatNumber(totals.listings)} to="/listings" />
        <StatCard
          label="Active listings"
          value={formatNumber(totals.activeListings)}
          to="/listings?status=PUBLISHED"
          tone="success"
        />
        <StatCard label="Bookings" value={formatNumber(totals.bookings)} to="/bookings" />
        <StatCard
          label="Pending bookings"
          value={formatNumber(totals.pendingBookings)}
          to="/bookings?status=PENDING_APPROVAL"
          tone={totals.pendingBookings > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Open disputes"
          value={formatNumber(totals.disputesOpen)}
          to="/disputes?status=OPEN"
          tone={totals.disputesOpen > 0 ? 'danger' : 'default'}
        />
        <StatCard
          label="Pending verifications"
          value={formatNumber(totals.pendingVerifications)}
          to="/verification-queue"
          tone={totals.pendingVerifications > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Pending listings"
          value={formatNumber(totals.pendingListings)}
          to="/listings?status=PENDING_REVIEW"
          tone={totals.pendingListings > 0 ? 'warning' : 'default'}
        />
      </section>

      <div className="grid-2">
        <section className="card">
          <h2 className="card__title">Revenue · last {revenue.periodDays} days</h2>
          <RevenueBlock
            caption="All amounts in minor units converted for display. Gross = successful payments."
            items={[
              { label: 'Gross collected', value: formatMoneyCompact(revenue.grossCollected, currency) },
              { label: 'Platform fees', value: formatMoneyCompact(revenue.platformFees, currency) },
              { label: 'Refunds', value: formatMoneyCompact(revenue.refunds, currency), tone: revenue.refunds > 0 ? 'danger' : undefined },
              { label: 'Net collected', value: formatMoneyCompact(revenue.netCollected, currency), tone: 'success' },
            ]}
          />
        </section>

        <section className="card">
          <h2 className="card__title">Trends · bookings per day</h2>
          {trends.length === 0 ? (
            <p className="muted">No bookings in the last 14 days.</p>
          ) : (
            <SimpleBarChart
              data={trends.map((t) => ({ label: formatDayLabel(t.date), value: t.bookings, secondary: t.grossAmount }))}
              formatValue={(v) => `${v} booking${v === 1 ? '' : 's'}`}
              formatSecondary={(v) => formatMoney(v, currency)}
              ariaLabel="Bookings per day over the last 14 days"
            />
          )}
        </section>
      </div>

      <section className="card">
        <div className="card__head">
          <h2 className="card__title">Recent bookings</h2>
          <Link to="/bookings" className="card__link">
            View all →
          </Link>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Listing</th>
                <th>Status</th>
                <th>Start date</th>
                <th className="align-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.map((b) => (
                <tr key={bookingId(b)}>
                  <td data-label="Reference">
                    <code>{b.reference}</code>
                  </td>
                  <td data-label="Listing">{b.listingSnapshot?.title ?? '—'}</td>
                  <td data-label="Status">
                    <StatusBadge status={b.status} group="booking" />
                  </td>
                  <td data-label="Start date">{new Date(b.startDate).toLocaleDateString('en-IN')}</td>
                  <td data-label="Actions" className="align-right">
                    <Link className="btn btn--ghost btn--sm" to={`/bookings/${bookingId(b)}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
