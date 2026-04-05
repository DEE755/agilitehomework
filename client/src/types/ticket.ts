export type TicketStatus = 'new' | 'in_progress' | 'resolved';
export type TicketPriority = 'low' | 'medium' | 'high' | 'irrelevant';

export interface Attachment {
  key: string;
  fileName: string;
  mimeType: string;
  size: number;
  url?: string;
}

export interface Reply {
  _id: string;
  body: string;
  authorName: string;
  authorEmail: string;
  isAgent?: boolean;
  createdAt: string;
}

export interface Ticket {
  _id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  authorName: string;
  authorEmail: string;
  attachments: Attachment[];
  replies: Reply[];
  createdAt: string;
  updatedAt: string;
}

// List endpoint omits replies array
export type TicketSummary = Omit<Ticket, 'replies'>;

export interface PaginatedTickets {
  data: TicketSummary[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export interface CreateTicketPayload {
  title: string;
  description: string;
  // priority omitted by customer — set by AI triage on the server
  authorName: string;
  authorEmail: string;
  productId?: string;
  productName?: string;
  productCategory?: string;
  attachments?: Attachment[];
}

export interface CreateReplyPayload {
  body: string;
  authorName: string;
  authorEmail: string;
}
