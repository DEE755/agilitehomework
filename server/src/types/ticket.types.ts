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

export interface IProductSnapshot {
  _id: string;
  name: string;
  category?: string;
  description?: string | null;
  price?: number | null;
  imageUrl?: string | null;
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
  product?: IProductSnapshot | null;
  assignedTo?: string; // ref: User _id
  internalNotes: IInternalNote[];
  // AI triage
  aiSummary?: string | null;
  aiPriority?: TicketPriority | null;
  aiSuggestedNextStep?: string | null;
  aiTags?: string[];
  aiTriagedAt?: Date | null;
  aiAutoAssigned?: boolean;
  aiAssignedBy?: string | null;
  aiEscalated?: boolean;
  aiResolvedAt?: Date | null;
  // Customer Intelligence
  mktArchetype?: string | null;
  mktArchetypeLabel?: string | null;
  mktArchetypeReason?: string | null;
  mktRefundIntent?: string | null;
  mktRefundIntentReason?: string | null;
  mktChurnRisk?: string | null;
  mktSentiment?: string | null;
  mktLifetimeValueSignal?: string | null;
  mktRecommendedApproach?: string | null;
  mktProfiledAt?: Date | null;
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
  productDescription?: string;
  productPrice?: number;
  productImageUrl?: string;
  productSlug?: string;
  attachments?: IAttachment[];
}

export interface CreateReplyBody {
  body: string;
  authorName: string;
  authorEmail: string;
}
