import { Schema, model, Document, Types } from 'mongoose';
import type { IAttachment, ITicket, IReply, IInternalNote, TicketStatus, TicketPriority } from '../types/ticket.types';

export interface AttachmentDocument extends IAttachment, Document {}
export interface ReplyDocument extends IReply, Document {}
export interface InternalNoteDocument extends IInternalNote, Document {}
export interface TicketDocument extends Omit<ITicket, 'assignedTo' | 'product'>, Document {
  assignedTo?: Types.ObjectId;
  product?: Types.ObjectId | null;
}

const attachmentSchema = new Schema<AttachmentDocument>(
  {
    key:      { type: String, required: true, trim: true },
    fileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true, lowercase: true },
    size:     { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const replySchema = new Schema<ReplyDocument>(
  {
    body:        { type: String, required: true, trim: true },
    authorName:  { type: String, required: true, trim: true },
    authorEmail: { type: String, required: true, trim: true, lowercase: true },
    isAgent:     { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const internalNoteSchema = new Schema<InternalNoteDocument>(
  {
    body:       { type: String, required: true, trim: true },
    authorId:   { type: String, required: true },
    authorName: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const ticketSchema = new Schema<TicketDocument>(
  {
    title:       { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['new', 'in_progress', 'resolved'] satisfies TicketStatus[],
      default: 'new',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'irrelevant'] satisfies TicketPriority[],
      default: 'medium',
    },
    authorName:    { type: String, required: true, trim: true },
    authorEmail:   { type: String, required: true, trim: true, lowercase: true },
    attachments:   { type: [attachmentSchema], default: [] },
    replies:       { type: [replySchema], default: [] },
    product:       { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    assignedTo:    { type: Schema.Types.ObjectId, ref: 'User', default: null },
    internalNotes: { type: [internalNoteSchema], default: [] },
    // AI triage fields — populated by POST /api/ai/triage-ticket
    aiSummary:           { type: String, default: null },
    aiPriority:          { type: String, enum: ['low', 'medium', 'high', 'irrelevant', null], default: null },
    aiSuggestedNextStep: { type: String, default: null },
    aiTags:              { type: [String], default: [] },
    aiTriagedAt:         { type: Date, default: null },
    aiAutoAssigned:      { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Ticket = model<TicketDocument>('Ticket', ticketSchema);

