import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDayShort, formatMoney, formatNumber, formatPercent, relativeTime } from '../lib/format';
import type { BookingStatus, PartnerDashboardDTO, PartnerProfileDTO } from '../lib/types';
import { StatCard } from '../components/StatCard';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, StatSkeleton } from '../components/States';

/** The API returns raw (unserialized) booking docs inside the dashboard payload. */
interface RawDashboardBooking {
  _id?: string;
  id?: string;
  reference?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  listingSnapshot?: { title?: string; city?: string };
  listing?: string | { id?: string; title?: string; city?: string };
  pricing?: { subtotalMinor?: number; totalMinor?: number };
}

function bookingId(booking: RawDashboardBooking): string {
  return booking._id ?? booking.id ?? '';
}

function bookingTitle(booking: RawDashboardBooking): string {
  if (booking.listingSnapshot?.title) return booking.listingSnapshot.title;
  if (booking.listing && typeof booking.listing === 'object' && booking.listing.title) return booking.listing.title;
  return 'Listing';
}

function bookingCity(booking: RawDashboardBooking): string {
  if (booking.listingSnapshot?.city) return booking.listingSnapshot.city;
  if (booking.listing && typeof booking.listing === 'object' && booking.listing.city) return booking.listing.city;
  return '';
}

function bookingAmount(booking: RawDashboardBooking): number | null {
  const amount = booking.pricing?.totalMinor ?? booking.pricing?.subtotalMinor;
  return typeof amount === 'number' ? amount : null;
}

function VerificationBanner({ profile }: { profile: PartnerProfileDTO }) {
  const status = profile.verificationStatus;
  if (status === 'VERIFIED') {
    return (
      <div className="banner banner--success">
        <span className="banner__icon" aria-hidden="true">
          ✓
        </span>
        <div>
          <strong>Your business is verified.</strong> <span>Your listings can go live once approved.</span>
        </div>
        <Link className="btn btn--secondary btn--sm" to="/profile">
          View profile
        </Link>
      </div>
    );
  }
  if (status === 'SUBMITTED' || status === 'UNDER_REVIEW') {
    return (
      <div className="banner banner--info">
        <span className="banner__icon" aria-hidden="true">
          ⟳
        </span>
        <div>
          <strong>Verification under review.</strong>{' '}
          <span>We received your documents and will get back to you shortly.</span>
        </div>
        <Link className="btn btn--secondary btn--sm" to="/onboarding">
          View submission
        </Link>
      </div>
    );
  }
  const rejected = status === 'REJECTED';
  return (
    <div className={`banner ${rejected ? 'banner--danger' : 'banner--warning'}`}>
      <span className="banner__icon" aria-hidden="true">
        !
      </span>
      <div>
        <strong>{rejected ? 'Verification was rejected.' : 'Finish verification to go live.'}</strong>{' '}
        <span>
          {rejected
            ? profile.verification?.rejectionReason ?? 'Please review the feedback and resubmit your documents.'
            : 'Complete your business profile and submit KYC documents.'}
        </span>
      </div>
      <Link className="btn btn--primary btn--sm" to="/onboarding">
        {rejected ? 'Resubmit verification' : 'Start onboarding'}
      </Link>
    </div>
  );
}

function TrendsChart({ trends }: { trends: { date: string; bookings: number; revenue: number }[] }) {
  if (trends.length === 0) {
    return <p className="muted">No booking activity in the last 14 days.</p>;
  }
  const max = Math.max(...trends.map((trend) => trend.revenue), 1);
  return (
    <div className="trend-chart" role="img" aria-label="Bookings and revenue over the last 14 days">
      {trends.map((trend) => {
        const height = Math.max(4, Math.round((trend.revenue / max) * 100));
        return (
          <div className="trend-chart__col" key={trend.date} title={`${formatDayShort(trend.date)} — ${trend.bookings} booking${trend.bookings === 1 ? '' : 's'}, ${formatMoney(trend.revenue)}`}>
            <div className="trend-chart__bar" style={{ height: `${height}%` }} />
            <span className="trend-chart__label">{formatDayShort(trend.date)}</span>
            <span className="trend-chart__value">{trend.bookings}×</span>
          </div>
        );
      })}
    </div>
  );
}

function RecentBookingRow({ booking }: { booking: RawDashboardBooking }) {
  const id = bookingId(booking);
  return (
    <tr>
      <td data-label="Reference">
        <Link to={`/bookings/${id}`} className="link-strong">
          {booking.reference ?? '—'}
        </Link>
      </td>
      <td data-label="Listing">
        {bookingTitle(booking)}
        {bookingCity(booking) ? <span className="muted"> · {bookingCity(booking)}</span> : null}
      </td>
      <td data-label="Start">{formatDayShort(booking.startDate)}</td>
      <td data-label="Amount" style={{ textAlign: 'right' }}>
        {bookingAmount(booking) !== null ? formatMoney(bookingAmount(booking)) : '—'}
      </td>
      <td data-label="Status">
        <StatusBadge value={(booking.status ?? '') as BookingStatus} kind="booking" />
      </td>
      <td data-label="" className="table-actions">
        {id ? <Link className="btn btn--ghost btn--sm" to={`/bookings/${id}`}>View</Link> : null}
      </td>
    </tr>
  );
}

export function DashboardPage() {
  const [dashboard, setDashboard] = useState<PartnerDashboardDTO | null>(null);
  const [profile, setProfile] = useState<PartnerProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashboardData, profileData] = await Promise.all([
        api.get<PartnerDashboardDTO>('/partner/dashboard'),
        api.get<PartnerProfileDTO>('/partner/profile'),
      ]);
      setDashboard(dashboardData);
      setProfile(profileData);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="page">
        <StatSkeleton count={4} />
      </div>
    );
  }
  if (error || !dashboard) {
    return (
      <div className="page">
        <ErrorState error={error} onRetry={() => void load()} />
      </div>
    );
  }

  const { totals, revenue, trends } = dashboard;
  const requests = (dashboard.recentRequests as unknown as RawDashboardBooking[]) ?? [];
  const upcoming = (dashboard.upcomingBookings as unknown as RawDashboardBooking[]) ?? [];

  return (
    <div className="page">
      {profile ? <VerificationBanner profile={profile} /> : null}

      <section aria-label="Key numbers">
        <div className="stat-grid">
          <StatCard label="Active listings" value={formatNumber(totals.activeListings)} icon="▦" to="/listings?status=PUBLISHED" />
          <StatCard label="Drafts & in review" value={formatNumber(totals.draftListings)} icon="✎" tone={totals.draftListings > 0 ? 'info' : 'default'} to="/listings" />
          <StatCard
            label="Pending requests"
            value={formatNumber(totals.pendingRequests)}
            icon="!"
            tone={totals.pendingRequests > 0 ? 'warning' : 'default'}
            hint={totals.pendingRequests > 0 ? 'Needs your attention' : 'All caught up'}
            to="/bookings?status=PENDING_APPROVAL"
          />
          <StatCard label="Confirmed bookings" value={formatNumber(totals.confirmedBookings)} icon="✓" tone="success" to="/bookings?status=CONFIRMED" />
          <StatCard label="Completed bookings" value={formatNumber(totals.completedBookings)} icon="★" to="/bookings?status=COMPLETED" />
          <StatCard label="Unread messages" value={formatNumber(totals.unreadMessages)} icon="✉" tone={totals.unreadMessages > 0 ? 'info' : 'default'} to="/messages" />
          <StatCard
            label="Average rating"
            value={totals.averageRating > 0 ? `${totals.averageRating.toFixed(1)} ★` : '—'}
            hint={`${totals.reviewCount} review${totals.reviewCount === 1 ? '' : 's'}`}
            to="/reviews"
          />
          <StatCard label="Response rate" value={formatPercent(dashboard.responseRate)} icon="↗" />
        </div>
      </section>

      <section className="card revenue-block" aria-label="Revenue">
        <div className="revenue-block__header">
          <h2 className="card__title">Revenue</h2>
          <Link to="/earnings" className="btn btn--ghost btn--sm">
            View earnings →
          </Link>
        </div>
        <div className="stat-grid stat-grid--3">
          <StatCard label="Total earned" value={formatMoney(revenue.totalEarned, revenue.currency)} hint="After platform fee" tone="success" />
          <StatCard label="Pending payout" value={formatMoney(revenue.pendingPayout, revenue.currency)} />
          <StatCard label="Last 30 days" value={formatMoney(revenue.last30Days, revenue.currency)} hint="Gross payments received" />
        </div>
        <h3 className="revenue-block__subtitle">Bookings & gross revenue — last 14 days</h3>
        <TrendsChart trends={trends} />
      </section>

      <section className="card" aria-label="Pending booking requests">
        <div className="card__header">
          <h2 className="card__title">Pending requests</h2>
          <Link to="/bookings?status=PENDING_APPROVAL" className="btn btn--ghost btn--sm">
            All requests →
          </Link>
        </div>
        {requests.length === 0 ? (
          <p className="muted">No pending booking requests right now.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <caption className="sr-only">Recent pending booking requests</caption>
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Listing</th>
                  <th scope="col">Start</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Amount</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {requests.map((booking) => (
                  <RecentBookingRow key={bookingId(booking)} booking={booking} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" aria-label="Upcoming bookings">
        <div className="card__header">
          <h2 className="card__title">Upcoming bookings</h2>
          <Link to="/bookings" className="btn btn--ghost btn--sm">
            All bookings →
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="muted">No upcoming bookings.</p>
        ) : (
          <ul className="booking-mini-list">
            {upcoming.map((booking) => (
              <li key={bookingId(booking)} className="booking-mini-list__item">
                <div>
                  <Link to={`/bookings/${bookingId(booking)}`} className="link-strong">
                    {bookingTitle(booking)}
                  </Link>
                  <div className="muted">
                    {booking.reference} · starts {relativeTime(booking.startDate)} ({formatDayShort(booking.startDate)})
                  </div>
                </div>
                <StatusBadge value={(booking.status ?? '') as BookingStatus} kind="booking" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default DashboardPage;
