import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleDollarSign, TrendingDown, Wallet } from 'lucide-react';
import { Stat } from '@bmw/ui';
import { api, type Pagination as PaginationMeta } from '../lib/api';
import { formatDate, formatMoney } from '../lib/format';
import type { EarningRowDTO, PartnerProfileDTO } from '../lib/types';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, ErrorState, ListSkeleton } from '../components/States';

/**
 * NOTE: the API's earnings `summary` block currently returns zeros, so totals
 * are computed from the loaded rows (first `limit` rows, max 100 per page).
 */
export function EarningsPage() {
  const [items, setItems] = useState<EarningRowDTO[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [profile, setProfile] = useState<PartnerProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [result, profileData] = await Promise.all([
        api.list<EarningRowDTO>('/partner/earnings', { page, limit }),
        api.get<PartnerProfileDTO>('/partner/profile'),
      ]);
      setItems(result.items);
      setPagination(result.pagination);
      setProfile(profileData);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = items.reduce(
    (acc, item) => ({
      gross: acc.gross + (item.grossAmount ?? 0),
      fees: acc.fees + (item.platformFee ?? 0),
      net: acc.net + (item.netAmount ?? 0),
    }),
    { gross: 0, fees: 0, net: 0 },
  );
  const currency = items[0]?.currency ?? 'INR';

  const columns: Column<EarningRowDTO>[] = [
    { key: 'paidAt', header: 'Paid on', render: (row) => formatDate(row.paidAt) },
    { key: 'bookingReference', header: 'Booking', render: (row) => <span className="link-strong">{row.bookingReference}</span> },
    { key: 'listingTitle', header: 'Listing' },
    { key: 'grossAmount', header: 'Gross', align: 'end', render: (row) => formatMoney(row.grossAmount, row.currency) },
    { key: 'platformFee', header: 'Platform fee', align: 'end', render: (row) => `-${formatMoney(row.platformFee, row.currency)}` },
    {
      key: 'netAmount',
      header: 'Net earning',
      align: 'end',
      render: (row) => <strong>{formatMoney(row.netAmount, row.currency)}</strong>,
    },
  ];

  return (
    <div className="page">
      <div className="stat-grid stat-grid--3">
        <Stat
          label="Gross collected (loaded)"
          value={totals.gross}
          format={(n) => formatMoney(Math.round(n), currency)}
          icon={CircleDollarSign}
          hint="Sum of loaded rows"
        />
        <Stat
          label="Platform fees"
          value={totals.fees}
          format={(n) => `-${formatMoney(Math.round(n), currency)}`}
          icon={TrendingDown}
          hint="10% platform commission"
        />
        <Stat
          label="Net earnings (loaded)"
          value={totals.net}
          format={(n) => formatMoney(Math.round(n), currency)}
          icon={Wallet}
          hint="Paid to your account"
        />
      </div>

      {profile ? (
        <section className="card" aria-label="Payout profile">
          <div className="card__header">
            <h3 className="card__title">Payout profile</h3>
            <Link to="/onboarding" className="btn btn--ghost btn--sm">
              Manage payout details →
            </Link>
          </div>
          <dl className="detail-list detail-list--inline">
            <div>
              <dt>Business</dt>
              <dd>{profile.businessName}</dd>
            </div>
            <div>
              <dt>Verification</dt>
              <dd>
                <StatusBadge value={profile.verificationStatus} kind="verification" />
              </dd>
            </div>
            <div>
              <dt>Response rate</dt>
              <dd>{profile.responseRate != null ? `${profile.responseRate}%` : '—'}</dd>
            </div>
            <div>
              <dt>Account on file</dt>
              <dd className="muted">Bank details are stored masked (e.g. XXXX1234)</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {loading ? (
        <ListSkeleton rows={5} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void load()} title="Could not load earnings" />
      ) : (
        <>
          <div className="card card--flush">
            {items.length === 0 ? (
              <EmptyState
                title="No earnings yet"
                description="Earnings appear here after customers pay for your bookings. Payouts are settled to your bank account."
                action={
                  <Link to="/listings" className="btn btn--primary">
                    Manage listings
                  </Link>
                }
              />
            ) : (
              <DataTable columns={columns} rows={items} rowKey={(row) => row.id} caption="Earnings" />
            )}
          </div>
          <Pagination pagination={pagination} onPage={setPage} />
        </>
      )}
    </div>
  );
}

export default EarningsPage;
