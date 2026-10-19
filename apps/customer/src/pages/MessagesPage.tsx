import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import { formatRelativeTime } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import type { ConversationDTO, ConversationPayload } from '../lib/types';
import { EmptyState, ErrorState, PageLoader } from '../components/Skeleton';

function counterpartNames(conversation: ConversationDTO, meId: string): string {
  const others = conversation.participants
    .map((participant) => participant.user)
    .filter((user) => user.id !== meId);
  if (others.length === 0) return conversation.participants.map((p) => p.user.name).join(', ');
  return others.map((user) => user.name).join(', ');
}

export function MessagesPage() {
  const { user } = useAuth();
  const conversations = useAsyncData(
    () => api.getWithMeta<ConversationPayload>('/conversations', { limit: 20 }),
    [],
  );

  const items = conversations.data?.data?.items ?? [];

  return (
    <div className="container page">
      <div className="page-head booking-detail-head">
        <div>
          <h1>Messages</h1>
          <p className="muted">
            {typeof conversations.data?.data?.unreadTotal === 'number' && conversations.data.data.unreadTotal > 0
              ? `${conversations.data.data.unreadTotal} unread message${conversations.data.data.unreadTotal === 1 ? '' : 's'}`
              : 'Conversations with partners about your bookings and listings.'}
          </p>
        </div>
      </div>

      {conversations.loading ? (
        <PageLoader label="Loading conversations…" />
      ) : conversations.error ? (
        <ErrorState message={conversations.error.message} onRetry={conversations.reload} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          message="Message a partner from any listing page to start a conversation."
          action={
            <Link to="/search" className="btn btn-primary">
              Explore listings
            </Link>
          }
        />
      ) : (
        <ul className="conversation-list">
          {items.map((conversation) => (
            <li key={conversation.id}>
              <Link to={`/messages/${conversation.id}`} className={`card conversation-row ${conversation.unreadCount > 0 ? 'is-unread' : ''}`}>
                {conversation.listing?.coverImage ? (
                  <img src={conversation.listing.coverImage} alt="" className="conversation-thumb" loading="lazy" />
                ) : (
                  <span className="avatar avatar-fallback" aria-hidden="true">
                    {counterpartNames(conversation, user?.id ?? '').charAt(0) || '?'}
                  </span>
                )}
                <div className="conversation-main">
                  <div className="conversation-head">
                    <strong>{counterpartNames(conversation, user?.id ?? '')}</strong>
                    <time dateTime={conversation.updatedAt}>{formatRelativeTime(conversation.updatedAt)}</time>
                  </div>
                  <span className="conversation-subject">{conversation.subject}</span>
                  {conversation.lastMessage ? (
                    <span className="conversation-preview muted">{conversation.lastMessage.preview}</span>
                  ) : null}
                </div>
                {conversation.unreadCount > 0 ? (
                  <span className="badge tone-accent" aria-label={`${conversation.unreadCount} unread`}>
                    {conversation.unreadCount}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
