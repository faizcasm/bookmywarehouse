import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Stat, stagger, fadeUp } from '@bmw/ui';
import {
  AlertOctagon,
  ArrowRight,
  BadgeCheck,
  Boxes,
  CalendarClock,
  ClipboardCheck,
  Users as UsersIcon,
  Warehouse,
  Handshake,
} from 'lucide-react';
import { RevenueBlock } from '../components/StatCard';
import { SimpleBarChart } from '../components/SimpleBarChart';
import { SimpleLineChart } from '../components/SimpleLineChart';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../components/States';
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

  // Dense 14-day window: the API only returns days that have activity, which
  // makes the charts look sparse. Fill the gaps with zeroes for a readable axis.
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const byDate = new Map(trends.map((t) => [t.date, t]));
  const window14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = dayKey(d);
    const point = byDate.get(key);
    return { date: key, bookings: point?.bookings ?? 0, grossAmount: point?.grossAmount ?? 0 };
  });

  const grossSeries = window14.map((t) => ({ label: formatDayLabel(t.date), value: t.grossAmount }));
  const trendSeries = window14.map((t) => ({
    label: formatDayLabel(t.date),
    value: t.bookings,
    secondary: t.grossAmount,
  }));

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

      <motion.section
        className="stat-grid"
        aria-label="Platform totals"
        variants={stagger(0.05)}
        initial="hidden"
        animate="show"
      >
        {[
          { label: 'Customers', value: totals.customers, to: '/users?role=CUSTOMER', icon: UsersIcon, hint: 'registered' },
          { label: 'Partners', value: totals.partners, to: '/partners', icon: Handshake, hint: 'businesses' },
          { label: 'Verified partners', value: totals.verifiedPartners, to: '/partners?verificationStatus=VERIFIED', icon: BadgeCheck, hint: 'KYC passed' },
          { label: 'Listings', value: totals.listings, to: '/listings', icon: Boxes, hint: 'total' },
          { label: 'Active listings', value: totals.activeListings, to: '/listings?status=PUBLISHED', icon: Warehouse, hint: 'published' },
          { label: 'Bookings', value: totals.bookings, to: '/bookings', icon: ClipboardCheck, hint: 'all time' },
          { label: 'Pending verifications', value: totals.pendingVerifications, to: '/verification-queue', icon: ClipboardCheck, hint: 'KYC queue' },
          { label: 'Pending listings', value: totals.pendingListings, to: '/listings?status=PENDING_REVIEW', icon: Boxes, hint: 'awaiting review' },
          { label: 'Pending bookings', value: totals.pendingBookings, to: '/bookings?status=PENDING_APPROVAL', icon: CalendarClock, hint: 'awaiting approval' },
          { label: 'Open disputes', value: totals.disputesOpen, to: '/disputes?status=OPEN', icon: AlertOctagon, hint: 'needs review' },
        ].map((s) => (
          <motion.div key={s.label} variants={fadeUp}>
            <Link to={s.to} className="stat-grid__link">
              <Stat label={s.label} value={s.value} hint={s.hint} icon={s.icon} format={(n) => formatNumber(n)} />
            </Link>
          </motion.div>
        ))}
      </motion.section>

      <div className="grid-2">
        <motion.section className="card" variants={fadeUp} initial="hidden" animate="show">
          <h2 className="card__title">Revenue · last {revenue.periodDays} days</h2>
          <RevenueBlock
            caption="Gross = successful payments. Net accounts for fees and refunds."
            items={[
              { label: 'Gross collected', value: formatMoneyCompact(revenue.grossCollected, currency) },
              { label: 'Platform fees', value: formatMoneyCompact(revenue.platformFees, currency) },
              { label: 'Refunds', value: formatMoneyCompact(revenue.refunds, currency), tone: revenue.refunds > 0 ? 'danger' : undefined },
              { label: 'Net collected', value: formatMoneyCompact(revenue.netCollected, currency), tone: 'success' },
            ]}
          />
          {grossSeries.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <SimpleLineChart
                data={grossSeries}
                height={180}
                formatValue={(v) => formatMoneyCompact(v, currency)}
                ariaLabel={`Gross collected per day over the last ${revenue.periodDays} days`}
              />
            </div>
          ) : null}
        </motion.section>

        <motion.section className="card" variants={fadeUp} initial="hidden" animate="show">
          <h2 className="card__title">Trends · bookings per day</h2>
          {trends.length === 0 ? (
            <p className="muted">No bookings in the last 14 days.</p>
          ) : (
            <SimpleBarChart
              data={trendSeries}
              height={244}
              formatValue={(v) => `${v} booking${v === 1 ? '' : 's'}`}
              formatSecondary={(v) => formatMoney(v, currency)}
              ariaLabel="Bookings per day over the last 14 days"
            />
          )}
        </motion.section>
      </div>

      <motion.section className="card" variants={fadeUp} initial="hidden" animate="show">
        <div className="card__head">
          <h2 className="card__title">Recent bookings</h2>
          <Link to="/bookings" className="card__link">
            View all <ArrowRight className="icon icon--sm" aria-hidden="true" />
          </Link>
        </div>
        {recentBookings.length === 0 ? (
          <EmptyState title="No bookings yet" hint="New bookings will appear here as soon as they come in." />
        ) : (
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
        )}
      </motion.section>
    </>
  );
}
