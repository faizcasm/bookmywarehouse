import { Types } from 'mongoose';
import type { ConversationDTO, MessageDTO } from '@bmw/shared-types';
import type { z } from 'zod';
import type { createConversationSchema, sendMessageSchema, conversationListQuerySchema, messageListQuerySchema } from '@bmw/validation';
import { errors } from '../lib/errors.js';
import { Conversation, Listing, Message, User, type ConversationFields, type MessageFields } from '../models/index.js';
import { notify } from './notification.service.js';

type CreateConversationInput = z.infer<typeof createConversationSchema>;
type ConversationQuery = z.infer<typeof conversationListQuerySchema>;
type MessageQuery = z.infer<typeof messageListQuerySchema>;

export function serializeMessage(
  message: MessageFields & { _id: unknown },
  sender: { name: string; avatarUrl?: string | null; role?: string } | null,
): MessageDTO {
  return {
    id: String(message._id),
    conversationId: String(message.conversation),
    sender: {
      id: String(message.sender),
      name: sender?.name ?? 'User',
      role: (sender?.role ?? 'CUSTOMER') as MessageDTO['sender']['role'],
      avatarUrl: sender?.avatarUrl ?? null,
    },
    body: message.body,
    readBy: message.readBy.map((id) => String(id)),
    createdAt: new Date(message.createdAt).toISOString(),
  };
}

export async function createConversation(
  actorId: string,
  actorRole: string,
  input: CreateConversationInput,
): Promise<{ conversationId: string; messageId: string }> {
  let counterpartId: string | null = null;
  let listingId: string | null = null;

  if (input.listingId) {
    const listing = await Listing.findOne({ _id: input.listingId, deletedAt: null })
      .select('partner title')
      .lean();
    if (!listing) throw errors.notFound('Listing not found');
    listingId = String(listing._id);
    const partnerUserId = String(listing.partner);
    counterpartId = partnerUserId === actorId ? (input.toUserId ?? null) : partnerUserId;
  } else if (input.toUserId) {
    counterpartId = input.toUserId;
  }

  if (!counterpartId) {
    throw errors.badRequest('Choose a listing or a recipient to start a conversation');
  }
  if (counterpartId === actorId) {
    throw errors.badRequest('You cannot start a conversation with yourself');
  }
  const counterpart = await User.findById(counterpartId).select('_id status').lean();
  if (!counterpart || counterpart.status !== 'ACTIVE') {
    throw errors.notFound('Recipient not found');
  }

  const participantKey = [actorId, counterpartId].sort();
  const existing = await Conversation.findOne({
    participants: { $all: participantKey },
    ...(listingId ? { listing: new Types.ObjectId(listingId) } : {}),
    status: 'ACTIVE',
  }).lean();

  let conversationId: string;
  if (existing) {
    conversationId = String(existing._id);
  } else {
    const conversation = await Conversation.create({
      subject: input.subject,
      listing: listingId ? new Types.ObjectId(listingId) : null,
      participants: participantKey.map((id) => new Types.ObjectId(id)),
    });
    conversationId = String(conversation._id);
  }

  const message = await Message.create({
    conversation: new Types.ObjectId(conversationId),
    sender: new Types.ObjectId(actorId),
    body: input.body,
    readBy: [new Types.ObjectId(actorId)],
  });

  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessage: {
      preview: input.body.slice(0, 190),
      at: new Date(),
      sender: new Types.ObjectId(actorId),
    },
    updatedAt: new Date(),
  });

  await notify({
    userId: counterpartId,
    type: 'NEW_MESSAGE',
    title: 'New message',
    body: input.body.slice(0, 200),
    link: `/dashboard/messages?conversation=${conversationId}`,
  });

  return { conversationId, messageId: String(message._id) };
}

export async function listConversations(
  userId: string,
  query: ConversationQuery,
): Promise<{ items: ConversationDTO[]; total: number }> {
  const filter: Record<string, unknown> = {
    participants: new Types.ObjectId(userId),
    ...(query.includeArchived ? {} : { status: 'ACTIVE' }),
  };
  if (query.q) {
    filter.subject = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }

  const [docs, total] = await Promise.all([
    Conversation.find(filter)
      .sort({ updatedAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Conversation.countDocuments(filter),
  ]);

  const conversationIds = docs.map((d) => d._id);
  const unreadAgg = await Message.aggregate<{ _id: Types.ObjectId; count: number }>([
    {
      $match: {
        conversation: { $in: conversationIds },
        sender: { $ne: new Types.ObjectId(userId) },
        readBy: { $ne: new Types.ObjectId(userId) },
      },
    },
    { $group: { _id: '$conversation', count: { $sum: 1 } } },
  ]);
  const unreadMap = new Map(unreadAgg.map((u) => [String(u._id), u.count]));

  const userIds = [
    ...new Set(
      docs.flatMap((d) => d.participants.map((p) => String(p))).concat(
        docs.map((d) => String(d.lastMessage?.sender ?? '')).filter(Boolean),
      ),
    ),
  ];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('name avatarUrl role').lean()
    : [];
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const listingIds = docs.map((d) => d.listing).filter(Boolean);
  const listings = listingIds.length
    ? await Listing.find({ _id: { $in: listingIds } }).select('title slug images').lean()
    : [];
  const listingMap = new Map(listings.map((l) => [String(l._id), l]));

  const items: ConversationDTO[] = docs.map((doc) => {
    const listing = doc.listing ? listingMap.get(String(doc.listing)) : undefined;
    return {
      id: String(doc._id),
      subject: doc.subject,
      listing: listing
        ? { id: String(listing._id), title: listing.title, slug: listing.slug, coverImage: listing.images[0] ?? null }
        : null,
      participants: doc.participants.map((participant) => {
        const user = userMap.get(String(participant));
        return {
          user: {
            id: String(participant),
            name: user?.name ?? 'User',
            role: (user?.role ?? 'CUSTOMER') as ConversationDTO['participants'][number]['user']['role'],
            avatarUrl: user?.avatarUrl ?? null,
          },
          listingId: doc.listing ? String(doc.listing) : null,
        };
      }),
      lastMessage: doc.lastMessage
        ? {
            preview: doc.lastMessage.preview,
            at: new Date(doc.lastMessage.at).toISOString(),
            senderId: String(doc.lastMessage.sender),
          }
        : null,
      unreadCount: unreadMap.get(String(doc._id)) ?? 0,
      status: doc.status,
      updatedAt: new Date(doc.updatedAt).toISOString(),
      createdAt: new Date(doc.createdAt).toISOString(),
    };
  });

  return { items, total };
}

async function requireMembership(conversationId: string, userId: string) {
  if (!Types.ObjectId.isValid(conversationId)) throw errors.notFound('Conversation not found');
  const conversation = await Conversation.findById(conversationId).lean();
  if (!conversation) throw errors.notFound('Conversation not found');
  if (!conversation.participants.some((p) => String(p) === userId)) {
    throw errors.forbidden('You are not part of this conversation');
  }
  return conversation;
}

export async function getConversation(userId: string, conversationId: string): Promise<ConversationDTO> {
  const doc = await requireMembership(conversationId, userId);

  const userIds = [
    ...new Set(
      doc.participants.map((p) => String(p)).concat(String(doc.lastMessage?.sender ?? '')).filter(Boolean),
    ),
  ];
  const [users, listings, unreadAgg] = await Promise.all([
    userIds.length
      ? User.find({ _id: { $in: userIds } }).select('name avatarUrl role').lean()
      : Promise.resolve([]),
    doc.listing
      ? Listing.find({ _id: doc.listing }).select('title slug images').lean()
      : Promise.resolve([]),
    Message.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          conversation: new Types.ObjectId(conversationId),
          sender: { $ne: new Types.ObjectId(userId) },
          readBy: { $ne: new Types.ObjectId(userId) },
        },
      },
      { $group: { _id: '$conversation', count: { $sum: 1 } } },
    ]),
  ]);
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const listing = listings[0];
  const unreadCount = unreadAgg[0]?.count ?? 0;

  return {
    id: String(doc._id),
    subject: doc.subject,
    listing: listing
      ? { id: String(listing._id), title: listing.title, slug: listing.slug, coverImage: listing.images[0] ?? null }
      : null,
    participants: doc.participants.map((participant) => {
      const user = userMap.get(String(participant));
      return {
        user: {
          id: String(participant),
          name: user?.name ?? 'User',
          role: (user?.role ?? 'CUSTOMER') as ConversationDTO['participants'][number]['user']['role'],
          avatarUrl: user?.avatarUrl ?? null,
        },
        listingId: doc.listing ? String(doc.listing) : null,
      };
    }),
    lastMessage: doc.lastMessage
      ? {
          preview: doc.lastMessage.preview,
          at: new Date(doc.lastMessage.at).toISOString(),
          senderId: String(doc.lastMessage.sender),
        }
      : null,
    unreadCount,
    status: doc.status,
    updatedAt: new Date(doc.updatedAt).toISOString(),
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

export async function listMessages(
  userId: string,
  conversationId: string,
  query: MessageQuery,
): Promise<{ items: MessageDTO[]; total: number }> {
  await requireMembership(conversationId, userId);
  const filter: Record<string, unknown> = { conversation: new Types.ObjectId(conversationId) };
  if (query.before) filter.createdAt = { $lt: new Date(query.before) };

  const [docs, total] = await Promise.all([
    Message.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Message.countDocuments({ conversation: new Types.ObjectId(conversationId) }),
  ]);

  const senderIds = [...new Set(docs.map((d) => String(d.sender)))];
  const senders = senderIds.length
    ? await User.find({ _id: { $in: senderIds } }).select('name avatarUrl role').lean()
    : [];
  const senderMap = new Map(senders.map((s) => [String(s._id), s]));

  return {
    // Return oldest→newest inside the page for direct rendering.
    items: docs
      .slice()
      .reverse()
      .map((doc) =>
        serializeMessage(doc as unknown as MessageFields & { _id: unknown }, senderMap.get(String(doc.sender)) ?? null),
      ),
    total,
  };
}

export async function sendMessage(
  userId: string,
  conversationId: string,
  body: string,
): Promise<MessageDTO> {
  const conversation = await requireMembership(conversationId, userId);
  const message = await Message.create({
    conversation: new Types.ObjectId(conversationId),
    sender: new Types.ObjectId(userId),
    body,
    readBy: [new Types.ObjectId(userId)],
  });
  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessage: { preview: body.slice(0, 190), at: new Date(), sender: new Types.ObjectId(userId) },
    updatedAt: new Date(),
  });

  for (const participant of conversation.participants) {
    if (String(participant) === userId) continue;
    await notify({
      userId: String(participant),
      type: 'NEW_MESSAGE',
      title: 'New message',
      body: body.slice(0, 200),
      link: `/dashboard/messages?conversation=${conversationId}`,
    });
  }

  const sender = await User.findById(userId).select('name avatarUrl role').lean();
  return serializeMessage(message as unknown as MessageFields & { _id: unknown }, sender);
}

export async function markConversationRead(userId: string, conversationId: string): Promise<void> {
  await requireMembership(conversationId, userId);
  await Message.updateMany(
    { conversation: new Types.ObjectId(conversationId), readBy: { $ne: new Types.ObjectId(userId) } },
    { $addToSet: { readBy: new Types.ObjectId(userId) } },
  );
}

export async function unreadMessageCount(userId: string): Promise<number> {
  const conversations = await Conversation.find({ participants: new Types.ObjectId(userId) })
    .select('_id')
    .lean();
  if (conversations.length === 0) return 0;
  const agg = await Message.aggregate<{ total: number }>([
    {
      $match: {
        conversation: { $in: conversations.map((c) => c._id) },
        sender: { $ne: new Types.ObjectId(userId) },
        readBy: { $ne: new Types.ObjectId(userId) },
      },
    },
    { $count: 'total' },
  ]);
  return agg[0]?.total ?? 0;
}
