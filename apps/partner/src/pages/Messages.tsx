import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { api, type Pagination as PaginationMeta } from '../lib/api';
import { initials, relativeTime } from '../lib/format';
import type { ConversationDTO } from '../lib/types';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, ListSkeleton } from '../components/States';
import { useAuth } from '../auth/AuthContext';
import { fadeUp, stagger } from '@bmw/ui';

export function otherParticipant(conversation: ConversationDTO, meId: string | undefined) {
  const other = conversation.participants?.find((participant) => participant.user.id !== meId);
  return other?.user ?? conversation.participants?.[0]?.user ?? null;
}

export function MessagesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ConversationDTO[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.list<ConversationDTO, { items: ConversationDTO[]; unreadTotal?: number }>('/conversations', {
        page,
        limit: 20,
      });
      setItems(result.items);
      setPagination(result.pagination);
      setUnreadTotal(result.data.unreadTotal ?? 0);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <ListSkeleton rows={5} />;
  if (error) return <ErrorState error={error} onRetry={() => void load()} title="Could not load conversations" />;

  return (
    <div className="page">
      <motion.div className="page__intro" variants={fadeUp} initial="hidden" animate="show">
        <h2>Messages</h2>
        <p className="muted">Conversations with customers about your listings. New messages appear at the top.</p>
      </motion.div>

      {items.length === 0 ? (
        <motion.div className="card" variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.1 }}>
          <EmptyState
            title="No conversations yet"
            description={
              unreadTotal === 0
                ? 'Messages from customers about your listings will appear here. You can also start a conversation from any booking.'
                : undefined
            }
            action={
              <Link to="/bookings" className="btn btn--secondary">
                Go to bookings
              </Link>
            }
          />
        </motion.div>
      ) : (
        <>
          <motion.div
            className="conversation-list"
            variants={stagger(0.05)}
            initial="hidden"
            animate="show"
          >
            {items.map((conversation) => {
              const other = otherParticipant(conversation, user?.id);
              return (
                <motion.div
                  key={conversation.id}
                  className={`conversation-card card ${conversation.unreadCount > 0 ? 'conversation-card--unread' : ''}`}
                  variants={fadeUp}
                >
                  <Link to={`/messages/${conversation.id}`}>
                    <span className="avatar">{initials(other?.name)}</span>
                    <div className="conversation-card__body">
                      <div className="conversation-card__top">
                        <strong>{other?.name ?? 'Conversation'}</strong>
                        <span className="muted">{relativeTime(conversation.lastMessage?.at ?? conversation.updatedAt)}</span>
                      </div>
                      <div className="conversation-card__subject">
                        {conversation.subject}
                        {conversation.unreadCount > 0 ? <span className="pill-badge">{conversation.unreadCount}</span> : null}
                      </div>
                      <p className="conversation-card__preview">{conversation.lastMessage?.preview ?? 'No messages yet'}</p>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
          <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.2 }}>
            <Pagination pagination={pagination} onPage={setPage} />
          </motion.div>
        </>
      )}
    </div>
  );
}

export default MessagesPage;