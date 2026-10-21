import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { api, type Pagination as PaginationMeta } from '../lib/api';
import { humanize, mapNotificationLink, relativeTime } from '../lib/format';
import type { NotificationDTO } from '../lib/types';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, ListSkeleton } from '../components/States';
import { useToast } from '../components/Toast';
import { fadeUp, stagger } from '@bmw/ui';

export function NotificationsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [unread, setUnread] = useState(0);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.list<NotificationDTO, { items: NotificationDTO[]; unread?: number }>('/notifications', {
        page,
        limit: 20,
        unreadOnly: unreadOnly ? 'true' : undefined,
      });
      setItems(result.items);
      setPagination(result.pagination);
      setUnread(result.data.unread ?? 0);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page, unreadOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(ids?: string[]): Promise<void> {
    setMarking(true);
    try {
      await api.post('/notifications/read', ids ? { ids } : {});
      toast.success(ids ? 'Marked as read.' : 'All notifications marked as read.');
      await load();
    } catch (err) {
      toast.errorFrom(err, 'Could not mark as read');
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="page">
      <motion.div className="page__intro" variants={fadeUp} initial="hidden" animate="show">
        <h2>Notifications</h2>
        <p className="muted">Booking requests, messages, reviews and admin decisions — all in one place.</p>
      </motion.div>

      <motion.div className="page__toolbar" variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.1 }}>
        <div className="filters">
          <div className="tabs tabs--inline" role="tablist" aria-label="Notification filter">
            <button
              type="button"
              role="tab"
              aria-selected={!unreadOnly}
              className={`tab ${!unreadOnly ? 'tab--active' : ''}`}
              onClick={() => {
                setUnreadOnly(false);
                setPage(1);
              }}
            >
              All
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={unreadOnly}
              className={`tab ${unreadOnly ? 'tab--active' : ''}`}
              onClick={() => {
                setUnreadOnly(true);
                setPage(1);
              }}
            >
              Unread {unread > 0 ? `({unread})` : ''}
            </button>
          </div>
        </div>
        {unread > 0 ? (
          <button type="button" className="btn btn--secondary" onClick={() => void markRead()} disabled={marking}>
            {marking ? 'Marking…' : 'Mark all as read'}
          </button>
        ) : null}
      </motion.div>

      {loading ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void load()} title="Could not load notifications" />
      ) : items.length === 0 ? (
        <motion.div className="card" variants={fadeUp} initial="hidden" animate="show">
          <EmptyState title={unreadOnly ? 'No unread notifications' : 'No notifications yet'} description="Booking requests, messages, reviews and admin decisions will show up here." />
        </motion.div>
      ) : (
        <>
          <motion.ul
            className="notification-list"
            variants={stagger(0.05)}
            initial="hidden"
            animate="show"
          >
            {items.map((item) => (
              <motion.li
                key={item.id}
                className={`card notification-item ${item.read ? '' : 'notification-item--unread'}`}
                variants={fadeUp}
              >
                <div className="notification-item__type">{humanize(item.type)}</div>
                <div className="notification-item__body">
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  <span className="muted">{relativeTime(item.createdAt)}</span>
                </div>
                <div className="notification-item__actions">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate(mapNotificationLink(item.link))}>
                    Open
                  </button>
                  {!item.read ? (
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => void markRead([item.id])} disabled={marking}>
                      Mark read
                    </button>
                  ) : null}
                </div>
              </motion.li>
            ))}
          </motion.ul>
          <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.2 }}>
            <Pagination pagination={pagination} onPage={setPage} />
          </motion.div>
        </>
      )}
    </div>
  );
}

export default NotificationsPage;