import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import { formatDateTime, humanize } from '../lib/format';
import type { DisputeDTO } from '../lib/types';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, ErrorState, PageLoader } from '../components/Skeleton';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { fadeUp, stagger } from '@bmw/ui';

export function DisputesPage() {
  useDocumentMeta({
    title: 'Disputes — BookMyWarehouse',
    description: 'Disputes you have raised against bookings.',
  });

  const disputes = useAsyncData(() => api.getWithMeta<{ items: DisputeDTO[]; total: number }>('/disputes', { limit: 20 }), []);
  const items = disputes.data?.data?.items ?? [];

  return (
    <div className="container page">
      <motion.div className="page-head reveal" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1>Disputes</h1>
        <p className="muted">
          {typeof disputes.data?.data?.total === 'number'
            ? `${disputes.data.data.total} dispute${disputes.data.data.total === 1 ? '' : 's'} raised by you.`
            : 'Disputes you have raised against bookings.'}
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        {disputes.loading ? (
          <PageLoader key="loading" label="Loading disputes…" />
        ) : disputes.error ? (
          <ErrorState key="error" message={disputes.error.message} onRetry={disputes.reload} />
        ) : items.length === 0 ? (
          <motion.div
            key="empty"
            className="state-block reveal"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="state-icon" aria-hidden="true">
              🛡️
            </div>
            <h3 className="state-title">No disputes</h3>
            <p className="state-message">If a booking goes wrong you can raise a dispute from the booking detail page.</p>
            <Link to="/bookings" className="btn btn-outline">
              View my bookings
            </Link>
          </motion.div>
        ) : (
          <motion.ul key="list" className="card-list" variants={stagger(0.06)} initial="hidden" animate="show">
            {items.map((dispute) => (
              <motion.li key={dispute.id} className="card section-card dispute-card" variants={fadeUp} whileHover={{ y: -2, boxShadow: 'var(--shadow-md)' }}>
                <div className="booking-row-head">
                  <strong className="mono">{dispute.reference}</strong>
                  <StatusBadge status={dispute.status} kind="dispute" />
                </div>
                <p className="muted">
                  Booking{' '}
                  <Link to={`/bookings/${dispute.bookingId}`} className="mono">
                    {dispute.bookingReference}
                  </Link>{' '}
                  · Reason: <strong>{humanize(dispute.reason)}</strong> · Against {humanize(dispute.againstParty)}
                </p>
                <p>{dispute.description}</p>
                {dispute.resolutionNote ? (
                  <p className="form-success">Resolution: {dispute.resolutionNote}</p>
                ) : null}
                <p className="muted">
                  Opened {formatDateTime(dispute.createdAt)} · Updated {formatDateTime(dispute.updatedAt)}
                </p>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}