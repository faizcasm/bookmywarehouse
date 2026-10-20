import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Package } from 'lucide-react';
import { PartnerDecisionDialog, type PartnerDecision } from '../components/PartnerDecisionDialog';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, PageHeader, Skeleton } from '../components/States';
import { useToast } from '../components/Toast';
import { apiSend } from '../lib/api';
import { errorMessage, useFetch } from '../lib/hooks';
import { formatDateTime, formatDate, formatMoney } from '../lib/format';
import type { BookingDTO, PartnerDetailDTO } from '../lib/types';

export function PartnerDetailPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch<PartnerDetailDTO>(id ? `/admin/partners/${id}` : null);

  const [decisionOpen, setDecisionOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const submitDecision = async (input: { decision: PartnerDecision; reason: string | null; notes: string | null }) => {
    setBusy(true);
    setServerError(null);
    try {
      await apiSend('POST', `/admin/partners/${id}/decision`, input);
      toast.success(`Decision recorded for ${data?.businessName ?? 'partner'}.`);
      setDecisionOpen(false);
      reload();
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Skeleton rows={10} />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;

  const p = data;
  const kyc = p.verification;

  return (
    <>
      <PageHeader
        title={p.businessName}
        subtitle={`${p.businessType ?? 'Business'} · joined ${formatDate(p.createdAt)}`}
        actions={
          <>
            <Link to="/partners" className="btn btn--ghost btn--sm">
              <ArrowLeft aria-hidden="true" />
              All partners
            </Link>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setDecisionOpen(true)}>
              Record decision
            </button>
          </>
        }
      />

      <div className="detail-grid">
        <section className="card">
          <h2 className="card__title">Business profile</h2>
          <dl className="kv">
            <div className="kv__row">
              <dt>Verification</dt>
              <dd>
                <StatusBadge status={p.verificationStatus} group="verification" />
              </dd>
            </div>
            <div className="kv__row">
              <dt>Business type</dt>
              <dd>{p.businessType ?? '—'}</dd>
            </div>
            <div className="kv__row">
              <dt>Website</dt>
              <dd>
                {p.website ? (
                  <a href={p.website} target="_blank" rel="noreferrer">
                    {p.website}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div className="kv__row">
              <dt>Description</dt>
              <dd>{p.description ?? '—'}</dd>
            </div>
            <div className="kv__row">
              <dt>Payout account</dt>
              <dd>
                {p.payout?.accountNumberMasked ? (
                  <>
                    {p.payout.accountHolderName ?? '—'} · {p.payout.accountNumberMasked}
                    {p.payout.ifsc ? ` · ${p.payout.ifsc}` : ''}
                  </>
                ) : (
                  'Not provided'
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="card">
          <h2 className="card__title">Account owner</h2>
          {p.user ? (
            <dl className="kv">
              <div className="kv__row">
                <dt>Name</dt>
                <dd>{p.user.name}</dd>
              </div>
              <div className="kv__row">
                <dt>Email</dt>
                <dd>{p.user.email}</dd>
              </div>
              <div className="kv__row">
                <dt>Phone</dt>
                <dd>{p.user.phone ?? '—'}</dd>
              </div>
              <div className="kv__row">
                <dt>Account status</dt>
                <dd>
                  <StatusBadge status={p.user.status} group="account" />
                </dd>
              </div>
              <div className="kv__row">
                <dt>Email verified</dt>
                <dd>{p.user.emailVerified ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          ) : (
            <p className="muted">Linked user no longer exists.</p>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card__head">
          <h2 className="card__title">KYC verification</h2>
          {kyc ? <StatusBadge status={kyc.status} group="verification" /> : <span className="badge badge--neutral">No submission</span>}
        </div>
        {!kyc ? (
          <p className="muted">This partner has not submitted verification documents yet.</p>
        ) : (
          <>
            <dl className="kv kv--columns">
              <div className="kv__row">
                <dt>Legal business name</dt>
                <dd>{kyc.legalBusinessName ?? '—'}</dd>
              </div>
              <div className="kv__row">
                <dt>GSTIN</dt>
                <dd>
                  <code>{kyc.gstNumber ?? '—'}</code>
                </dd>
              </div>
              <div className="kv__row">
                <dt>PAN</dt>
                <dd>
                  <code>{kyc.panNumber ?? '—'}</code>
                </dd>
              </div>
              <div className="kv__row">
                <dt>Registration no.</dt>
                <dd>{kyc.registrationNumber ?? '—'}</dd>
              </div>
              <div className="kv__row">
                <dt>Submitted</dt>
                <dd>{formatDateTime(kyc.submittedAt)}</dd>
              </div>
              <div className="kv__row">
                <dt>Reviewed</dt>
                <dd>{formatDateTime(kyc.reviewedAt)}</dd>
              </div>
              {kyc.rejectionReason ? (
                <div className="kv__row">
                  <dt>Rejection reason</dt>
                  <dd className="text-danger">{kyc.rejectionReason}</dd>
                </div>
              ) : null}
              {kyc.reviewerNotes ? (
                <div className="kv__row">
                  <dt>Reviewer notes</dt>
                  <dd>{kyc.reviewerNotes}</dd>
                </div>
              ) : null}
            </dl>

            <h3 className="card__subtitle">Submitted documents</h3>
            <div className="doc-list">
              {kyc.documents.map((doc) => (
                <div key={doc.id} className="doc-item">
                  <div className="doc-item__main">
                    <a href={doc.url} target="_blank" rel="noreferrer" className="doc-item__label">
                      {doc.label}
                    </a>
                    <span className="muted">uploaded {formatDate(doc.uploadedAt)}</span>
                    {doc.rejectionReason ? <span className="text-danger">Reason: {doc.rejectionReason}</span> : null}
                  </div>
                  <span className={`badge badge--${doc.status === 'VERIFIED' ? 'success' : doc.status === 'REJECTED' ? 'danger' : 'warning'}`}>
                    {doc.status}
                  </span>
                </div>
              ))}
              {kyc.documents.length === 0 ? <p className="muted">No documents attached.</p> : null}
            </div>
          </>
        )}
      </section>

      <section className="card">
        <h2 className="card__title">Listings ({p.listings.length})</h2>
        {p.listings.length === 0 ? (
          <p className="muted">No listings yet.</p>
        ) : (
          <div className="listing-grid">
            {p.listings.map((l) => (
              <article key={l.id} className="listing-card">
                {l.coverImage ? (
                  <img src={l.coverImage} alt="" className="listing-card__img" loading="lazy" />
                ) : (
                  <div className="listing-card__img listing-card__img--placeholder" aria-hidden="true">
                    <Package strokeWidth={1.25} />
                  </div>
                )}
                <div className="listing-card__body">
                  <div className="listing-card__top">
                    <h3 className="listing-card__title">{l.title}</h3>
                    <StatusBadge status={l.status} group="listing" />
                  </div>
                  <p className="listing-card__meta">
                    {l.type} · {l.city}
                  </p>
                  <p className="listing-card__price">
                    {formatMoney(l.price.amount, l.price.currency)} {l.price.unitLabel ?? (l.price.period ? `/ ${l.price.period.toLowerCase()}` : '')}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="card__title">Recent bookings</h2>
        {p.recentBookings.length === 0 ? (
          <p className="muted">No bookings for this partner yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Customer</th>
                  <th>Start</th>
                  <th className="align-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {p.recentBookings.map((b: BookingDTO) => (
                  <tr key={b.id}>
                    <td data-label="Reference">
                      <Link to={`/bookings/${b.id}`} className="cell-link">
                        <code>{b.reference}</code>
                      </Link>
                    </td>
                    <td data-label="Status">
                      <StatusBadge status={b.status} group="booking" />
                    </td>
                    <td data-label="Customer">{b.customer?.name ?? '—'}</td>
                    <td data-label="Start">{formatDate(b.startDate)}</td>
                    <td data-label="Total" className="align-right">
                      {formatMoney(b.pricing?.total, b.pricing?.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PartnerDecisionDialog
        open={decisionOpen}
        businessName={p.businessName}
        currentStatus={p.verificationStatus}
        busy={busy}
        serverError={serverError}
        onConfirm={(input) => void submitDecision(input)}
        onCancel={() => setDecisionOpen(false)}
      />
    </>
  );
}
