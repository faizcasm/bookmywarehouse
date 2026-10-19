import { Link, useSearchParams } from 'react-router-dom';
import { ApiError, api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import { formatRelativeTime, humanize } from '../lib/format';
import type { NotificationDTO, NotificationsPayload } from '../lib/types';
import { Pagination } from '../components/Pagination';
import { useToast } from '../components/Toast';
import { EmptyState, ErrorState, PageLoader } from '../components/Skeleton';

/**
 * Notifications may carry partner-app links (`/dashboard/...`); map the ones
 * that make sense for this app onto customer routes, leave the rest inert.
 */
function normalizeLink(link?: string | null): string | null {
  if (!link) return null;
  if (link.startsWith('/dashboard/bookings/')) return `/bookings/${link.split('/').pop()}`;
  if (link.startsWith('/dashboard/listings/')) return null;
  if (link.startsWith('/dashboard')) return '/';
  return link;
}

const TYPE_ICONS: Record<string, string> = {
  BOOKING_REQUESTED: '📩',
  BOOKING_ACCEPTED: '✅',
  BOOKING_REJECTED: '❌',
  BOOKING_CANCELLED: '🚫',
  BOOKING_COMPLETED: '🎉',
  PAYMENT_SUCCEEDED: '💳',
  PAYMENT_FAILED: '⚠️',
  REFUND_PROCESSED: '↩️',
  INVOICE_GENERATED: '🧾',
  NEW_MESSAGE: '✉️',
  REVIEW_RECEIVED: '⭐',
  DISPUTE_OPENED: '🛡️',
  DISPUTE_RESOLVED: '⚖️',
  SYSTEM_ANNOUNCEMENT: '📣',
};

export function NotificationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const unreadOnly = searchParams.get('unreadOnly') === 'true';
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10) || 1;
  const toast = useToast();

  const notifications = useAsyncData(
    () => api.getWithMeta<NotificationsPayload>('/notifications', { page, limit: 20, unreadOnly: unreadOnly || undefined }),
    [page, unreadOnly],
  );

  const setUnreadOnly = (value: boolean) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set('unreadOnly', 'true');
    else params.delete('unreadOnly');
    params.delete('page');
    setSearchParams(params);
  };

  const items = notifications.data?.data?.items ?? [];

  const onMarkAll = async () => {
    try {
      await api.post('/notifications/read', {});
      toast.push('All notifications marked as read', 'success');
      notifications.reload();
    } catch (error) {
      toast.push(error instanceof ApiError ? error.message : 'Could not mark notifications as read', 'error');
    }
  };

  const onMarkOne = async (notification: NotificationDTO) => {
    if (notification.read) return;
    try {
      await api.post('/notifications/read', { ids: [notification.id] });
      notifications.reload();
    } catch {
      /* non-critical */
    }
  };

  return (
    <div className="container page">
      <div className="page-head booking-detail-head">
        <div>
          <h1>Notifications</h1>
          <p className="muted">
            {typeof notifications.data?.data?.unread === 'number'
              ? `${notifications.data.data.unread} unread`
              : 'Updates about your bookings, payments and messages.'}
          </p>
        </div>
        <div className="head-actions">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => setUnreadOnly(event.target.checked)}
            />
            <span>Unread only</span>
          </label>
          <button type="button" className="btn btn-outline btn-sm" onClick={onMarkAll}>
            Mark all read
          </button>
        </div>
      </div>

      {notifications.loading ? (
        <PageLoader label="Loading notifications…" />
      ) : notifications.error ? (
        <ErrorState message={notifications.error.message} onRetry={notifications.reload} />
      ) : items.length === 0 ? (
        <EmptyState
          title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
          message="Booking updates, new messages and payment confirmations land here."
        />
      ) : (
        <>
          <ul className="notification-list">
            {items.map((notification) => {
              const link = normalizeLink(notification.link);
              const content = (
                <>
                  <span className="notification-icon" aria-hidden="true">
                    {TYPE_ICONS[notification.type] ?? '🔔'}
                  </span>
                  <div className="notification-body">
                    <div className="notification-head">
                      <strong>{notification.title}</strong>
                      <time dateTime={notification.createdAt}>{formatRelativeTime(notification.createdAt)}</time>
                    </div>
                    <p>{notification.body}</p>
                    <span className="notification-type">{humanize(notification.type)}</span>
                  </div>
                  {!notification.read ? <span className="unread-dot" aria-label="Unread" /> : null}
                </>
              );
              return (
                <li key={notification.id} className={`card notification-row ${notification.read ? 'is-read' : 'is-unread'}`}>
                  {link ? (
                    <Link to={link} onClick={() => void onMarkOne(notification)}>
                      {content}
                    </Link>
                  ) : (
                    <div>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
          <Pagination
            pagination={notifications.data?.meta?.pagination ?? null}
            onPageChange={(next) => {
              const params = new URLSearchParams(searchParams);
              if (next > 1) params.set('page', String(next));
              else params.delete('page');
              setSearchParams(params);
            }}
          />
        </>
      )}
    </div>
  );
}
