import type {
  AdminStats,
  AdminTicket,
  PaginatedAdminTickets,
  Agent,
  AgentActivity,
  AdminTicketFilters,
  AiTriageResult,
  AiSuggestReplyResult,
  AppSettings,
  AdminProduct,
  CustomerProfileResult,
  RemarketingPitchResult,
  CoachMessage,
  AppNotification,
  StoreInsightsResult,
} from '../types/admin';
import type { InternalNote } from '../types/admin';
import type { Reply, TicketStatus, TicketPriority } from '../types/ticket';

const TOKEN_KEY = 'ag_admin_token';
const AGENT_KEY = 'ag_admin_agent';
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export interface StoredAgent {
  _id: string;
  name: string;
  email: string;
  role: string;
  mustChangePassword?: boolean;
  avatarUrl?: string;
}

export function getStoredAgent(): StoredAgent | null {
  try {
    const raw = localStorage.getItem(AGENT_KEY);
    return raw ? (JSON.parse(raw) as StoredAgent) : null;
  } catch {
    return null;
  }
}

function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/admin${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...init?.headers,
    },
    ...init,
  });

  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(AGENT_KEY);
    window.location.href = `/admin/login?redirect=${encodeURIComponent(window.location.pathname)}`;
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

async function aiReq<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}/ai${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = `/admin/login?redirect=${encodeURIComponent(window.location.pathname)}`;
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(errBody.error ?? `AI request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

export const adminApi = {
  stats(): Promise<{ data: AdminStats }> {
    return req('/stats');
  },

  tickets: {
    list(filters: AdminTicketFilters = {}): Promise<PaginatedAdminTickets> {
      const p = new URLSearchParams();
      if (filters.status && filters.status !== 'all') p.set('status', filters.status);
      if (filters.priority && filters.priority !== 'all') p.set('priority', filters.priority);
      if (filters.assignedTo) p.set('assignedTo', filters.assignedTo);
      if (filters.tag)        p.set('tag', filters.tag);
      if (filters.page)  p.set('page',  String(filters.page));
      if (filters.limit) p.set('limit', String(filters.limit));
      const qs = p.toString();
      return req<PaginatedAdminTickets>(`/tickets${qs ? `?${qs}` : ''}`);
    },

    get(id: string): Promise<{ data: AdminTicket }> {
      return req(`/tickets/${id}`);
    },

    updateStatus(id: string, status: TicketStatus): Promise<{ data: AdminTicket }> {
      return req(`/tickets/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },

    updatePriority(id: string, priority: TicketPriority): Promise<{ data: AdminTicket }> {
      return req(`/tickets/${id}/priority`, {
        method: 'PATCH',
        body: JSON.stringify({ priority }),
      });
    },

    assign(id: string, agentId: string | null): Promise<{ data: AdminTicket }> {
      return req(`/tickets/${id}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ agentId }),
      });
    },

    addNote(id: string, body: string): Promise<{ data: InternalNote }> {
      return req(`/tickets/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
    },

    reply(id: string, body: string): Promise<{ data: Reply }> {
      return req(`/tickets/${id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
    },
  },

  agents(): Promise<{ data: Agent[] }> {
    return req('/agents');
  },

  createAgent(data: { name: string; email: string; role: 'agent' | 'admin' }): Promise<{ data: Agent }> {
    return req('/agents', { method: 'POST', body: JSON.stringify(data) });
  },

  changePassword(data: { currentPassword: string; newPassword: string }): Promise<{ data: { ok: boolean } }> {
    return req('/profile/password', { method: 'PATCH', body: JSON.stringify(data) });
  },

  presignAvatar(contentType: string): Promise<{ data: { uploadUrl: string; key: string; expiresIn: number } }> {
    return req('/profile/avatar/presign', { method: 'POST', body: JSON.stringify({ contentType }) });
  },

  updateProfile(data: { avatarKey?: string }): Promise<{ data: { avatarUrl?: string } }> {
    return req('/profile', { method: 'PATCH', body: JSON.stringify(data) });
  },

  aiInsights(refresh = false): Promise<{ data: StoreInsightsResult; generatedAt: string; cached: boolean }> {
    return req(`/ai-insights${refresh ? '?refresh=true' : ''}`);
  },

  emailAiInsights(): Promise<{ data: { sent: boolean } }> {
    return req('/ai-insights/email', { method: 'POST' });
  },

  deleteAgent(id: string): Promise<{ data: { deleted: boolean } }> {
    return req(`/agents/${id}`, { method: 'DELETE' });
  },

  resendAgentInvite(id: string): Promise<{ data: { sent: boolean } }> {
    return req(`/agents/${id}/resend-invite`, { method: 'POST' });
  },

  getAgentActivity(id: string): Promise<{ data: AgentActivity }> {
    return req(`/agents/${id}/activity`);
  },

  tags(): Promise<{ data: string[] }> {
    return req('/tags');
  },

  products(): Promise<{ data: AdminProduct[] }> {
    return req('/products');
  },

  settings: {
    get(): Promise<{ data: AppSettings }> {
      return req('/settings');
    },
    update(patch: Partial<AppSettings>): Promise<{ data: AppSettings }> {
      return req('/settings', { method: 'PATCH', body: JSON.stringify(patch) });
    },
  },

  notifications: {
    list(): Promise<{ data: { notifications: AppNotification[]; unreadCount: number } }> {
      return req('/notifications');
    },
    markRead(id: string): Promise<{ data: { ok: boolean } }> {
      return req(`/notifications/${id}/read`, { method: 'PATCH' });
    },
    markAllRead(): Promise<{ data: { ok: boolean } }> {
      return req('/notifications/read-all', { method: 'PATCH' });
    },
  },

  ai: {
    triage(input: {
      ticketId?: string;
      subject: string;
      message: string;
      productTitle?: string;
      productCategory?: string;
    }): Promise<{ data: AiTriageResult }> {
      return aiReq('/triage-ticket', input);
    },

    suggestReply(input: {
      subject: string;
      message: string;
      productTitle?: string;
      productCategory?: string;
      summary?: string;
    }): Promise<{ data: AiSuggestReplyResult }> {
      return aiReq('/suggest-reply', input);
    },

    customerProfile(input: {
      ticketId?: string;
      subject: string;
      message: string;
      productTitle?: string;
      conversationHistory?: string;
    }): Promise<{ data: CustomerProfileResult }> {
      return aiReq('/customer-profile', input);
    },

    remarket(input: {
      subject: string;
      message: string;
      productTitle?: string;
      customerArchetype?: string;
      refundIntent?: string;
      sentiment?: string;
      targetProductId?: string;
    }): Promise<{ data: RemarketingPitchResult }> {
      return aiReq('/remarket', input);
    },

    coach(input: {
      subject: string;
      message: string;
      productTitle?: string;
      archetype?: string;
      archetypeLabel?: string;
      archetypeReason?: string;
      refundIntent?: string;
      refundIntentReason?: string;
      churnRisk?: string;
      sentiment?: string;
      lifetimeValueSignal?: string;
      recommendedApproach?: string;
      aiSummary?: string | null;
      aiPriority?: string | null;
      aiSuggestedNextStep?: string | null;
      aiTags?: string[];
      intentionId: string;
      intentionLabel: string;
      intentionDescription: string;
      history: CoachMessage[];
    }): Promise<{ data: { reply: string } }> {
      return aiReq('/coach', input);
    },
  },
};
