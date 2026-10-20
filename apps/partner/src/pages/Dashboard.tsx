import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  CalendarCheck,
  CheckCheck,
  CircleCheckBig,
  ClipboardList,
  Clock,
  FilePen,
  MessageSquare,
  Percent,
  RefreshCw,
  Star,
  TrendingUp,
  Wallet,
  Warehouse,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Stat, fadeUp, stagger } from '@bmw/ui';
import type { LucideIcon } from 'lucide-react';
import { api } from '../lib/api';
import { formatDayShort, formatMoney, relativeTime } from '../lib/format';
import type { BookingStatus, PartnerDashboardDTO, PartnerProfileDTO } from '../lib/types';
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
          <CheckCheck size={18} strokeWidth={2.2} />
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
          <RefreshCw size={17} strokeWidth={2.2} />
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
        <AlertTriangle size={17} strokeWidth={2.2} />
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

interface TrendDatum {
  label: string;
  bookings: number;
  revenue: number;
}

interface TrendTooltipProps {
  active?: boolean;
  payload?: { payload?: TrendDatum }[];
}

function TrendTooltip({ active, payload }: TrendTooltipProps) {
  const datum = payload?.[0]?.payload;
  if (!active || !datum) return null;
  return (
    <div className="trend-tooltip">
      <p className="trend-tooltip__label">{datum.label}</p>
      <p className="trend-tooltip__row">
        <span className="trend-tooltip__dot" style={{ background: 'var(--brand)' }} aria-hidden="true" />
        {formatMoney(datum.revenue)} gross
      </p>
      <p className="trend-tooltip__row">
        <span className="trend-tooltip__dot" style={{ background: 'var(--accent)' }} aria-hidden="true" />
        {datum.bookings} booking{datum.bookings === 1 ? '' : 's'}
      </p>
    </div>
  );
}

/**
 * Recharts composed chart (revenue area + booking bars) for the last 14 days.
 * Colors are wired through CSS vars — gradients use style props because var()
 * inside SVG presentation attributes is unreliable — so both themes render
 * correctly. The wrapper keeps the `role="img"` + aria-label contract.
 */
function TrendsChart({ trends }: { trends: { date: string; bookings: number; revenue: number }[] }) {
  if (trends.length === 0) {
    return <p className="muted">No booking activity in the last 14 days.</p>;
  }
  const data: TrendDatum[] = trends.map((trend) => ({
    label: formatDayShort(trend.date),
    bookings: trend.bookings,
    revenue: trend.revenue,
  }));

  return (
    <>
      <div className="trend-chart" role="img" aria-label="Bookings and revenue over the last 14 days">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap="28%">
            <defs>
              <linearGradient id="bmw-trend-revenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--brand)', stopOpacity: 0.32 }} />
                <stop offset="100%" style={{ stopColor: 'var(--brand)', stopOpacity: 0.02 }} />
              </linearGradient>
              <linearGradient id="bmw-trend-bookings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--accent)', stopOpacity: 0.95 }} />
                <stop offset="100%" style={{ stopColor: 'var(--accent)', stopOpacity: 0.55 }} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="trend-grid" />
            <XAxis
              dataKey="label"
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={10}
              className="trend-axis"
            />
            <YAxis yAxisId="revenue" hide domain={[0, 'dataMax + 1']} />
            <YAxis yAxisId="bookings" hide allowDecimals={false} domain={[0, 'dataMax + 1']} />
            <Tooltip
              cursor={{ fill: 'transparent', className: 'trend-cursor' }}
              content={<TrendTooltip />}
            />
            <Area
              yAxisId="revenue"
              type="monotone"
              dataKey="revenue"
              stroke="var(--brand)"
              strokeWidth={2.4}
              fill="url(#bmw-trend-revenue)"
              dot={false}
              activeDot={{ r: 4.5, strokeWidth: 0 }}
            />
            <Bar
              yAxisId="bookings"
              dataKey="bookings"
              fill="url(#bmw-trend-bookings)"
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="trend-legend" aria-hidden="true">
        <span className="trend-legend__item">
          <span className="trend-legend__swatch trend-legend__swatch--brand" />
          Gross revenue
        </span>
        <span className="trend-legend__item">
          <span className="trend-legend__swatch trend-legend__swatch--accent" />
          Bookings
        </span>
      </div>
    </>
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

  interface KeyStat {
    label: string;
    value: number | string;
    icon: LucideIcon;
    hint?: string;
    format?: (n: number) => string;
    to?: string;
  }

  const keyStats: KeyStat[] = [
    {
      label: 'Active listings',
      value: totals.activeListings,
      icon: Warehouse,
      to: '/listings?status=PUBLISHED',
    },
    {
      label: 'Drafts & in review',
      value: totals.draftListings,
      icon: FilePen,
      hint: totals.draftListings > 0 ? 'Waiting on approval' : undefined,
      to: '/listings',
    },
    {
      label: 'Pending requests',
      value: totals.pendingRequests,
      icon: ClipboardList,
      hint: totals.pendingRequests > 0 ? 'Needs your attention' : 'All caught up',
      to: '/bookings?status=PENDING_APPROVAL',
    },
    {
      label: 'Confirmed bookings',
      value: totals.confirmedBookings,
      icon: CalendarCheck,
      to: '/bookings?status=CONFIRMED',
    },
    {
      label: 'Completed bookings',
      value: totals.completedBookings,
      icon: CircleCheckBig,
      to: '/bookings?status=COMPLETED',
    },
    {
      label: 'Unread messages',
      value: totals.unreadMessages,
      icon: MessageSquare,
      hint: totals.unreadMessages > 0 ? 'Replies waiting' : undefined,
      to: '/messages',
    },
    {
      label: 'Average rating',
      value: totals.averageRating > 0 ? totals.averageRating : '—',
      format: totals.averageRating > 0 ? (n: number) => n.toFixed(1) : undefined,
      icon: Star,
      hint: `${totals.reviewCount} review${totals.reviewCount === 1 ? '' : 's'}`,
      to: '/reviews',
    },
    {
      label: 'Response rate',
      value: dashboard.responseRate,
      format: (n: number) => `${n.toFixed(1)}%`,
      icon: Percent,
      hint: dashboard.responseRate >= 90 ? 'Excellent' : 'Keep it up',
    },
  ];

  const revenueStats: KeyStat[] = [
    {
      label: 'Total earned',
      value: revenue.totalEarned,
      format: (n: number) => formatMoney(Math.round(n), revenue.currency),
      icon: Wallet,
      hint: 'After platform fee',
    },
    {
      label: 'Pending payout',
      value: revenue.pendingPayout,
      format: (n: number) => formatMoney(Math.round(n), revenue.currency),
      icon: Clock,
      hint: 'Next cycle',
    },
    {
      label: 'Last 30 days',
      value: revenue.last30Days,
      format: (n: number) => formatMoney(Math.round(n), revenue.currency),
      icon: TrendingUp,
      hint: 'Gross payments received',
    },
  ];

  return (
    <div className="page">
      {profile ? <VerificationBanner profile={profile} /> : null}

      <section aria-label="Key numbers">
        <motion.div
          className="stat-grid"
          variants={stagger(0.05)}
          initial="hidden"
          animate="show"
        >
          {keyStats.map((stat) => (
            <motion.div variants={fadeUp} key={stat.label}>
              {stat.to ? (
                <Link to={stat.to} className="stat-tile">
                  <Stat
                    label={stat.label}
                    value={stat.value}
                    format={stat.format}
                    hint={stat.hint}
                    icon={stat.icon}
                  />
                </Link>
              ) : (
                <Stat
                  label={stat.label}
                  value={stat.value}
                  format={stat.format}
                  hint={stat.hint}
                  icon={stat.icon}
                />
              )}
            </motion.div>
          ))}
        </motion.div>
      </section>

      <motion.section
        className="card revenue-block"
        aria-label="Revenue"
        variants={fadeUp}
        initial="hidden"
        animate="show"
      >
        <div className="revenue-block__header">
          <h2 className="card__title">Revenue</h2>
          <Link to="/earnings" className="btn btn--ghost btn--sm">
            View earnings →
          </Link>
        </div>
        <div className="stat-grid stat-grid--3">
          {revenueStats.map((stat) => (
            <Stat
              key={stat.label}
              label={stat.label}
              value={stat.value}
              format={stat.format}
              hint={stat.hint}
              icon={stat.icon}
            />
          ))}
        </div>
        <div className="revenue-block__chart-head">
          <h3 className="revenue-block__subtitle">Bookings & gross revenue — last 14 days</h3>
        </div>
        <TrendsChart trends={trends} />
      </motion.section>

      <motion.section
        className="card"
        aria-label="Pending booking requests"
        variants={fadeUp}
        initial="hidden"
        animate="show"
      >
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
      </motion.section>

      <motion.section
        className="card"
        aria-label="Upcoming bookings"
        variants={fadeUp}
        initial="hidden"
        animate="show"
      >
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
      </motion.section>
    </div>
  );
}

export default DashboardPage;
