export type TicketStatus = 'new' | 'in_progress' | 'resolved';
export type TicketPriority = 'low' | 'medium' | 'high' | 'irrelevant';

export interface IAttachment {
  key: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface IReply {
  body: string;
  authorName: string;
  authorEmail: string;
  isAgent?: boolean;
  createdAt?: Date;
}

export interface IInternalNote {
  body: string;
  authorId: string;
  authorName: string;
  createdAt?: Date;
}

export interface ITicket {
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  authorName: string;
  authorEmail: string;
  attachments: IAttachment[];
  replies: IReply[];
  product?: string; // ref: Product _id
  assignedTo?: string; // ref: User _id
  internalNotes: IInternalNote[];
  // AI triage
  aiSummary?: string | null;
  aiPriority?: TicketPriority | null;
  aiSuggestedNextStep?: string | null;
  aiTags?: string[];
  aiTriagedAt?: Date | null;
  aiAutoAssigned?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Shapes expected from request bodies
export interface CreateTicketBody {
  title: string;
  description: string;
  priority?: TicketPriority;
  authorName: string;
  authorEmail: string;
  productId?: string;
  productName?: string;
  productCategory?: string;
  attachments?: IAttachment[];
}

export interface CreateReplyBody {
  body: string;
  authorName: string;
  authorEmail: string;
}
