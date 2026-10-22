import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDateTime, initials } from '../lib/format';
import type { ConversationDTO, MessageDTO } from '../lib/types';
import { ErrorState, ListSkeleton } from '../components/States';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { otherParticipant } from './Messages';

const POLL_MS = 8000;

export function ConversationPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [conversation, setConversation] = useState<ConversationDTO | null>(null);
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasUnread = messages.some((message) => message.sender.id !== user?.id && !message.readBy?.includes(user?.id ?? ''));

  const load = useCallback(async () => {
    try {
      const [conversationList, messagePage] = await Promise.all([
        api.list<ConversationDTO>('/conversations', { limit: 50 }),
        api.get<{ items: MessageDTO[] }>(`/conversations/${id}/messages`, { page: 1, limit: 100 }),
      ]);
      const found = conversationList.items.find((item) => item.id === id) ?? null;
      setConversation(found);
      const items = messagePage.items ?? [];
      setMessages(items);
      return items;
    } catch (err) {
      if (loading) setError(err);
      throw err;
    }
  }, [id, loading]);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    load()
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` is recreated when `loading` flips, and this effect itself sets `loading`: adding it would loop forever.
  }, [id]);

  // Poll every 8s while the thread is open; mark incoming messages read.
  useEffect(() => {
    const timer = setInterval(() => {
      void load()
        .then((items) => {
          const incomingUnread = items.some((message) => message.sender.id !== user?.id && !message.readBy?.includes(user?.id ?? ''));
          if (incomingUnread) void api.post(`/conversations/${id}/read`).catch(() => undefined);
        })
        .catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load`'s identity tracks the `loading` flag; adding it would tear down and restart the poll interval on every load-state transition.
  }, [id, user?.id]);

  // Mark unread messages read on open.
  useEffect(() => {
    if (!loading && hasUnread) {
      void api.post(`/conversations/${id}/read`).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on open/load only; depending on `hasUnread` would POST a mark-read request on every incoming message.
  }, [loading, id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function sendMessage(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const message = await api.post<MessageDTO>(`/conversations/${id}/messages`, { body });
      setMessages((current) => [...current, message]);
      setDraft('');
    } catch (error) {
      toast.errorFrom(error, 'Could not send the message');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <ListSkeleton rows={6} />
      </div>
    );
  }
  if (error || !conversation) {
    return (
      <div className="page">
        <ErrorState error={error ?? new Error('Conversation not found')} onRetry={() => void load().catch(() => undefined)} title="Could not load the conversation" />
      </div>
    );
  }

  const other = otherParticipant(conversation, user?.id);

  return (
    <div className="page page--chat">
      <header className="chat-header card">
        <span className="avatar">{initials(other?.name)}</span>
        <div>
          <h2>{other?.name ?? 'Conversation'}</h2>
          <p className="muted">
            {conversation.subject}
            {conversation.listing ? (
              <>
                {' · '}
                <Link to={`/listings/${conversation.listing.id}`}>{conversation.listing.title}</Link>
              </>
            ) : null}
          </p>
        </div>
        <Link to="/messages" className="btn btn--ghost chat-header__back">
          ← All messages
        </Link>
      </header>

      <div className="chat-thread card" role="log" aria-label="Message thread">
        {messages.length === 0 ? (
          <p className="muted chat-thread__empty">No messages yet — say hello!</p>
        ) : (
          messages.map((message) => {
            const mine = message.sender.id === user?.id;
            return (
              <div key={message.id} className={`chat-bubble ${mine ? 'chat-bubble--mine' : ''}`}>
                <div className="chat-bubble__body">{message.body}</div>
                <div className="chat-bubble__meta">
                  {mine ? 'You' : message.sender?.name} · {formatDateTime(message.createdAt)}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form className="chat-composer card" onSubmit={(event) => void sendMessage(event)}>
        <label className="sr-only" htmlFor="chat-input">
          Message
        </label>
        <textarea
          id="chat-input"
          className="input input--textarea"
          rows={2}
          placeholder={`Message ${other?.name ?? ''}…`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              (event.target as HTMLTextAreaElement).form?.requestSubmit();
            }
          }}
        />
        <button type="submit" className="btn btn--primary" disabled={sending || !draft.trim()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  );
}

export default ConversationPage;
