import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, getStoredAgent } from '../../services/adminApi';
import type {
  AgentConversation,
  AgentMessage,
  AgentMessageTicketRef,
  AgentMessageProductRef,
  Agent,
  AdminProduct,
  AdminTicket,
  AdminTicketSummary,
} from '../../types/admin';
import { timeAgo } from '../../utils/formatting';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ONLINE_MS = 10 * 60 * 1000;
function isOnline(lastActiveAt?: string | null, isAiAgent?: boolean) {
  if (isAiAgent) return true; // AI agent is always online
  if (!lastActiveAt) return false;
  return Date.now() - new Date(lastActiveAt).getTime() < ONLINE_MS;
}

function OnlineDot({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
    </span>
  );
}

function avatarInitials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function Avatar({ name, url, size = 'md' }: { name: string; url?: string | null; size?: 'sm' | 'md' }) {
  const cls = size === 'sm'
    ? 'h-6 w-6 text-[9px]'
    : 'h-8 w-8 text-[11px]';
  if (url) return <img src={url} alt={name} className={`${cls} rounded-full object-cover shrink-0`} />;
  return (
    <span className={`${cls} flex items-center justify-center rounded-full bg-zinc-700 font-bold text-zinc-300 shrink-0`}>
      {avatarInitials(name)}
    </span>
  );
}

const STATUS_COLORS: Record<string, string> = {
  new:         'bg-olive-500/15 text-olive-400 border-olive-500/25',
  in_progress: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
  resolved:    'bg-violet-500/15 text-violet-400 border-violet-500/25',
};

// ── Ref Picker ────────────────────────────────────────────────────────────────

type TicketViewMode = 'assigned' | 'status';

function TicketGroup({ label, tickets, onAdd, onClose, showAssignee }: {
  label: string;
  tickets: AdminTicketSummary[];
  onAdd: (ref: AgentMessageTicketRef) => void;
  onClose: () => void;
  showAssignee?: boolean;
}) {
  if (tickets.length === 0) return null;
  return (
    <>
      <li className="sticky top-0 bg-zinc-900 px-3 py-1 text-[9px] font-semibold uppercase tracking-widest text-zinc-600 border-b border-zinc-800/60">
        {label}
      </li>
      {tickets.map((t) => (
        <li key={t._id}>
          <button
            onMouseDown={() => { onAdd({ ticketId: t._id, title: t.title, status: t.status }); onClose(); }}
            className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-zinc-800 transition"
          >
            <span className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase whitespace-nowrap ${STATUS_COLORS[t.status] ?? 'bg-zinc-700 text-zinc-400'}`}>
              {t.status.replace('_', ' ')}
            </span>
            <span className="flex-1 text-xs text-zinc-300 line-clamp-1">{t.title}</span>
            {showAssignee && t.assignedTo && (
              <span className="shrink-0 text-[10px] text-zinc-600 whitespace-nowrap">{t.assignedTo.name}</span>
            )}
          </button>
        </li>
      ))}
    </>
  );
}

function TicketPicker({
  selected,
  onAdd,
  onClose,
  myId,
  partnerId,
  partnerName,
}: {
  selected:    string[];
  onAdd:       (ref: AgentMessageTicketRef) => void;
  onClose:     () => void;
  myId:        string;
  partnerId:   string;
  partnerName: string;
}) {
  const [tickets, setTickets]   = useState<AdminTicketSummary[]>([]);
  const [query, setQuery]       = useState('');
  const [view, setView]         = useState<TicketViewMode>('assigned');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    adminApi.tickets.list({ limit: 100 }).then((r) => setTickets(r.data)).catch(() => null);
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  const q = query.toLowerCase();
  const available = tickets.filter(
    (t) => !selected.includes(t._id) && (!q || t.title.toLowerCase().includes(q)),
  );

  // ── Assigned view ──────────────────────────────────────────────────────────
  const mine    = available.filter((t) => t.assignedTo?._id === myId);
  const partner = available.filter((t) => t.assignedTo?._id === partnerId);
  const others  = available.filter((t) => t.assignedTo?._id !== myId && t.assignedTo?._id !== partnerId);

  // ── Status view ────────────────────────────────────────────────────────────
  const byStatus: Record<string, AdminTicketSummary[]> = {};
  for (const t of available) {
    (byStatus[t.status] ??= []).push(t);
  }
  const statusOrder = ['new', 'in_progress', 'resolved'];
  const statusLabel: Record<string, string> = { new: 'New', in_progress: 'In Progress', resolved: 'Resolved' };

  const isEmpty = available.length === 0;

  return (
    <div ref={ref} className="absolute bottom-full mb-2 left-0 right-0 z-10 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
      {/* Search + toggle */}
      <div className="p-2 border-b border-zinc-800 flex items-center gap-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tickets…"
          className="flex-1 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none"
        />
        <div className="flex rounded-lg border border-zinc-700 overflow-hidden shrink-0">
          <button
            onMouseDown={(e) => { e.preventDefault(); setView('assigned'); }}
            className={`px-2 py-1 text-[10px] font-semibold transition ${view === 'assigned' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            title="Group by assignee"
          >
            <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
              <circle cx="6" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M2 10c0-2.21 1.79-4 4-4s4 1.79 4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); setView('status'); }}
            className={`px-2 py-1 text-[10px] font-semibold transition border-l border-zinc-700 ${view === 'status' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            title="Group by status"
          >
            <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3">
              <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M3.5 5h5M3.5 7h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <ul className="max-h-56 overflow-y-auto">
        {isEmpty && (
          <li className="px-3 py-4 text-center text-xs text-zinc-600">No tickets found</li>
        )}

        {!isEmpty && view === 'assigned' && (
          <>
            <TicketGroup label="My Tickets"              tickets={mine}    onAdd={onAdd} onClose={onClose} />
            <TicketGroup label={`${partnerName}'s Tickets`} tickets={partner} onAdd={onAdd} onClose={onClose} />
            <TicketGroup label="Others"                  tickets={others}  onAdd={onAdd} onClose={onClose} showAssignee />
          </>
        )}

        {!isEmpty && view === 'status' && statusOrder.map((s) =>
          byStatus[s]?.length ? (
            <TicketGroup
              key={s}
              label={statusLabel[s] ?? s}
              tickets={byStatus[s]}
              onAdd={onAdd}
              onClose={onClose}
              showAssignee
            />
          ) : null,
        )}
      </ul>
    </div>
  );
}

function ProductPicker({
  selected,
  onAdd,
  onClose,
}: {
  selected: string[];
  onAdd: (ref: AgentMessageProductRef) => void;
  onClose: () => void;
}) {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    adminApi.products().then((r) => setProducts(r.data)).catch(() => null);
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose]);

  const filtered = products.filter(
    (p) => !selected.includes(p._id) && p.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div ref={ref} className="absolute bottom-full mb-2 left-0 right-0 z-10 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
      <div className="p-2 border-b border-zinc-800">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className="w-full rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none"
        />
      </div>
      <ul className="max-h-52 overflow-y-auto">
        {filtered.length === 0 && (
          <li className="px-3 py-4 text-center text-xs text-zinc-600">No products found</li>
        )}
        {filtered.map((p) => (
          <li key={p._id}>
            <button
              onMouseDown={() => {
                onAdd({ productId: p._id, name: p.name, imageUrl: null });
                onClose();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800 transition"
            >
              <span className="text-xs text-zinc-300 line-clamp-1">{p.name}</span>
              <span className="ml-auto shrink-0 text-[10px] text-zinc-600">{p.category}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

// ── Preview cards ─────────────────────────────────────────────────────────────

const PRIORITY_CLS: Record<string, string> = {
  high:       'text-red-400 border-red-500/30 bg-red-500/10',
  medium:     'text-amber-400 border-amber-500/30 bg-amber-500/10',
  low:        'text-zinc-400 border-zinc-600 bg-zinc-800',
  irrelevant: 'text-zinc-500 border-zinc-700 bg-zinc-900',
};

function TicketPreview({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const [ticket, setTicket] = useState<AdminTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    adminApi.tickets.get(ticketId).then((r) => setTicket(r.data)).catch(() => null).finally(() => setLoading(false));
  }, [ticketId]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onClick={(e) => { if (cardRef.current && !cardRef.current.contains(e.target as Node)) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div ref={cardRef} className="relative z-10 w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
          {loading
            ? <div className="h-4 w-48 rounded bg-zinc-800 animate-pulse" />
            : <h3 className="font-semibold text-zinc-100 leading-snug">{ticket?.title}</h3>
          }
          <button onClick={onClose} className="shrink-0 text-zinc-500 hover:text-zinc-300 transition">✕</button>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[80, 55, 90, 40].map((w, i) => (
              <div key={i} className="h-3 rounded bg-zinc-800 animate-pulse" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : ticket ? (
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase whitespace-nowrap ${STATUS_COLORS[ticket.status] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                {ticket.status.replace('_', ' ')}
              </span>
              {ticket.aiPriority && (
                <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase whitespace-nowrap ${PRIORITY_CLS[ticket.aiPriority] ?? ''}`}>
                  {ticket.aiPriority} priority
                </span>
              )}
              {ticket.assignedTo && <span className="text-[11px] text-zinc-500">→ {ticket.assignedTo.name}</span>}
            </div>

            {ticket.product && (
              <div className="flex items-center gap-2.5 rounded-lg border border-zinc-800 bg-zinc-800/40 p-2.5">
                {ticket.product.imageUrl ? (
                  <img src={ticket.product.imageUrl} alt={ticket.product.name} className="h-9 w-9 shrink-0 rounded-md object-cover" />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-700 text-xs font-bold text-zinc-400">
                    {ticket.product.name[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-zinc-200">{ticket.product.name}</p>
                  {ticket.product.price != null && <p className="text-[10px] text-olive-400">${ticket.product.price}</p>}
                </div>
              </div>
            )}

            <div>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-zinc-600">Customer message</p>
              <p className="text-sm leading-relaxed text-zinc-400 line-clamp-4">{ticket.description}</p>
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-600">
              <span>{ticket.authorName} · {ticket.authorEmail}</span>
              <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
            </div>

            <Link
              to={`/admin/tickets/${ticket._id}`}
              onClick={onClose}
              className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
            >
              Open full ticket
              <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5"><path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
          </div>
        ) : (
          <p className="p-5 text-sm text-zinc-500">Ticket not found.</p>
        )}
      </div>
    </div>
  );
}

function ProductPreview({ productRef, onClose }: { productRef: AgentMessageProductRef; onClose: () => void }) {
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    adminApi.products().then((r) => {
      setProduct(r.data.find((p) => p._id === productRef.productId) ?? null);
    }).catch(() => null);
  }, [productRef.productId]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const name = product?.name ?? productRef.name;
  const imageUrl = product?.imageUrl ?? productRef.imageUrl;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onClick={(e) => { if (cardRef.current && !cardRef.current.contains(e.target as Node)) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div ref={cardRef} className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden">
        <div className="relative h-40 w-full bg-zinc-800 shrink-0">
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="select-none text-5xl font-bold text-zinc-600">{name[0]?.toUpperCase()}</span>
            </div>
          )}
          {product?.category && (
            <span className="absolute bottom-2.5 left-2.5 rounded-full border border-zinc-600/50 bg-zinc-900/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300 backdrop-blur-sm">
              {product.category}
            </span>
          )}
          <button onClick={onClose} className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-zinc-400 backdrop-blur-sm transition hover:text-zinc-100">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-zinc-100">{name}</h3>
            {product?.price != null && (
              <span className="shrink-0 rounded-full border border-olive-500/30 bg-olive-500/10 px-3 py-1 text-sm font-bold text-olive-400">
                ${product.price}
              </span>
            )}
          </div>
          {product?.description && (
            <p className="text-sm leading-relaxed text-zinc-400 line-clamp-3">{product.description}</p>
          )}
          {productRef.productId && (
            <Link
              to={`/products?product=${productRef.productId}`}
              onClick={onClose}
              className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
            >
              View in store
              <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5"><path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function MessageBubble({ msg, isMine }: { msg: AgentMessage; isMine: boolean }) {
  const [previewTicketId, setPreviewTicketId]   = useState<string | null>(null);
  const [previewProduct,  setPreviewProduct]    = useState<AgentMessageProductRef | null>(null);

  return (
    <>
      <div className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex flex-col gap-1 max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
          {/* Body */}
          <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isMine
              ? 'bg-olive-500/20 text-olive-100 rounded-tr-sm'
              : 'bg-zinc-800 text-zinc-100 rounded-tl-sm'
          }`}>
            {msg.body}
          </div>

          {/* Ticket refs */}
          {msg.ticketRefs.length > 0 && (
            <div className="flex flex-col gap-1 w-full">
              {msg.ticketRefs.map((r) => (
                <button
                  key={r.ticketId}
                  onClick={() => setPreviewTicketId(r.ticketId)}
                  className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-left transition hover:border-zinc-600 hover:bg-zinc-800"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 shrink-0 text-zinc-500">
                    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  <span className="text-[11px] text-zinc-300 line-clamp-1 flex-1">{r.title}</span>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase whitespace-nowrap ${STATUS_COLORS[r.status] ?? 'bg-zinc-700 text-zinc-400 border-zinc-600'}`}>
                    {r.status.replace('_', ' ')}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Product refs */}
          {msg.productRefs.length > 0 && (
            <div className="flex flex-col gap-1 w-full">
              {msg.productRefs.map((r) => (
                <button
                  key={r.productId}
                  onClick={() => setPreviewProduct(r)}
                  className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5 text-left transition hover:border-amber-500/40 hover:bg-amber-500/10"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 shrink-0 text-amber-500/60">
                    <path d="M13 5H3L2 13h12L13 5z" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M5 5V4a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  <span className="text-[11px] text-amber-400 line-clamp-1 flex-1">{r.name}</span>
                  <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5 shrink-0 text-amber-500/40">
                    <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              ))}
            </div>
          )}

          <span className="text-[10px] text-zinc-600 px-1">{timeAgo(msg.createdAt)}</span>
        </div>
      </div>

      {previewTicketId && <TicketPreview ticketId={previewTicketId} onClose={() => setPreviewTicketId(null)} />}
      {previewProduct  && <ProductPreview productRef={previewProduct}  onClose={() => setPreviewProduct(null)} />}
    </>
  );
}

// ── Compose ───────────────────────────────────────────────────────────────────

function Compose({
  onSend,
  disabled,
  myId,
  partnerId,
  partnerName,
}: {
  onSend: (body: string, ticketRefs: AgentMessageTicketRef[], productRefs: AgentMessageProductRef[]) => Promise<void>;
  disabled?: boolean;
  myId:        string;
  partnerId:   string;
  partnerName: string;
}) {
  const [body, setBody] = useState('');
  const [ticketRefs, setTicketRefs]   = useState<AgentMessageTicketRef[]>([]);
  const [productRefs, setProductRefs] = useState<AgentMessageProductRef[]>([]);
  const [picker, setPicker] = useState<'ticket' | 'product' | null>(null);
  const [sending, setSending] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  async function handleSend() {
    if (!body.trim() || sending) return;
    const bodyToSend = body.trim();
    const ticketsToSend = ticketRefs;
    const productsToSend = productRefs;
    setBody('');
    setTicketRefs([]);
    setProductRefs([]);
    setSending(true);
    try {
      await onSend(bodyToSend, ticketsToSend, productsToSend);
    } finally {
      setSending(false);
      textRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
  }

  return (
    <div className="border-t border-zinc-800 p-3 flex flex-col gap-2">
      {/* Selected refs */}
      {(ticketRefs.length > 0 || productRefs.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {ticketRefs.map((r) => (
            <span key={r.ticketId} className="flex items-center gap-1 rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-400">
              <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5">
                <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M3.5 5h5M3.5 7h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span className="max-w-[120px] truncate">{r.title}</span>
              <button onClick={() => setTicketRefs((p) => p.filter((x) => x.ticketId !== r.ticketId))} className="ml-0.5 opacity-60 hover:opacity-100">×</button>
            </span>
          ))}
          {productRefs.map((r) => (
            <span key={r.productId} className="flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-400">
              <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5">
                <path d="M10 4H2L1 10h10L10 4z" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M4 4V3a2 2 0 014 0v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span className="max-w-[120px] truncate">{r.name}</span>
              <button onClick={() => setProductRefs((p) => p.filter((x) => x.productId !== r.productId))} className="ml-0.5 opacity-60 hover:opacity-100">×</button>
            </span>
          ))}
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled || sending}
        placeholder="Write a message… (⌘Enter to send)"
        rows={2}
        className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-600 transition"
      />

      {/* Actions row */}
      <div className="relative flex items-center gap-1.5">
        <button
          onClick={() => setPicker((p) => (p === 'ticket' ? null : 'ticket'))}
          className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
            picker === 'ticket'
              ? 'border-sky-500/50 bg-sky-500/15 text-sky-400'
              : 'border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
          }`}
        >
          <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5">
            <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M3.5 5h5M3.5 7h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          + Ticket
        </button>
        <button
          onClick={() => setPicker((p) => (p === 'product' ? null : 'product'))}
          className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
            picker === 'product'
              ? 'border-amber-500/50 bg-amber-500/15 text-amber-400'
              : 'border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
          }`}
        >
          <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5">
            <path d="M10 4H2L1 10h10L10 4z" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M4 4V3a2 2 0 014 0v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          + Product
        </button>

        <button
          onClick={handleSend}
          disabled={!body.trim() || sending || disabled}
          className="ml-auto flex items-center gap-1.5 rounded-full bg-olive-500/20 border border-olive-500/30 px-3 py-1 text-xs font-semibold text-olive-400 transition hover:bg-olive-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? (
            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31" strokeDashoffset="10"/>
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3">
              <path d="M14 2L2 7l5 2 2 5 5-12z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            </svg>
          )}
          Send
        </button>

        {picker === 'ticket' && (
          <TicketPicker
            selected={ticketRefs.map((r) => r.ticketId)}
            onAdd={(r) => setTicketRefs((p) => [...p, r])}
            onClose={() => setPicker(null)}
            myId={myId}
            partnerId={partnerId}
            partnerName={partnerName}
          />
        )}
        {picker === 'product' && (
          <ProductPicker
            selected={productRefs.map((r) => r.productId)}
            onAdd={(r) => setProductRefs((p) => [...p, r])}
            onClose={() => setPicker(null)}
          />
        )}
      </div>
    </div>
  );
}

// ── Thread view ───────────────────────────────────────────────────────────────

function ThreadView({
  partner,
  myId,
  onSend,
  partnerOnline,
  isAiAgent,
}: {
  partner: { _id: string; name: string; avatarUrl?: string | null };
  myId: string;
  onSend: (body: string, ticketRefs: AgentMessageTicketRef[], productRefs: AgentMessageProductRef[]) => Promise<void>;
  partnerOnline?: boolean;
  isAiAgent?: boolean;
}) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiTyping, setAiTyping] = useState(false);
  const aiTypingRef = useRef(false);
  const aiTypingStartedRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function setAiTypingState(v: boolean) {
    aiTypingRef.current = v;
    setAiTyping(v);
  }

  const loadMessages = useCallback(async () => {
    try {
      const res = await adminApi.messages.conversation(partner._id);
      setMessages(res.data.messages);
      if (aiTypingRef.current) {
        const hasReply = res.data.messages.some(
          (m) => m.fromId === partner._id && new Date(m.createdAt).getTime() > aiTypingStartedRef.current,
        );
        if (hasReply) setAiTypingState(false);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [partner._id]);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setAiTypingState(false);
    loadMessages();
    intervalRef.current = setInterval(loadMessages, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, aiTyping]);

  async function handleSend(body: string, ticketRefs: AgentMessageTicketRef[], productRefs: AgentMessageProductRef[]) {
    // Optimistic update — show the message immediately without waiting for the server
    const optimistic: AgentMessage = {
      _id:         `optimistic-${Date.now()}`,
      fromId:      myId,
      toId:        partner._id,
      body,
      ticketRefs,
      productRefs: productRefs.map((r) => ({ ...r })),
      readAt:      null,
      createdAt:   new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    await onSend(body, ticketRefs, productRefs);
    await loadMessages(); // replaces optimistic message with server-confirmed one
    if (isAiAgent) {
      aiTypingStartedRef.current = Date.now();
      setAiTypingState(true);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="flex items-center gap-2.5 border-b border-zinc-800 px-4 py-3 shrink-0">
        <div className="relative">
          <Avatar name={partner.name} url={partner.avatarUrl} />
          {partnerOnline && (
            <span className="absolute -bottom-0.5 -right-0.5">
              <OnlineDot active />
            </span>
          )}
        </div>
        <div>
          <span className="font-semibold text-sm text-zinc-100">{partner.name}</span>
          {partnerOnline && (
            <p className="text-[10px] text-green-500 font-semibold">Connected</p>
          )}
        </div>
      </div>

      {/* AI agent warning banner */}
      {partner.name === 'Agilate AI' && (
        <div className="flex items-center gap-2 border-b border-violet-500/20 bg-violet-500/10 px-4 py-2 shrink-0">
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0 text-violet-400">
            <path d="M8 1l1.5 4.5H14l-3.5 2.5 1.5 4.5L8 10 4 12.5l1.5-4.5L2 5.5h4.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>
          <span className="text-[11px] text-violet-300">You are chatting with <strong>Agilate AI</strong> — responses are automated and generated by AI.</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <svg className="h-5 w-5 animate-spin text-zinc-600" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31" strokeDashoffset="10"/>
            </svg>
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-600">
              <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
                <path d="M17 10c0 3.866-3.134 7-7 7a6.973 6.973 0 01-3.5-.937L3 17l.937-3.5A6.973 6.973 0 013 10c0-3.866 3.134-7 7-7s7 3.134 7 7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-sm text-zinc-400">No messages yet</p>
            <p className="text-xs text-zinc-600">Say hello to {partner.name}!</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg._id} msg={msg} isMine={msg.fromId === myId} />
        ))}
        {aiTyping && (
          <div className="flex items-end gap-2">
            <Avatar name={partner.name} url={partner.avatarUrl} size="sm" />
            <div className="rounded-2xl rounded-bl-sm bg-zinc-800 px-3 py-2.5 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <Compose onSend={handleSend} myId={myId} partnerId={partner._id} partnerName={partner.name} />
    </div>
  );
}

// ── Conversation list ─────────────────────────────────────────────────────────

function ConversationList({
  conversations,
  activeId,
  onSelect,
  onlineIds,
}: {
  conversations: AgentConversation[];
  activeId: string | null;
  onSelect: (agentId: string, agentName: string, agentAvatar: string | null) => void;
  onlineIds: Set<string>;
}) {
  return (
    <ul className="flex flex-col divide-y divide-zinc-800/60">
      {conversations.map((c) => (
        <li key={c.agentId}>
          <button
            onClick={() => onSelect(c.agentId, c.agentName, c.agentAvatar)}
            className={`w-full flex items-center gap-2.5 px-3 py-3 text-left transition hover:bg-zinc-800/50 ${
              activeId === c.agentId ? 'bg-zinc-800/50' : ''
            }`}
          >
            <div className="relative shrink-0">
              <Avatar name={c.agentName} url={c.agentAvatar} />
              {onlineIds.has(c.agentId) && !c.unreadCount && (
                <span className="absolute -bottom-0.5 -right-0.5">
                  <OnlineDot active />
                </span>
              )}
              {c.unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-500 text-[8px] font-bold text-white">
                  {c.unreadCount > 9 ? '9+' : c.unreadCount}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className={`text-xs font-semibold truncate ${c.unreadCount > 0 ? 'text-zinc-100' : 'text-zinc-300'}`}>
                  {c.agentName}
                </span>
                <span className="shrink-0 text-[10px] text-zinc-600">{timeAgo(c.lastAt)}</span>
              </div>
              <p className="text-[11px] text-zinc-500 truncate">
                {c.isFromMe ? 'You: ' : ''}{c.lastBody}
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ── New conversation picker ───────────────────────────────────────────────────

function AgentPicker({
  agents,
  existingIds,
  onSelect,
  onClose,
}: {
  agents: Agent[];
  existingIds: string[];
  onSelect: (a: Agent) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = agents.filter(
    (a) => a.name.toLowerCase().includes(query.toLowerCase()) && !existingIds.includes(a._id),
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition">
          <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
            <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find an agent…"
          className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-600 outline-none"
        />
      </div>
      <ul className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-zinc-600">No agents found</li>
        )}
        {filtered.map((a) => (
          <li key={a._id}>
            <button
              onClick={() => onSelect(a)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/50 transition"
            >
              <Avatar name={a.name} url={a.avatarUrl} />
              <div>
                <p className="text-sm font-medium text-zinc-200">{a.name}</p>
                <p className="text-[11px] text-zinc-500">{a.email}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Main MessagesPanel ────────────────────────────────────────────────────────

interface MessagesPanelProps {
  open: boolean;
  onClose: () => void;
  onUnreadChange?: (count: number) => void;
  initialPartner?: { _id: string; name: string; avatarUrl?: string | null };
}

export default function MessagesPanel({ open, onClose, onUnreadChange, initialPartner }: MessagesPanelProps) {
  const me = getStoredAgent();
  const myId = me?._id ?? '';

  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activePartner, setActivePartner] = useState<{ _id: string; name: string; avatarUrl: string | null } | null>(
    initialPartner ? { _id: initialPartner._id, name: initialPartner.name, avatarUrl: initialPartner.avatarUrl ?? null } : null,
  );
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const convIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await adminApi.messages.conversations();
      setConversations(res.data);
      const total = res.data.reduce((s, c) => s + c.unreadCount, 0);
      onUnreadChange?.(total);
    } catch {
      /* ignore */
    }
  }, [onUnreadChange]);

  useEffect(() => {
    if (initialPartner) {
      setActivePartner({ _id: initialPartner._id, name: initialPartner.name, avatarUrl: initialPartner.avatarUrl ?? null });
    }
  }, [initialPartner?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      loadConversations(),
      adminApi.agents().then((r) => setAgents(r.data.filter((a) => a._id !== myId))).catch(() => null),
    ]).finally(() => setLoading(false));

    convIntervalRef.current = setInterval(loadConversations, 10000);
    return () => {
      if (convIntervalRef.current) clearInterval(convIntervalRef.current);
    };
  }, [open, loadConversations, myId]);

  function selectConversation(agentId: string, agentName: string, agentAvatar: string | null) {
    setActivePartner({ _id: agentId, name: agentName, avatarUrl: agentAvatar });
    setShowPicker(false);
    // Optimistically clear unread for this conv
    setConversations((prev) =>
      prev.map((c) => (c.agentId === agentId ? { ...c, unreadCount: 0 } : c)),
    );
  }

  async function handleSend(body: string, ticketRefs: AgentMessageTicketRef[], productRefs: AgentMessageProductRef[]) {
    if (!activePartner) return;
    await adminApi.messages.send({ toId: activePartner._id, body, ticketRefs, productRefs });
    void loadConversations(); // non-blocking — sidebar updates in background
  }

  function startNew(agent: Agent) {
    setShowPicker(false);
    const exists = conversations.find((c) => c.agentId === agent._id);
    if (exists) {
      selectConversation(agent._id, agent.name, agent.avatarUrl ?? null);
    } else {
      setActivePartner({ _id: agent._id, name: agent.name, avatarUrl: agent.avatarUrl ?? null });
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-2xl flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl">
        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-zinc-400">
              <path d="M17 10c0 3.866-3.134 7-7 7a6.973 6.973 0 01-3.5-.937L3 17l.937-3.5A6.973 6.973 0 013 10c0-3.866 3.134-7 7-7s7 3.134 7 7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
            <h2 className="text-sm font-semibold text-zinc-100">Messages</h2>
            {conversations.reduce((s, c) => s + c.unreadCount, 0) > 0 && (
              <span className="rounded-full bg-sky-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {conversations.reduce((s, c) => s + c.unreadCount, 0)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
            >
              <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5">
                <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              New
            </button>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition p-1">
              <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body: two-column layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: conversations list */}
          <div className="w-52 shrink-0 border-r border-zinc-800 overflow-y-auto">
            {loading && conversations.length === 0 ? (
              <div className="flex items-center justify-center p-8">
                <svg className="h-5 w-5 animate-spin text-zinc-600" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31" strokeDashoffset="10"/>
                </svg>
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-xs text-zinc-500">No conversations yet</p>
                <button
                  onClick={() => setShowPicker(true)}
                  className="text-xs text-olive-400 hover:text-olive-300 transition"
                >
                  Start one →
                </button>
              </div>
            ) : (
              <ConversationList
                conversations={conversations}
                activeId={activePartner?._id ?? null}
                onSelect={selectConversation}
                onlineIds={new Set(agents.filter((a) => isOnline(a.lastActiveAt, a.isAiAgent)).map((a) => a._id))}
              />
            )}
          </div>

          {/* Right: thread or picker or empty state */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {showPicker ? (
              <AgentPicker
                agents={agents}
                existingIds={conversations.map((c) => c.agentId)}
                onSelect={startNew}
                onClose={() => setShowPicker(false)}
              />
            ) : activePartner ? (
              <ThreadView
                partner={activePartner}
                myId={myId}
                onSend={handleSend}
                partnerOnline={isOnline(agents.find((a) => a._id === activePartner._id)?.lastActiveAt, agents.find((a) => a._id === activePartner._id)?.isAiAgent)}
                isAiAgent={agents.find((a) => a._id === activePartner._id)?.isAiAgent}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-600">
                  <svg viewBox="0 0 20 20" fill="none" className="h-6 w-6">
                    <path d="M17 10c0 3.866-3.134 7-7 7a6.973 6.973 0 01-3.5-.937L3 17l.937-3.5A6.973 6.973 0 013 10c0-3.866 3.134-7 7-7s7 3.134 7 7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-300">Select a conversation</p>
                  <p className="mt-1 text-xs text-zinc-600">or start a new one with a colleague</p>
                </div>
                <button
                  onClick={() => setShowPicker(true)}
                  className="mt-1 rounded-full border border-zinc-700 px-4 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
                >
                  + New message
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
