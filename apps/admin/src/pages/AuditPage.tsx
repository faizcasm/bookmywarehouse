import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { fadeUp, stagger } from '@bmw/ui';
import { DataTable, type Column } from '../components/DataTable';
import { Pagination } from '../components/Pagination';
import { ErrorState, PageHeader, Skeleton } from '../components/States';
import { usePagedList } from '../lib/hooks';
import { formatDateTime } from '../lib/format';
import type { AuditLogDTO } from '../lib/types';

const ENTITY_TYPES = ['', 'User', 'PartnerProfile', 'Listing', 'Booking', 'Payment', 'Refund', 'Dispute', 'Category', 'Review', 'PlatformSettings', 'Invoice'];

export function AuditPage() {
  const [params, setParams] = useSearchParams();
  const action = params.get('action') ?? '';
  const entityType = params.get('entityType') ?? '';
  const page = Number(params.get('page') ?? '1') || 1;
  const limit = Number(params.get('limit') ?? '25') || 25;
  const [actionDraft, setActionDraft] = useState(action);

  const { items, pagination, loading, error, reload } = usePagedList<AuditLogDTO>('/admin/audit-logs', {
    action: action || undefined,
    entityType: entityType || undefined,
    page,
    limit,
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const columns: Column<AuditLogDTO>[] = [
    { key: 'when', header: 'When', render: (a) => formatDateTime(a.createdAt) },
    {
      key: 'actor',
      header: 'Actor',
      render: (a) => (
        <div className="cell-stack">
          <span>{a.actor?.name ?? 'System'}</span>
          <span className="muted">{a.actor?.role ?? ''}</span>
        </div>
      ),
    },
    { key: 'action', header: 'Action', render: (a) => <code>{a.action}</code> },
    {
      key: 'entity',
      header: 'Entity',
      render: (a) => (
        <div className="cell-stack">
          <span>{a.entityType}</span>
          <span className="muted">
            <code>{a.entityId?.slice(-8)}</code>
          </span>
        </div>
      ),
    },
    { key: 'summary', header: 'Summary', render: (a) => a.summary ?? '—' },
    { key: 'ip', header: 'IP', secondary: true, render: (a) => a.ip ?? '—' },
    {
      key: 'metadata',
      header: 'Metadata',
      secondary: true,
      render: (a) =>
        a.metadata ? (
          <details className="meta-details">
            <summary>View</summary>
            <pre>{JSON.stringify(a.metadata, null, 2)}</pre>
          </details>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <>
      <motion.header variants={fadeUp} initial="hidden" animate="show">
        <PageHeader title="Audit log" subtitle="Every administrative action, newest first" />
      </motion.header>

      <motion.div className="toolbar glass-inset" variants={stagger(0.05)} initial="hidden" animate="show">
        <form
          className="toolbar__search"
          onSubmit={(e) => {
            e.preventDefault();
            setParam('action', actionDraft.trim());
          }}
        >
          <input
            className="input"
            type="search"
            placeholder="Filter by action, e.g. admin.listing"
            value={actionDraft}
            onChange={(e) => setActionDraft(e.target.value)}
            aria-label="Filter by action"
          />
          <button type="submit" className="btn btn--ghost btn--sm">
            Filter
          </button>
        </form>
        <select className="select" value={entityType} onChange={(e) => setParam('entityType', e.target.value)} aria-label="Filter by entity type">
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === '' ? 'All entity types' : t}
            </option>
          ))}
        </select>
      </motion.div>

      <motion.section className="card" variants={fadeUp} initial="hidden" animate="show">
        {loading ? (
          <Skeleton rows={8} />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <>
            <DataTable columns={columns} rows={items} getRowKey={(a) => a.id} emptyMessage="No audit entries match these filters." />
            <motion.div variants={fadeUp} initial="hidden" animate="show">
              <Pagination
                meta={pagination}
                limit={limit}
                onPageChange={(p) => setParam('page', String(p))}
                onLimitChange={(l) => {
                  const next = new URLSearchParams(params);
                  next.set('limit', String(l));
                  next.delete('page');
                  setParams(next, { replace: true });
                }}
              />
            </motion.div>
          </>
        )}
      </motion.section>
    </>
  );
}
