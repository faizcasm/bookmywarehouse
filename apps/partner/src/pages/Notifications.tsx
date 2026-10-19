import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Pagination as PaginationMeta } from '../lib/api';
import { humanize, mapNotificationLink, relativeTime } from '../lib/format';
import type { NotificationDTO } from '../lib/types';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, ListSkeleton } from '../components/States';
import { useToast } from '../components/Toast';

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
      <div className="page__toolbar">
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
              Unread {unread > 0 ? `(${unread})` : ''}
            </button>
          </div>
        </div>
        {unread > 0 ? (
          <button type="button" className="btn btn--secondary" onClick={() => void markRead()} disabled={marking}>
            {marking ? 'Marking…' : 'Mark all as read'}
          </button>
        ) : null}
      </div>

      {loading ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void load()} title="Could not load notifications" />
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState title={unreadOnly ? 'No unread notifications' : 'No notifications yet'} description="Booking requests, messages, reviews and admin decisions will show up here." />
        </div>
      ) : (
        <>
          <ul className="notification-list">
            {items.map((item) => (
              <li key={item.id} className={`card notification-item ${item.read ? '' : 'notification-item--unread'}`}>
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
              </li>
            ))}
          </ul>
          <Pagination pagination={pagination} onPage={setPage} />
        </>
      )}
    </div>
  );
}

export default NotificationsPage;
