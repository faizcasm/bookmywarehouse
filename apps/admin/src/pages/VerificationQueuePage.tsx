import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { fadeUp, fadeSoft, stagger } from '@bmw/ui';
import { Eye, Gavel } from 'lucide-react';
import { Pagination } from '../components/Pagination';
import { PartnerDecisionDialog, type PartnerDecision } from '../components/PartnerDecisionDialog';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../components/States';
import { Tabs } from '../components/Tabs';
import { useToast } from '../components/Toast';
import { apiSend } from '../lib/api';
import { errorMessage, usePagedList } from '../lib/hooks';
import { formatDateTime } from '../lib/format';
import type { AdminPartnerListItem } from '../lib/types';

const QUEUE_TABS = [
  { id: 'SUBMITTED', label: 'Submitted' },
  { id: 'UNDER_REVIEW', label: 'Under review' },
  { id: 'VERIFIED', label: 'Verified' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'SUSPENDED', label: 'Suspended' },
];

export function VerificationQueuePage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'SUBMITTED';
  const page = Number(params.get('page') ?? '1') || 1;
  const limit = Number(params.get('limit') ?? '12') || 12;
  const toast = useToast();

  const { items, pagination, loading, error, reload } = usePagedList<AdminPartnerListItem>('/admin/verification-queue', {
    status,
    page,
    limit,
  });

  const [target, setTarget] = useState<AdminPartnerListItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const setStatus = (next: string) => {
    const nextParams = new URLSearchParams(params);
    if (next) nextParams.set('status', next);
    else nextParams.delete('status');
    nextParams.delete('page');
    setParams(nextParams, { replace: true });
  };

  const setPage = (p: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(p));
    setParams(next, { replace: true });
  };

  const submitDecision = async (input: { decision: PartnerDecision; reason: string | null; notes: string | null }) => {
    if (!target) return;
    setBusy(true);
    setServerError(null);
    try {
      await apiSend('POST', `/admin/partners/${target.partnerId}/decision`, input);
      toast.success(`${target.businessName}: ${input.decision.toLowerCase()} recorded.`);
      setTarget(null);
      reload();
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <motion.header variants={fadeUp} initial="hidden" animate="show">
        <PageHeader title="Verification queue" subtitle="Review partner KYC submissions" />
      </motion.header>
      <motion.div variants={stagger(0.05)} initial="hidden" animate="show">
        <Tabs tabs={QUEUE_TABS} active={status} onChange={setStatus} ariaLabel="Verification status" />
      </motion.div>

      {loading ? (
        <Skeleton rows={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <motion.div className="card" variants={fadeUp} initial="hidden" animate="show">
          <EmptyState title="Queue is clear" hint={`No partners with status ${status.toLowerCase().replace('_', ' ')}.`} />
        </motion.div>
      ) : (
        <motion.div className="queue-list" variants={stagger(0.06)} initial="hidden" animate="show">
          {items.map((p) => (
            <motion.article key={p.partnerId} className="card queue-item" variants={fadeSoft}>
              <div className="queue-item__main">
                <div className="queue-item__head">
                  <Link to={`/partners/${p.partnerId}`} className="cell-link">
                    <strong>{p.businessName}</strong>
                  </Link>
                  <StatusBadge status={p.verificationStatus} group="verification" />
                </div>
                <p className="muted">
                  {p.user?.name ?? '—'} · {p.user?.email ?? '—'}
                </p>
                <p className="queue-item__meta">
                  {p.businessType ?? 'Business'} · {p.city ?? 'Location n/a'} · {p.listingCount} listing
                  {p.listingCount === 1 ? '' : 's'} · submitted {formatDateTime(p.createdAt)}
                </p>
              </div>
              <div className="queue-item__actions">
                <Link to={`/partners/${p.partnerId}`} className="btn btn--ghost btn--sm">
                  <Eye aria-hidden="true" />
                  Review docs
                </Link>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => {
                    setServerError(null);
                    setTarget(p);
                  }}
                >
                  <Gavel aria-hidden="true" />
                  Decide
                </button>
              </div>
            </motion.article>
          ))}
        </motion.div>
      )}

      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <Pagination meta={pagination} limit={limit} onPageChange={setPage} />
      </motion.div>

      <PartnerDecisionDialog
        open={target !== null}
        businessName={target?.businessName ?? ''}
        currentStatus={target?.verificationStatus ?? ''}
        busy={busy}
        serverError={serverError}
        onConfirm={(input) => void submitDecision(input)}
        onCancel={() => setTarget(null)}
      />
    </>
  );
}
