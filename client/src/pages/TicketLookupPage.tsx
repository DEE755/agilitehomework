import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';

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
  product?: { name: string; category: string; price?: number | null; imageUrl?: string | null } | null;
  replies: LookupReply[];
}

const LOOKUP_PALETTES = [
  { bg: 'bg-sky-500/20',     text: 'text-sky-300',     border: 'border-sky-500/30'     },
  { bg: 'bg-violet-500/20',  text: 'text-violet-300',  border: 'border-violet-500/30'  },
  { bg: 'bg-amber-500/20',   text: 'text-amber-300',   border: 'border-amber-500/30'   },
  { bg: 'bg-rose-500/20',    text: 'text-rose-300',    border: 'border-rose-500/30'    },
  { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  { bg: 'bg-cyan-500/20',    text: 'text-cyan-300',    border: 'border-cyan-500/30'    },
  { bg: 'bg-orange-500/20',  text: 'text-orange-300',  border: 'border-orange-500/30'  },
  { bg: 'bg-pink-500/20',    text: 'text-pink-300',    border: 'border-pink-500/30'    },
];
function lookupPalette(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return LOOKUP_PALETTES[h % LOOKUP_PALETTES.length];
}

// STATUS_LABEL is built from translations inside the component

const STATUS_CLS: Record<string, string> = {
  new:         'th-btn border',
  in_progress: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  resolved:    'border-zinc-700 bg-zinc-800 text-zinc-400',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const inputCls =
  'w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:ring-1 focus:ring-[var(--th-border)] focus:border-[var(--th-border)]';

export default function TicketLookupPage() {
  const { t } = useLanguage();
  const tl = t.lookup;

  const STATUS_LABEL: Record<string, string> = {
    new: tl.statusOpen,
    in_progress: tl.statusInProgress,
    resolved: tl.statusResolved,
  };

  const [searchParams] = useSearchParams();

  const prefillId    = searchParams.get('id') ?? '';
  const prefillEmail = searchParams.get('email') ?? '';
  const hasPrefill   = !!(prefillId && prefillEmail);

  const [ticketId,    setTicketId]    = useState(prefillId);
  const [email,       setEmail]       = useState(prefillEmail);
  const [expanded,    setExpanded]    = useState(!hasPrefill);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [ticket,      setTicket]      = useState<LookupTicket | null>(null);
  const [replyBody,   setReplyBody]   = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replyError,  setReplyError]  = useState<string | null>(null);

  // Auto-load ticket immediately when params are pre-filled
  useEffect(() => {
    if (hasPrefill) void doLookup(prefillId, prefillEmail);
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
      if (json.data) setExpanded(false);
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

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket || !replyBody.trim()) return;
    setReplySending(true);
    setReplyError(null);
    try {
      const res = await fetch(`${BASE}/tickets/${ticket._id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyBody.trim(), authorName: ticket.authorName, authorEmail: ticket.authorEmail }),
      });
      const json = await res.json() as { data?: LookupReply; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to send');
      if (json.data) setTicket((t) => t ? { ...t, replies: [...t.replies, json.data!] } : t);
      setReplyBody('');
    } catch (e) {
      setReplyError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setReplySending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Lookup form — collapsible card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        {/* Always-visible header — click to toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-5 text-left transition hover:bg-zinc-800/40 sm:px-8"
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-olive-500">
              {tl.portal}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-zinc-100">{tl.heading}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {tl.subtitle}
            </p>
          </div>
          <svg
            viewBox="0 0 12 12"
            fill="none"
            className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Expandable body */}
        {expanded && (
          <div className="border-t border-zinc-800 px-5 pb-6 pt-5 sm:px-8 sm:pb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {tl.ticketReference}
                </label>
                <input
                  type="text"
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value)}
                  placeholder={tl.ticketRefPlaceholder}
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {tl.emailAddress}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={tl.emailPlaceholder}
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
                className="th-btn w-full rounded-lg border py-3 text-xs font-semibold uppercase tracking-wider transition disabled:opacity-50"
              >
                {loading ? tl.lookingUp : tl.viewMyTicket}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Ticket thread */}
      {ticket && (
        <div className="mt-6 space-y-4">
          {/* Header card */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            {ticket.product && (() => {
              const p = lookupPalette(ticket.product.name);
              return (
                <div className="mb-4 flex items-center gap-3">
                  {ticket.product.imageUrl ? (
                    <img
                      src={ticket.product.imageUrl}
                      alt={ticket.product.name}
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border text-xl font-bold ${p.bg} ${p.text} ${p.border}`}>
                      {ticket.product.name[0]?.toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <span className={`inline-flex items-center gap-2 rounded-lg border bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold ${p.border} ${p.text}`}>
                      {ticket.product.imageUrl ? (
                        <img src={ticket.product.imageUrl} alt={ticket.product.name} className="h-5 w-5 shrink-0 rounded object-cover" />
                      ) : (
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold ${p.bg} ${p.text}`}>
                          {ticket.product.name[0]?.toUpperCase()}
                        </span>
                      )}
                      {ticket.product.name}
                      {ticket.product.price != null && (
                        <span className="font-normal text-zinc-500">${ticket.product.price}</span>
                      )}
                    </span>
                    <p className="mt-0.5 text-[10px] text-zinc-600 capitalize">{ticket.product.category}</p>
                  </div>
                </div>
              );
            })()}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] text-zinc-600">#{ticket._id}</p>
                <h2 className="mt-1 text-lg font-bold text-zinc-100 leading-snug">{ticket.title}</h2>
              </div>
              <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${STATUS_CLS[ticket.status] ?? STATUS_CLS.new}`}>
                {STATUS_LABEL[ticket.status] ?? ticket.status}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-zinc-600">
              <span>{tl.submittedBy} <span className="text-zinc-400">{ticket.authorName}</span></span>
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
                    {tl.you}
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
                    ? 'border-[var(--th-border)] bg-[var(--th-accent-dim)]'
                    : 'border-zinc-800 bg-zinc-900/60'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold ${
                        reply.isAgent ? '' : 'border-zinc-700 bg-zinc-800 text-zinc-300'
                      }`}
                      style={reply.isAgent ? { borderColor: 'var(--th-border)', backgroundColor: 'var(--th-accent-dim)', color: 'var(--th-accent-text)' } : undefined}
                    >
                      {reply.isAgent ? '★' : reply.authorName[0]?.toUpperCase()}
                    </span>
                    <span className="text-xs font-semibold text-zinc-300">{reply.authorName}</span>
                    {reply.isAgent && (
                      <span className="th-btn rounded-full border px-1.5 py-0.5 text-[9px]">
                        {tl.supportTeam}
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
                <p className="text-sm text-zinc-600">{tl.noReplies}</p>
              </div>
            )}
          </div>

          {/* Reply form */}
          {ticket.status !== 'resolved' && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                {tl.sendMessage}
              </p>
              <form onSubmit={(e) => void handleReply(e)} className="space-y-3">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={4}
                  placeholder={tl.replyPlaceholder}
                  required
                  disabled={replySending}
                  className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-olive-500/20 resize-none disabled:opacity-50"
                />
                {replyError && (
                  <p className="rounded border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{replyError}</p>
                )}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={replySending || !replyBody.trim()}
                    className="th-btn rounded-lg border px-6 py-2.5 text-xs font-semibold uppercase tracking-wider transition disabled:opacity-40"
                  >
                    {replySending ? tl.sending : tl.sendMessageBtn}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Footer CTA */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/support/new"
              className="th-btn flex-1 rounded-lg border px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider transition"
            >
              {tl.openNewRequest}
            </Link>
            <button
              onClick={() => { setTicket(null); setExpanded(true); setTicketId(''); }}
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 transition hover:text-zinc-200"
            >
              {tl.lookUpDifferent}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
