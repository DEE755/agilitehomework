import type {
  Attachment,
  Ticket,
  PaginatedTickets,
  CreateTicketPayload,
  CreateReplyPayload,
  Reply,
  TicketPriority,
  TicketStatus,
} from '../types/ticket';
import type { Product } from '../types/product';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string; errors?: string[] };
    const message =
      body.errors?.join(', ') ?? body.error ?? `Request failed (${res.status})`;
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export type TicketFilters = {
  status?: TicketStatus;
  priority?: TicketPriority;
  page?: number;
  limit?: number;
};

export const api = {
  products: {
    list(): Promise<{ data: Product[] }> {
      return request('/products');
    },
  },

  uploads: {
    presignTicketImage(input: {
      fileName: string;
      contentType: string;
      size: number;
    }): Promise<{
      data: {
        uploadUrl: string;
        expiresIn: number;
        attachment: Attachment;
      };
    }> {
      return request('/uploads/ticket-images/presign', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
  },

  tickets: {
    list(filters: TicketFilters = {}): Promise<PaginatedTickets> {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.priority) params.set('priority', filters.priority);
      if (filters.page) params.set('page', String(filters.page));
      if (filters.limit) params.set('limit', String(filters.limit));
      const qs = params.toString();
      return request(`/tickets${qs ? `?${qs}` : ''}`);
    },

    get(id: string): Promise<{ data: Ticket }> {
      return request(`/tickets/${id}`);
    },

    create(payload: CreateTicketPayload): Promise<{ data: Ticket }> {
      return request('/tickets', { method: 'POST', body: JSON.stringify(payload) });
    },

    addReply(id: string, payload: CreateReplyPayload): Promise<{ data: Reply }> {
      return request(`/tickets/${id}/replies`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    close(id: string): Promise<{ data: Ticket }> {
      return request(`/tickets/${id}/close`, { method: 'PATCH' });
    },
  },

  ai: {
    ask(question: string, product?: { name: string; category?: string }): Promise<{ data: { answer: string; shouldEscalate: boolean; suggestedTitle: string; suggestedDescription: string } }> {
      return request('/ai/ask', { method: 'POST', body: JSON.stringify({ question, productName: product?.name, productCategory: product?.category }) });
    },
  },
};
