import { Schema, model, Document, Types } from 'mongoose';

export interface IAgentMessage {
  fromId: Types.ObjectId;
  toId:   Types.ObjectId;
  body:   string;
  ticketRefs:  { ticketId: Types.ObjectId; title: string; status: string }[];
  productRefs: { productId: Types.ObjectId; name: string; imageUrl?: string | null }[];
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentMessageDocument extends IAgentMessage, Document {}

const agentMessageSchema = new Schema<AgentMessageDocument>(
  {
    fromId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    toId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body:   { type: String, required: true, trim: true, maxlength: 4000 },
    ticketRefs: [
      {
        _id:      false,
        ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket' },
        title:    String,
        status:   String,
      },
    ],
    productRefs: [
      {
        _id:       false,
        productId: { type: Schema.Types.ObjectId, ref: 'Product' },
        name:      String,
        imageUrl:  { type: String, default: null },
      },
    ],
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

agentMessageSchema.index({ fromId: 1, toId: 1, createdAt: 1 });
agentMessageSchema.index({ toId: 1, readAt: 1 });

export const AgentMessage = model<AgentMessageDocument>('AgentMessage', agentMessageSchema);
