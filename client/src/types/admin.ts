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
  avatarUrl?: string;
  mustChangePassword?: boolean;
  lastActiveAt?: string;
}

export interface InternalNote {
  _id: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface AdminTicketSummary extends TicketSummary {
  assignedTo: Pick<Agent, '_id' | 'name' | 'email' | 'isAiAgent' | 'avatarUrl'> | null;
  aiPriority?: 'low' | 'medium' | 'high' | 'irrelevant' | null;
  aiTriagedAt?: string | null;
  aiAutoAssigned?: boolean;
  aiEscalated?: boolean;
  product?: { _id: string; name: string; category: string; price?: number | null; imageUrl?: string | null } | null;
  // Customer Intelligence (populated when ticket has been analyzed)
  mktArchetype?: string | null;
  mktArchetypeLabel?: string | null;
  mktRefundIntent?: string | null;
  mktChurnRisk?: string | null;
  mktSentiment?: string | null;
  mktLifetimeValueSignal?: string | null;
  mktProfiledAt?: string | null;
}

export interface AdminTicketProduct {
  _id: string;
  name: string;
  category?: string;
  description?: string | null;
  slug?: string | null;
  price?: number | null;
  imageUrl?: string | null;
}

export interface AdminTicket extends Omit<Ticket, 'replies'> {
  replies: Reply[];
  assignedTo: Pick<Agent, '_id' | 'name' | 'email'> | null;
  product?: AdminTicketProduct | null;
  internalNotes: InternalNote[];
  aiSummary?: string | null;
  aiPriority?: 'low' | 'medium' | 'high' | 'irrelevant' | null;
  aiSuggestedNextStep?: string | null;
  aiTags?: string[];
  aiTriagedAt?: string | null;
  aiAutoAssigned?: boolean;
  aiEscalated?: boolean;
  // Customer Intelligence (persisted)
  mktArchetype?: string | null;
  mktArchetypeLabel?: string | null;
  mktArchetypeReason?: string | null;
  mktRefundIntent?: string | null;
  mktRefundIntentReason?: string | null;
  mktChurnRisk?: string | null;
  mktSentiment?: string | null;
  mktLifetimeValueSignal?: string | null;
  mktRecommendedApproach?: string | null;
  mktProfiledAt?: string | null;
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
  activeTheme: string | null;
}

export interface AdminProduct {
  _id: string;
  name: string;
  category: string;
  sku: string;
  description: string;
  imageUrl?: string | null;
}

export type CustomerArchetype = 'early_adopter' | 'loyal_advocate' | 'price_sensitive' | 'casual_buyer' | 'frustrated_veteran';

export interface CustomerProfileResult {
  archetype: CustomerArchetype;
  archetypeLabel: string;
  archetypeReason: string;
  refundIntent: 'low' | 'medium' | 'high';
  refundIntentReason: string;
  churnRisk: 'low' | 'medium' | 'high';
  sentiment: 'positive' | 'neutral' | 'frustrated' | 'hostile';
  lifetimeValueSignal: 'high' | 'medium' | 'low';
  recommendedApproach: string;
}

export interface RemarketingPitchResult {
  productSlug: string | null;
  shouldPitch: boolean;
  productId: string;
  productName: string;
  matchReason: string;
  pitchLine: string;
  appendedMessage: string;
  imageUrl?: string | null;
}

export interface AgentActivityTicket {
  _id: string;
  title: string;
  status: TicketStatus;
  aiPriority?: string | null;
  createdAt: string;
}

export interface AgentActivityReply {
  ticketId: string;
  ticketTitle: string;
  body: string;
  createdAt: string;
}

export interface AgentActivityStats {
  assigned: number;
  resolved: number;
  replies: number;
  notes: number;
}

export interface AgentRating {
  aiRating:             number | null;
  aiRatingExplanation:  string | null;
  aiRatingStrengths:    string[];
  aiRatingImprovements: string[];
  aiRatedAt:            string | null;
  manualRating:         number | null;
}

export interface AgentActivity {
  agent: Agent;
  stats: AgentActivityStats;
  assignedTickets: AgentActivityTicket[];
  recentReplies: AgentActivityReply[];
  rating: AgentRating;
}

export interface InsightsSnapshotMeta {
  _id:         string;
  healthScore: number;
  generatedAt: string;
  metrics: { totalTickets: number; openTickets: number; resolvedTickets: number; humanAgentCount: number };
}

export interface InsightsSnapshot extends InsightsSnapshotMeta {
  data: StoreInsightsResult;
}

export interface InsightsComparison {
  verdict:          'improving' | 'stable' | 'declining';
  healthScoreDelta: number;
  summary:          string;
  improvements:     { area: string; observation: string }[];
  declines:         { area: string; observation: string }[];
  newRisks:         string[];
  resolvedIssues:   string[];
}

export interface StoreInsightsResult {
  storeHealthScore:  number;
  executiveSummary:  string;
  topIssues:         { issue: string; urgency: 'high' | 'medium' | 'low'; recommendation: string }[];
  customerIntel:     { insight: string; action: string }[];
  revenueRisks:      { risk: string; magnitude: 'high' | 'medium' | 'low'; mitigation: string }[];
  opportunities:     { opportunity: string; potentialImpact: string }[];
  priorityActions:   { rank: number; action: string; rationale: string }[];
  vendorPerformance: {
    operationalScore: number;
    summary:          string;
    agentEfficiency:  { metric: string; reading: string; verdict: 'good' | 'ok' | 'concern' }[];
    blindSpots:       { issue: string; impact: string; fix: string }[];
    aiAgentRole:      { effectiveness: 'high' | 'medium' | 'low'; finding: string };
    strengths:        string[];
  };
}

export interface CoachMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentConversation {
  agentId:     string;
  agentName:   string;
  agentAvatar: string | null;
  lastBody:    string;
  lastAt:      string;
  unreadCount: number;
  isFromMe:    boolean;
}

export interface AgentMessageTicketRef {
  ticketId: string;
  title:    string;
  status:   string;
}

export interface AgentMessageProductRef {
  productId: string;
  name:      string;
  imageUrl?: string | null;
}

export interface AgentMessage {
  _id:         string;
  fromId:      string;
  toId:        string;
  body:        string;
  ticketRefs:  AgentMessageTicketRef[];
  productRefs: AgentMessageProductRef[];
  readAt:      string | null;
  createdAt:   string;
}

export type AdminTicketFilters = {
  status?: TicketStatus | 'all' | 'unresolved';
  priority?: TicketPriority | 'all';
  assignedTo?: string; // agentId | 'unassigned' | undefined
  tag?: string;
  page?: number;
  limit?: number;
};

export type NotificationType = 'ticket_assigned' | 'customer_replied' | 'ai_escalated';

export interface AppNotification {
  _id: string;
  type: NotificationType;
  ticketId: string;
  ticketTitle: string;
  message: string;
  read: boolean;
  createdAt: string;
}
