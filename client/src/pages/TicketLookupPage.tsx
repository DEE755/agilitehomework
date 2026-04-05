import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

interface LookupReply {
  body: string;
  authorName: string;
  isAgent?: boolean;
  createdAt: string;
}

interface LookupTicket {
  _id: string;
  title: string;
  description: string;
  status: string;
  authorName: string;
  authorEmail: string;
  createdAt: string;
  updatedAt: string;
  product?: { name: string; category: string } | null;
  replies: LookupReply[];
}

const STATUS_LABEL: Record<string, string> = {
  new: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

const STATUS_CLS: Record<string, string> = {
  new:         'border-olive-500/30 bg-olive-500/10 text-olive-400',
  in_progress: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  resolved:    'border-zinc-700 bg-zinc-800 text-zinc-400',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const inputCls =
  'w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-olive-500/60 focus:ring-1 focus:ring-olive-500/30';

export default function TicketLookupPage() {
  const [searchParams] = useSearchParams();

  const [ticketId, setTicketId] = useState(searchParams.get('id') ?? '');
  const [email,    setEmail]    = useState(searchParams.get('email') ?? '');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [ticket,   setTicket]   = useState<LookupTicket | null>(null);

  // Auto-submit when both params are pre-filled from URL (e.g. from email link)
  useEffect(() => {
    const id = searchParams.get('id');
    const em = searchParams.get('email');
    if (id && em) void doLookup(id, em);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doLookup(id: string, em: string) {
    setLoading(true);
    setError(null);
    setTicket(null);
    try {
      const qs = new URLSearchParams({ ticketId: id.trim(), email: em.trim() });
      const res = await fetch(`${BASE}/tickets/lookup?${qs.toString()}`);
      const json = await res.json() as { data?: LookupTicket; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Lookup failed');
      setTicket(json.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void doLookup(ticketId, email);
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Lookup form */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-olive-500">
          Support Portal
        </p>
        <h1 className="text-2xl font-bold text-zinc-100">Track Your Request</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Enter your ticket reference and email address to view your conversation.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Ticket Reference
            </label>
            <input
              type="text"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              placeholder="e.g. 6823a4f1c3b2e10012345678"
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="The email you used when submitting"
              required
              className={inputCls}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg border border-olive-500/40 bg-olive-500/15 py-3 text-xs font-semibold uppercase tracking-wider text-olive-400 transition hover:bg-olive-500/25 disabled:opacity-50"
          >
            {loading ? 'Looking up…' : 'View My Ticket'}
          </button>
        </form>
      </div>

      {/* Ticket thread */}
      {ticket && (
        <div className="mt-6 space-y-4">
          {/* Header card */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] text-zinc-600">#{ticket._id}</p>
                <h2 className="mt-1 text-lg font-bold text-zinc-100 leading-snug">{ticket.title}</h2>
                {ticket.product && (
                  <span className="mt-1.5 inline-flex items-center rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-0.5 text-[10px] text-zinc-400">
                    {ticket.product.name}
                  </span>
                )}
              </div>
              <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${STATUS_CLS[ticket.status] ?? STATUS_CLS.new}`}>
                {STATUS_LABEL[ticket.status] ?? ticket.status}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-zinc-600">
              <span>Submitted by <span className="text-zinc-400">{ticket.authorName}</span></span>
              <span>{formatDate(ticket.createdAt)}</span>
            </div>
          </div>

          {/* Conversation thread */}
          <div className="space-y-3">
            {/* Original message */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-[10px] font-bold text-zinc-300">
                    {ticket.authorName[0]?.toUpperCase()}
                  </span>
                  <span className="text-xs font-semibold text-zinc-300">{ticket.authorName}</span>
                  <span className="rounded-full border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[9px] text-zinc-600">
                    You
                  </span>
                </div>
                <span className="text-[10px] text-zinc-700">{formatDate(ticket.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">{ticket.description}</p>
            </div>

            {/* Replies */}
            {ticket.replies.map((reply, i) => (
              <div
                key={i}
                className={`rounded-xl border p-5 ${
                  reply.isAgent
                    ? 'border-olive-500/20 bg-olive-500/5'
                    : 'border-zinc-800 bg-zinc-900/60'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold ${
                      reply.isAgent
                        ? 'border-olive-500/40 bg-olive-500/10 text-olive-400'
                        : 'border-zinc-700 bg-zinc-800 text-zinc-300'
                    }`}>
                      {reply.isAgent ? '★' : reply.authorName[0]?.toUpperCase()}
                    </span>
                    <span className="text-xs font-semibold text-zinc-300">{reply.authorName}</span>
                    {reply.isAgent && (
                      <span className="rounded-full border border-olive-500/25 bg-olive-500/10 px-1.5 py-0.5 text-[9px] text-olive-500">
                        Support Team
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-700">{formatDate(reply.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">{reply.body}</p>
              </div>
            ))}

            {ticket.replies.length === 0 && (
              <div className="rounded-xl border border-dashed border-zinc-800 px-5 py-8 text-center">
                <p className="text-sm text-zinc-600">No replies yet — the support team will be in touch soon.</p>
              </div>
            )}
          </div>

          {/* Footer CTA */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/support/new"
              className="flex-1 rounded-lg border border-olive-500/40 bg-olive-500/15 px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-olive-400 transition hover:bg-olive-500/25"
            >
              Open a New Request
            </Link>
            <button
              onClick={() => setTicket(null)}
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 transition hover:text-zinc-200"
            >
              Look Up a Different Ticket
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
