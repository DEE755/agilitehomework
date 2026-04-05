import type { TicketSummary, Ticket, Reply, TicketStatus, TicketPriority } from './ticket';

export interface AiTriageResult {
  summary: string;
  priority: 'low' | 'medium' | 'high';
  suggestedNextStep: string;
  tags: string[];
}

export interface AiSuggestReplyResult {
  summary:           string;
  priority:          'low' | 'medium' | 'high';
  tags:              string[];
  suggestedReply:    string;
  autoReplyEligible: boolean;
  confidence:        number;
  riskLevel:         'low' | 'medium' | 'high';
  reason:            string;
}

export type AgentRole = 'agent' | 'admin';

export interface Agent {
  _id: string;
  name: string;
  email: string;
  role: AgentRole;
  isAiAgent?: boolean;
}

export interface InternalNote {
  _id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface AdminTicketSummary extends TicketSummary {
  assignedTo: Pick<Agent, '_id' | 'name' | 'email' | 'isAiAgent'> | null;
  aiPriority?: 'low' | 'medium' | 'high' | 'irrelevant' | null;
  aiTriagedAt?: string | null;
  aiAutoAssigned?: boolean;
}

export interface AdminTicket extends Omit<Ticket, 'replies'> {
  replies: Reply[];
  assignedTo: Pick<Agent, '_id' | 'name' | 'email'> | null;
  internalNotes: InternalNote[];
  aiSummary?: string | null;
  aiPriority?: 'low' | 'medium' | 'high' | 'irrelevant' | null;
  aiSuggestedNextStep?: string | null;
  aiTags?: string[];
  aiTriagedAt?: string | null;
  aiAutoAssigned?: boolean;
}

export interface PaginatedAdminTickets {
  data: AdminTicketSummary[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export interface AdminStats {
  total: number;
  new: number;
  in_progress: number;
  resolved: number;
  unassigned: number;
}

export interface AppSettings {
  autoReplyEnabled: boolean;
}

export type AdminTicketFilters = {
  status?: TicketStatus | 'all';
  priority?: TicketPriority | 'all';
  assignedTo?: string; // agentId | 'unassigned' | undefined
  tag?: string;
  page?: number;
  limit?: number;
};
