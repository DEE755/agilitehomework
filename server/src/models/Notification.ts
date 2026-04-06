import { Schema, model, Document, Types } from 'mongoose';

export type NotificationType = 'ticket_assigned' | 'customer_replied' | 'ai_escalated';

export interface INotification {
  agentId:     Types.ObjectId;
  type:        NotificationType;
  ticketId:    Types.ObjectId;
  ticketTitle: string;
  message:     string;
  read:        boolean;
}

export interface NotificationDocument extends INotification, Document {}

const notificationSchema = new Schema<NotificationDocument>(
  {
    agentId:     { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type:        { type: String, enum: ['ticket_assigned', 'customer_replied', 'ai_escalated'], required: true },
    ticketId:    { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    ticketTitle: { type: String, required: true },
    message:     { type: String, required: true },
    read:        { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Notification = model<NotificationDocument>('Notification', notificationSchema);
