import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, api } from '../lib/api';
import { useAsyncData } from '../lib/useAsyncData';
import { formatDateTime } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import type { MessageDTO } from '../lib/types';
import { ErrorState, PageLoader } from '../components/Skeleton';

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
  const bottomRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const markedReadRef = useRef(false);

  const messages = threadState.data?.data?.items ?? [];
  const pagination = threadState.data?.meta?.pagination;

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

  useEffect(() => {
    if (messages.length > 0) bottomRef.current?.scrollIntoView({ block: 'end' });
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

  if (threadState.loading && !threadState.data) return <PageLoader label="Loading conversation…" />;
  if (threadState.error && !threadState.data) {
    return (
      <div className="container page">
        <ErrorState message={threadState.error.message} onRetry={threadState.reload} />
      </div>
    );
  }

  return (
    <div className="container page conversation-page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/messages">Messages</Link> <span aria-hidden="true">/</span>{' '}
        <span aria-current="page">Conversation</span>
      </nav>

      <div className="card chat-card">
        <div className="chat-scroll" role="log" aria-label="Conversation messages">
          {pagination && pagination.total > messages.length ? (
            <button type="button" className="link-btn chat-older" onClick={() => setPage((p) => p + 1)}>
              Load older messages
            </button>
          ) : null}
          {messages.length === 0 ? (
            <p className="muted chat-empty">No messages yet. Say hello 👋</p>
          ) : (
            messages.map((message) => {
              const mine = message.sender.id === user?.id;
              return (
                <div key={message.id} className={`chat-bubble ${mine ? 'mine' : 'theirs'}`}>
                  <div className="chat-bubble-meta">
                    <strong>{mine ? 'You' : message.sender.name}</strong>
                    <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
                  </div>
                  <p>{message.body}</p>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form className="chat-composer" onSubmit={onSend}>
          {sendError ? (
            <p className="text-danger" role="alert">
              {sendError}
            </p>
          ) : null}
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
          />
          <button type="submit" className="btn btn-primary" disabled={sending || !draft.trim()}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
