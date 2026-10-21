import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ApiError, api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import { formatDateTime } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import type { MessageDTO, ConversationDTO } from '../lib/types';
import { ErrorState, PageLoader } from '../components/Skeleton';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { fadeUp, stagger } from '@bmw/ui';

const POLL_MS = 8000;
const PAGE_SIZE = 30;

export function ConversationPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();

  const [page, setPage] = useState(1);
  const threadState = useAsyncData(
    () => api.getWithMeta<{ items: MessageDTO[] }>(`/conversations/${id}/messages`, { page, limit: PAGE_SIZE }),
    [id, page],
  );
  const conversationState = useAsyncData<ConversationDTO>(() => api.get(`/conversations/${id}`), [id]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const markedReadRef = useRef(false);

  const messages = threadState.data?.data?.items ?? [];
  const pagination = threadState.data?.meta?.pagination;
  const conversation = conversationState.data;

  // Page meta
  const listingTitle = conversation?.listing?.title ?? 'Conversation';
  useDocumentMeta({
    title: `${listingTitle} — Messages — BookMyWarehouse`,
    description: `Conversation about ${listingTitle}`,
  });

  // Poll for new messages every 8 seconds while the thread is open.
  useEffect(() => {
    const timer = window.setInterval(() => threadState.reload(), POLL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Mark the conversation read once after the first successful load.
  useEffect(() => {
    if (markedReadRef.current || !threadState.data) return;
    markedReadRef.current = true;
    void api.post(`/conversations/${id}/read`, {}).catch(() => undefined);
  }, [threadState.data, id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages.length]);

  const send = async () => {
    if (!draft.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      await api.post(`/conversations/${id}/messages`, { body: draft.trim() });
      setDraft('');
      threadState.reload();
    } catch (error) {
      setSendError(error instanceof ApiError ? error.message : 'Could not send the message.');
    } finally {
      setSending(false);
    }
  };

  const onSend = (event: FormEvent) => {
    event.preventDefault();
    void send();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  // Load older messages
  const loadOlder = () => setPage((p) => p + 1);

  if (threadState.loading && !threadState.data) return <PageLoader label="Loading conversation…" />;
  if (threadState.error && !threadState.data) {
    return (
      <div className="container page">
        <ErrorState message={threadState.error.message} onRetry={threadState.reload} />
      </div>
    );
  }

  // Reverse for display (oldest first)
  const displayMessages = [...messages].reverse();

  return (
    <div className="container page conversation-page">
      <motion.nav className="breadcrumbs reveal" aria-label="Breadcrumb" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Link to="/messages">Messages</Link> <span aria-hidden="true">/</span>{' '}
        <span aria-current="page">{listingTitle}</span>
      </motion.nav>

      <motion.div className="card chat-card" variants={stagger(0.06)} initial="hidden" animate="show">
        <motion.div className="chat-scroll" role="log" aria-label="Conversation messages" variants={fadeUp}>
          <AnimatePresence mode="wait">
            {pagination && pagination.total > messages.length ? (
              <motion.button
                key="older"
                type="button"
                className="link-btn chat-older"
                onClick={loadOlder}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                Load older messages
              </motion.button>
            ) : null}
          </AnimatePresence>

          {messages.length === 0 ? (
            <motion.div className="chat-empty" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="muted" style={{ marginBottom: '0.75rem' }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <p className="muted">No messages yet. Say hello 👋</p>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {displayMessages.map((message, index) => {
                const mine = message.sender.id === user?.id;
                const isFirstOfSender = index === 0 || displayMessages[index - 1].sender.id !== message.sender.id;
                return (
                  <motion.div
                    key={message.id}
                    className={`chat-bubble ${mine ? 'mine' : 'theirs'} ${isFirstOfSender ? 'first-of-sender' : ''}`}
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {isFirstOfSender && !mine && (
                      <motion.div className="chat-bubble-avatar" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
                        {message.sender.avatarUrl ? (
                          <img src={message.sender.avatarUrl} alt="" className="avatar" />
                        ) : (
                          <span className="avatar avatar-fallback" aria-hidden="true">{message.sender.name.charAt(0).toUpperCase()}</span>
                        )}
                      </motion.div>
                    )}
                    <div className="chat-bubble-content">
                      <div className="chat-bubble-meta">
                        <strong>{mine ? 'You' : message.sender.name}</strong>
                        <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
                      </div>
                      <p>{message.body}</p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
          <div ref={bottomRef} />
        </motion.div>

        <motion.form
          ref={composerRef}
          className="chat-composer glass-inset"
          onSubmit={onSend}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <AnimatePresence>
            {sendError ? (
              <motion.p className="text-danger" role="alert" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                {sendError}
              </motion.p>
            ) : null}
          </AnimatePresence>
          <label htmlFor="chat-input" className="visually-hidden">
            Type a message
          </label>
          <textarea
            id="chat-input"
            className="textarea"
            rows={2}
            maxLength={4000}
            placeholder="Type a message… (Enter to send, Shift+Enter for a new line)"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            disabled={sending}
            aria-busy={sending}
          />
          <motion.button
            type="submit"
            className="btn btn-primary"
            disabled={sending || !draft.trim()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {sending ? 'Sending…' : 'Send'}
          </motion.button>
        </motion.form>
      </motion.div>
    </div>
  );
}