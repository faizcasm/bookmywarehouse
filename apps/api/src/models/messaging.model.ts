import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  CONVERSATION_STATUSES,
  NOTIFICATION_TYPES,
  type ConversationStatus,
  type NotificationType,
} from '@bmw/shared-types';

export interface ConversationFields {
  subject: string;
  listing: Types.ObjectId | null;
  participants: Types.ObjectId[];
  lastMessage: { preview: string; at: Date; sender: Types.ObjectId } | null;
  status: ConversationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<ConversationFields>(
  {
    subject: { type: String, required: true, maxlength: 160 },
    listing: { type: Schema.Types.ObjectId, ref: 'Listing', default: null },
    participants: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], required: true },
    lastMessage: {
      type: new Schema<{ preview: string; at: Date; sender: Types.ObjectId }>(
        {
          preview: { type: String, required: true, maxlength: 200 },
          at: { type: Date, default: Date.now },
          sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    status: { type: String, enum: CONVERSATION_STATUSES, default: 'ACTIVE' },
  },
  { timestamps: true },
);

conversationSchema.index({ participants: 1, updatedAt: -1 });

export interface MessageFields {
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  body: string;
  readBy: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<MessageFields>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 4000 },
    readBy: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
  },
  { timestamps: true },
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, readBy: 1 });

export interface NotificationFields {
  user: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationFields>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 160 },
    body: { type: String, required: true, maxlength: 600 },
    link: { type: String, default: null, maxlength: 400 },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export const Conversation = model('Conversation',
  conversationSchema,
);
export const Message = model('Message', messageSchema);
export const Notification = model('Notification',
  notificationSchema,
);
