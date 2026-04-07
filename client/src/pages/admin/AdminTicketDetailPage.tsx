import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminApi, getStoredAgent } from '../../services/adminApi';
import { useToast } from '../../components/Toast';
import type { AdminTicket, AdminTicketProduct, Agent, InternalNote, AiTriageResult, AiSuggestReplyResult, CustomerProfileResult, RemarketingPitchResult, AdminProduct, CoachMessage } from '../../types/admin';
import type { Reply, TicketStatus, TicketPriority } from '../../types/ticket';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import AttachmentGallery from '../../components/AttachmentGallery';
import { TicketDetailSkeleton } from '../../components/Skeleton';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatAge(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Splits "[Product Name] Ticket title" into its two parts. */
function parseTitle(raw: string): { productName: string | null; title: string } {
  const m = raw.match(/^\[(.+?)\]\s*(.+)$/);
  if (m) return { productName: m[1], title: m[2] };
  return { productName: null, title: raw };
}

// Merged thread item
type ThreadItem =
  | { kind: 'reply'; data: Reply }
  | { kind: 'note';  data: InternalNote };

function ReplyBubble({ reply, index }: { reply: Reply; index: number }) {
  const isAgent  = reply.isAgent;
  const isAiBot  = isAgent && reply.authorName === 'Agilate Support AI';

  const avatarCls = isAiBot
    ? 'border-violet-500/40 bg-violet-500/10 text-violet-400'
    : isAgent
      ? 'border-olive-500/30 bg-olive-500/10 text-olive-400'
      : 'border-zinc-700 bg-zinc-800 text-zinc-400';

  const bubbleCls = isAiBot
    ? 'rounded-tr-sm border border-violet-500/25 bg-violet-500/5'
    : isAgent
      ? 'rounded-tr-sm border border-olive-500/20 bg-olive-500/5'
      : 'rounded-tl-sm border border-zinc-800 bg-zinc-900';

  return (
    <div className={`flex gap-3 ${isAgent ? 'flex-row-reverse' : ''}`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${avatarCls}`}>
        {isAiBot ? '✦' : reply.authorName[0]?.toUpperCase()}
      </span>
      <div className={`max-w-[80%] flex-1 rounded-xl p-4 ${bubbleCls}`}>
        <div className={`flex flex-wrap items-baseline gap-2 ${isAgent ? 'flex-row-reverse' : ''}`}>
          <span className="text-sm font-semibold text-zinc-200">{reply.authorName}</span>
          {isAiBot && (
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
              ✦ AI Agent · Auto-sent
            </span>
          )}
          {isAgent && !isAiBot && (
            <span className="rounded-full border border-olive-500/30 bg-olive-500/10 px-2 py-0.5 text-[10px] font-medium text-olive-400">
              Agent
            </span>
          )}
          <span className="ml-auto text-xs text-zinc-600">#{index + 1} · {formatDate(reply.createdAt)}</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">{reply.body}</p>
      </div>
    </div>
  );
}

function NoteBubble({ note }: { note: InternalNote }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-xs font-bold text-amber-400">
        {note.authorName[0]?.toUpperCase()}
      </span>
      <div className="flex-1 rounded-xl rounded-tl-sm border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-semibold text-zinc-300">{note.authorName}</span>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
            Internal Note
          </span>
          <span className="ml-auto text-xs text-zinc-600">{formatDate(note.createdAt)}</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-500">{note.body}</p>
      </div>
    </div>
  );
}

// ─── Product color avatar helper ─────────────────────────────────────────────

const PRODUCT_PALETTES = [
  { bg: 'bg-sky-500/20',     text: 'text-sky-300',     border: 'border-sky-500/30'     },
  { bg: 'bg-violet-500/20',  text: 'text-violet-300',  border: 'border-violet-500/30'  },
  { bg: 'bg-amber-500/20',   text: 'text-amber-300',   border: 'border-amber-500/30'   },
  { bg: 'bg-rose-500/20',    text: 'text-rose-300',    border: 'border-rose-500/30'    },
  { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  { bg: 'bg-cyan-500/20',    text: 'text-cyan-300',    border: 'border-cyan-500/30'    },
  { bg: 'bg-orange-500/20',  text: 'text-orange-300',  border: 'border-orange-500/30'  },
  { bg: 'bg-pink-500/20',    text: 'text-pink-300',    border: 'border-pink-500/30'    },
];

function productPalette(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return PRODUCT_PALETTES[h % PRODUCT_PALETTES.length];
}

// ─── Product viewer modal ─────────────────────────────────────────────────────

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

interface FullProduct {
  _id: string;
  name: string;
  category: string;
  description: string;
  sku: string;
  price: number | null;
  imageUrl: string | null;
}

function ProductViewerModal({ product, onClose }: { product: AdminTicketProduct; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const palette = productPalette(product.name);
  const [full, setFull] = useState<FullProduct | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${BASE}/products/${product._id}`);
        if (res.ok) {
          const json = await res.json() as { data: FullProduct };
          setFull(json.data);
        }
      } finally {
        setFetching(false);
      }
    })();
  }, [product._id]);

  const display = full ?? product;
  const imageUrl = full?.imageUrl ?? product.imageUrl;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={(e) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        ref={ref}
        className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header band */}
        <div className={`relative flex h-40 w-full shrink-0 items-center justify-center overflow-hidden ${palette.bg}`}>
          {imageUrl ? (
            <img src={imageUrl} alt={display.name} className="h-full w-full object-cover opacity-80" />
          ) : (
            <span className={`text-7xl font-bold select-none opacity-60 ${palette.text}`}>
              {display.name[0]?.toUpperCase()}
            </span>
          )}
          {display.category && (
            <span className="absolute bottom-3 left-3 rounded-full border border-zinc-700/60 bg-zinc-900/70 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 backdrop-blur-sm">
              {display.category}
            </span>
          )}
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-zinc-400 backdrop-blur-sm transition hover:text-zinc-100"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-xl font-bold text-zinc-100">{display.name}</h2>
            {display.price != null && (
              <span className="shrink-0 rounded-full border border-olive-500/30 bg-olive-500/10 px-3 py-1 text-sm font-bold text-olive-400">
                ${display.price}
              </span>
            )}
          </div>


          <div className="mt-4">
            {fetching ? (
              <div className="space-y-2">
                <div className="h-3 w-full animate-pulse rounded bg-zinc-800" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-zinc-800" />
                <div className="h-3 w-3/5 animate-pulse rounded bg-zinc-800" />
              </div>
            ) : full?.description ? (
              <p className="text-sm leading-relaxed text-zinc-400">{full.description}</p>
            ) : (
              <p className="text-xs italic text-zinc-700">No description available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductThumbnail({ product }: { product: AdminTicketProduct }) {
  const [modalOpen, setModalOpen] = useState(false);
  const palette = productPalette(product.name);

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        title={`View product: ${product.name}`}
        className={`inline-flex items-center gap-2 rounded-lg border bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold transition hover:bg-zinc-800 ${palette.border} ${palette.text}`}
      >
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="h-5 w-5 shrink-0 rounded object-cover" />
        ) : (
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold ${palette.bg} ${palette.text}`}>
            {product.name[0]?.toUpperCase()}
          </span>
        )}
        <span>{product.name}</span>
        {product.price != null && (
          <span className="font-normal text-zinc-500">${product.price}</span>
        )}
      </button>
      {modalOpen && <ProductViewerModal product={product} onClose={() => setModalOpen(false)} />}
    </>
  );
}


function AiTypingBubble() {
  return (
    <div className="flex flex-row-reverse gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 text-xs font-bold text-violet-400">
        ✦
      </span>
      <div className="max-w-[80%] flex-1 rounded-xl rounded-tr-sm border border-violet-500/25 bg-violet-500/5 p-4">
        <div className="flex flex-row-reverse items-baseline gap-2 mb-3">
          <span className="text-sm font-semibold text-zinc-200">AI Agent</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
            ✦ Generating reply…
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-violet-500/60 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="h-2 w-2 rounded-full bg-violet-500/60 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="h-2 w-2 rounded-full bg-violet-500/60 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

const PRIORITY_OPTIONS: { value: TicketPriority; label: string; activeCls: string }[] = [
  { value: 'high',       label: 'High',       activeCls: 'border-red-500/40 bg-red-500/15 text-red-400'       },
  { value: 'medium',     label: 'Medium',     activeCls: 'border-amber-500/40 bg-amber-500/15 text-amber-400' },
  { value: 'low',        label: 'Low',        activeCls: 'border-sky-500/40 bg-sky-500/15 text-sky-400'       },
  { value: 'irrelevant', label: 'Irrelevant', activeCls: 'border-zinc-600/60 bg-zinc-800 text-zinc-500 line-through' },
];

const STATUS_OPTIONS: { value: TicketStatus; label: string; activeCls: string }[] = [
  { value: 'new',         label: 'New',         activeCls: 'border-olive-500/40 bg-olive-500/15 text-olive-400'   },
  { value: 'in_progress', label: 'In Progress', activeCls: 'border-sky-500/40 bg-sky-500/15 text-sky-400'         },
  { value: 'resolved',    label: 'Resolved',    activeCls: 'border-violet-500/40 bg-violet-500/15 text-violet-400' },
];

const textareaCls = 'block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-olive-500/20 resize-none';

// ─── Risk / Level visual helpers ────────────────────────────────────────────

function RiskPill({ level, label }: { level: 'low' | 'medium' | 'high'; label: string }) {
  const cls =
    level === 'high'   ? 'border-red-500/30 bg-red-500/10 text-red-400' :
    level === 'medium' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' :
                         'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

function RiskBar({ level }: { level: 'low' | 'medium' | 'high' }) {
  const width = level === 'high' ? '90%' : level === 'medium' ? '55%' : '20%';
  const color = level === 'high' ? 'bg-red-500' : level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="h-1 w-full rounded-full bg-zinc-800">
      <div className={`h-1 rounded-full transition-all duration-500 ${color}`} style={{ width }} />
    </div>
  );
}

const ARCHETYPE_META: Record<string, { icon: string; color: string }> = {
  early_adopter:      { icon: '🚀', color: 'border-sky-500/30 bg-sky-500/10 text-sky-400' },
  loyal_advocate:     { icon: '⭐', color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
  price_sensitive:    { icon: '💰', color: 'border-amber-500/30 bg-amber-500/10 text-amber-400' },
  casual_buyer:       { icon: '🛍️', color: 'border-zinc-600/40 bg-zinc-800 text-zinc-400' },
  frustrated_veteran: { icon: '⚡', color: 'border-red-500/30 bg-red-500/10 text-red-400' },
};

const SENTIMENT_META: Record<string, { icon: string; color: string }> = {
  positive:   { icon: '😊', color: 'text-emerald-400' },
  neutral:    { icon: '😐', color: 'text-zinc-400' },
  frustrated: { icon: '😤', color: 'text-amber-400' },
  hostile:    { icon: '😠', color: 'text-red-400' },
};

// ─── Reply Goal Modal ─────────────────────────────────────────────────────────

const REPLY_GOALS = [
  { id: 'retention',     label: 'Customer Retention',   icon: '🤝', desc: 'Preserve the relationship and prevent churn',              color: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300 hover:bg-emerald-500/10' },
  { id: 'satisfaction',  label: 'Satisfaction Recovery', icon: '⭐', desc: 'Turn a negative experience into a resolved, positive one', color: 'border-sky-500/30 bg-sky-500/5 text-sky-300 hover:bg-sky-500/10' },
  { id: 'deescalation',  label: 'De-escalation',         icon: '🕊️', desc: 'Defuse emotional tension before addressing the core issue', color: 'border-amber-500/30 bg-amber-500/5 text-amber-300 hover:bg-amber-500/10' },
  { id: 'negotiation',   label: 'Dispute Negotiation',   icon: '⚖️', desc: 'Navigate refund or compensation toward a mutual outcome',  color: 'border-red-500/30 bg-red-500/5 text-red-300 hover:bg-red-500/10' },
] as const;

function ReplyGoalModal({ open, onClose, onSelect, hasTyped }: {
  open: boolean;
  onClose: () => void;
  onSelect: (goal?: string) => void;
  hasTyped: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10 text-xs font-bold text-violet-400">✦</span>
            <div>
              <p className="text-sm font-semibold text-zinc-100">
                {hasTyped ? 'How should the AI improve your draft?' : 'What\'s the goal of this reply?'}
              </p>
              <p className="text-[10px] text-zinc-600">The AI will tailor the reply to your chosen objective</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-2">
          {/* Automatic — top option */}
          <button
            onClick={() => { onSelect(undefined); onClose(); }}
            className="flex w-full items-start gap-3 rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-3 text-left transition hover:bg-violet-500/15"
          >
            <span className="mt-px shrink-0 text-base">⚡</span>
            <div>
              <p className="text-xs font-semibold text-violet-300">Automatic</p>
              <p className="text-[10px] text-zinc-500">AI picks the best angle based on ticket context</p>
            </div>
          </button>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {REPLY_GOALS.map((g) => (
              <button
                key={g.id}
                onClick={() => { onSelect(`${g.label}: ${g.desc}`); onClose(); }}
                className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left text-xs transition ${g.color}`}
              >
                <span className="mt-px shrink-0">{g.icon}</span>
                <div>
                  <p className="font-semibold leading-tight">{g.label}</p>
                  <p className="mt-0.5 text-[10px] opacity-60 leading-snug">{g.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-zinc-800 px-6 py-3">
          <button onClick={onClose} className="text-[11px] text-zinc-600 transition hover:text-zinc-400">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Agent Coach ─────────────────────────────────────────────────────────────

const COACH_INTENTIONS = [
  {
    id: 'retention',
    label: 'Customer Retention',
    icon: '🤝',
    sub: 'Preserve the relationship and prevent churn',
    chip: 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10',
    active: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300',
  },
  {
    id: 'satisfaction',
    label: 'Satisfaction Recovery',
    icon: '⭐',
    sub: 'Turn a negative experience into a resolved, positive one',
    chip: 'border-sky-500/30 text-sky-400 hover:bg-sky-500/10',
    active: 'border-sky-500/50 bg-sky-500/15 text-sky-300',
  },
  {
    id: 'deescalation',
    label: 'De-escalation',
    icon: '🕊️',
    sub: 'Defuse emotional tension before addressing the core issue',
    chip: 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10',
    active: 'border-amber-500/50 bg-amber-500/15 text-amber-300',
  },
  {
    id: 'negotiation',
    label: 'Dispute Negotiation',
    icon: '⚖️',
    sub: 'Navigate refund or compensation toward the best mutual outcome',
    chip: 'border-red-500/30 text-red-400 hover:bg-red-500/10',
    active: 'border-red-500/50 bg-red-500/15 text-red-300',
  },
  {
    id: 'crosssell',
    label: 'Cross-sell Opportunity',
    icon: '🎯',
    sub: 'Identify the right moment to expand the customer\'s relationship with the brand',
    chip: 'border-violet-500/30 text-violet-400 hover:bg-violet-500/10',
    active: 'border-violet-500/50 bg-violet-500/15 text-violet-300',
  },
  {
    id: 'insight',
    label: 'Insight Extraction',
    icon: '💡',
    sub: 'Transform the complaint into actionable product or service intelligence',
    chip: 'border-zinc-600/40 text-zinc-400 hover:bg-zinc-800',
    active: 'border-zinc-500/50 bg-zinc-700 text-zinc-300',
  },
] as const;

const FREE_CHAT_INTENTION = {
  id: 'free' as const,
  label: 'Free Chat',
  icon: '💬',
  sub: 'Ask anything about this ticket without a specific objective',
  intentionLabel: 'General Question',
  intentionDescription: 'The agent wants to freely ask questions or explore ideas about this ticket and customer.',
};

type IntentionId = (typeof COACH_INTENTIONS)[number]['id'] | 'free';

interface CoachSlideOverProps {
  open: boolean;
  onClose: () => void;
  ticket: AdminTicket;
  profile: CustomerProfileResult | null;
  onUseInReply: (text: string) => void;
}

function CoachSlideOver({ open, onClose, ticket, profile, onUseInReply }: CoachSlideOverProps) {
  const { toast } = useToast();
  const [intention, setIntention] = useState<IntentionId | null>(null);
  const [history, setHistory] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const intentionMeta = intention === 'free'
    ? FREE_CHAT_INTENTION
    : intention
      ? COACH_INTENTIONS.find((i) => i.id === intention) ?? null
      : null;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading]);

  // Reset chat when closed
  useEffect(() => {
    if (!open) { setIntention(null); setHistory([]); setInput(''); }
  }, [open]);

  async function startSession(id: IntentionId) {
    setIntention(id);
    setHistory([]);
    // Free chat — don't auto-send opening briefing; let the user speak first
    if (id === 'free') return;
    const meta = COACH_INTENTIONS.find((i) => i.id === id)!;
    setLoading(true);
    try {
      const { data } = await adminApi.ai.coach({
        subject:              ticket.title,
        message:              ticket.description,
        productTitle:         ticket.product?.name,
        archetype:            profile?.archetype,
        archetypeLabel:       profile?.archetypeLabel,
        archetypeReason:      profile?.archetypeReason,
        refundIntent:         profile?.refundIntent,
        refundIntentReason:   profile?.refundIntentReason,
        churnRisk:            profile?.churnRisk,
        sentiment:            profile?.sentiment,
        lifetimeValueSignal:  profile?.lifetimeValueSignal,
        recommendedApproach:  profile?.recommendedApproach,
        aiSummary:            ticket.aiSummary,
        aiPriority:           ticket.aiPriority,
        aiSuggestedNextStep:  ticket.aiSuggestedNextStep,
        aiTags:               ticket.aiTags,
        intentionId:          id,
        intentionLabel:       meta.label,
        intentionDescription: meta.sub,
        history: [],
      });
      setHistory([{ role: 'assistant', content: data.reply }]);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Advisor unavailable', 'error');
      setIntention(null);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || !intention || loading) return;
    const meta = intention === 'free'
      ? { label: FREE_CHAT_INTENTION.intentionLabel, sub: FREE_CHAT_INTENTION.intentionDescription }
      : (COACH_INTENTIONS.find((i) => i.id === intention) ?? { label: '', sub: '' });
    const userMsg: CoachMessage = { role: 'user', content: input.trim() };
    const nextHistory = [...history, userMsg];
    setHistory(nextHistory);
    setInput('');
    setLoading(true);
    try {
      const { data } = await adminApi.ai.coach({
        subject:              ticket.title,
        message:              ticket.description,
        productTitle:         ticket.product?.name,
        archetype:            profile?.archetype,
        archetypeLabel:       profile?.archetypeLabel,
        archetypeReason:      profile?.archetypeReason,
        refundIntent:         profile?.refundIntent,
        refundIntentReason:   profile?.refundIntentReason,
        churnRisk:            profile?.churnRisk,
        sentiment:            profile?.sentiment,
        lifetimeValueSignal:  profile?.lifetimeValueSignal,
        recommendedApproach:  profile?.recommendedApproach,
        aiSummary:            ticket.aiSummary,
        aiPriority:           ticket.aiPriority,
        aiSuggestedNextStep:  ticket.aiSuggestedNextStep,
        aiTags:               ticket.aiTags,
        intentionId:          intention,
        intentionLabel:       meta.label,
        intentionDescription: meta.sub,
        history: nextHistory,
      });
      setHistory((h) => [...h, { role: 'assistant', content: data.reply }]);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Advisor unavailable', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-30 flex w-full max-w-lg flex-col bg-zinc-950 shadow-2xl border-l border-zinc-800">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 text-sm">
              💬
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-100">AI Advisor</p>
              {intentionMeta ? (
                intention === 'free' ? (
                  <p className="text-[10px] text-zinc-500">Free chat — ask anything about this ticket</p>
                ) : (
                  <p className="text-[10px] text-zinc-500">
                    Goal: <span className="text-violet-400">{intentionMeta.label}</span>
                  </p>
                )
              ) : (
                <p className="text-[10px] text-zinc-600">Select your objective to begin</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {intention && (
              <button
                onClick={() => { setIntention(null); setHistory([]); }}
                className="rounded border border-zinc-800 px-2.5 py-1 text-[10px] font-semibold text-zinc-600 transition hover:text-zinc-300"
              >
                ↩ Change goal
              </button>
            )}
            <button onClick={onClose} className="text-zinc-600 transition hover:text-zinc-300 text-lg leading-none">✕</button>
          </div>
        </div>

        {/* Ticket context pill */}
        <div className="shrink-0 border-b border-zinc-800/60 bg-zinc-900/50 px-5 py-2.5">
          <p className="truncate text-[11px] text-zinc-500">
            <span className="text-zinc-600">Ticket: </span>{ticket.title}
            {ticket.product && (() => { const p = productPalette(ticket.product.name); return <span className={`ml-2 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${p.bg} ${p.text} ${p.border}`}>{ticket.product.name[0]?.toUpperCase()} {ticket.product.name}</span>; })()}
          </p>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* Intention selector */}
          {!intention && (
            <div className="flex-1 overflow-y-auto p-5">
              <p className="mb-1 text-sm font-semibold text-zinc-200">What's your objective for this interaction?</p>
              <p className="mb-5 text-xs text-zinc-500">Your advisor will tailor every suggestion to your chosen goal.</p>
              <div className="grid grid-cols-2 gap-2.5">
                {COACH_INTENTIONS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => void startSession(item.id)}
                    className={`flex flex-col items-start rounded-xl border bg-zinc-900 p-3.5 text-left transition ${item.chip}`}
                  >
                    <span className="mb-1.5 text-xl leading-none">{item.icon}</span>
                    <span className="text-xs font-semibold">{item.label}</span>
                    <span className="mt-1 text-[10px] text-zinc-600 leading-snug">{item.sub}</span>
                  </button>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>
              <button
                onClick={() => void startSession('free')}
                className="mt-3 w-full flex items-center gap-3 rounded-xl border border-zinc-700/60 bg-zinc-900 p-3.5 text-left transition hover:border-zinc-600 hover:bg-zinc-800/60"
              >
                <span className="text-xl leading-none">{FREE_CHAT_INTENTION.icon}</span>
                <div>
                  <span className="text-xs font-semibold text-zinc-300">{FREE_CHAT_INTENTION.label}</span>
                  <p className="mt-0.5 text-[10px] text-zinc-600 leading-snug">{FREE_CHAT_INTENTION.sub}</p>
                </div>
              </button>

              {!profile && (
                <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                  <p className="text-[10px] text-amber-500/80">
                    💡 Run <span className="font-semibold">Customer Intelligence</span> first in Marketing Tools for sharper, profile-aware advisory.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Chat view */}
          {intention && (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

                {/* Free chat — empty state prompt */}
                {intention === 'free' && history.length === 0 && !loading && (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-2xl">💬</span>
                    <div>
                      <p className="text-xs font-semibold text-zinc-300">Ask anything about this ticket</p>
                      <p className="mt-1 text-[11px] text-zinc-600 leading-relaxed max-w-xs">
                        No objective needed — just type your question and get instant guidance on this customer, issue, or conversation.
                      </p>
                    </div>
                  </div>
                )}

                {/* Loading initial briefing */}
                {loading && history.length === 0 && (
                  <div className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 text-xs font-bold text-violet-400">✦</span>
                    <div className="flex-1 rounded-xl rounded-tl-sm border border-violet-500/20 bg-violet-500/5 p-3.5">
                      <div className="flex items-center gap-1.5">
                        {[0, 150, 300].map((d) => (
                          <span key={d} className="h-1.5 w-1.5 rounded-full bg-violet-500/60 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                        ))}
                        <span className="ml-2 text-[11px] text-violet-400/60">Analysing ticket…</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Messages */}
                {history.map((msg, i) => {
                  if (msg.role === 'user') {
                    return (
                      <div key={i} className="flex flex-row-reverse gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-[10px] font-bold text-zinc-400">A</span>
                        <div className="max-w-[85%] rounded-xl rounded-tr-sm border border-zinc-700 bg-zinc-800 px-3.5 py-2.5">
                          <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">{msg.content}</p>
                        </div>
                      </div>
                    );
                  }

                  // Render assistant message — parse "→ "..." " lines as highlighted suggestions
                  const parts = msg.content.split('\n');
                  return (
                    <div key={i} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 text-xs font-bold text-violet-400">✦</span>
                      <div className="flex-1 rounded-xl rounded-tl-sm border border-violet-500/20 bg-violet-500/5 px-3.5 py-3">
                        <div className="space-y-2 text-xs leading-relaxed">
                          {parts.map((line, li) => {
                            // Highlighted suggestion line: → "..."
                            const suggMatch = line.match(/^→\s*"(.+)"$/);
                            if (suggMatch) {
                              return (
                                <div key={li} className="group flex items-start gap-2 rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-2">
                                  <span className="mt-0.5 shrink-0 text-violet-500">→</span>
                                  <p className="flex-1 font-medium text-violet-300 leading-relaxed italic">"{suggMatch[1]}"</p>
                                  <button
                                    onClick={() => { onUseInReply(suggMatch[1]); toast('Added to reply', 'success'); }}
                                    className="shrink-0 rounded border border-violet-500/30 px-1.5 py-0.5 text-[9px] font-semibold text-violet-400 opacity-0 transition group-hover:opacity-100 hover:bg-violet-500/20"
                                  >
                                    Use →
                                  </button>
                                </div>
                              );
                            }
                            return line.trim() ? (
                              <p key={li} className="text-zinc-300">{line}</p>
                            ) : <div key={li} className="h-1" />;
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Loading while waiting for next reply */}
                {loading && history.length > 0 && (
                  <div className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 text-xs font-bold text-violet-400">✦</span>
                    <div className="rounded-xl rounded-tl-sm border border-violet-500/20 bg-violet-500/5 px-3.5 py-3">
                      <div className="flex items-center gap-1.5">
                        {[0, 150, 300].map((d) => (
                          <span key={d} className="h-1.5 w-1.5 rounded-full bg-violet-500/60 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="shrink-0 border-t border-zinc-800 p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
                    disabled={loading}
                    placeholder="Ask your advisor anything…"
                    className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500/30 disabled:opacity-50"
                  />
                  <button
                    onClick={() => void sendMessage()}
                    disabled={loading || !input.trim()}
                    className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-4 py-2.5 text-xs font-semibold text-violet-400 transition hover:bg-violet-500/25 disabled:opacity-40"
                  >
                    {loading ? '…' : '↑'}
                  </button>
                </div>
                <p className="mt-2 text-[9px] text-zinc-700">AI coaching — verify advice before acting · Enter to send</p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Marketing Panel ─────────────────────────────────────────────────────────

interface MarketingPanelProps {
  ticket: AdminTicket;
  onAppendToReply: (text: string) => void;
  onProfileChange: (profile: CustomerProfileResult | null) => void;
}

function MarketingPanel({ ticket, onAppendToReply, onProfileChange }: MarketingPanelProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  // Customer Intelligence — seed from persisted ticket data
  const [profile, setProfile] = useState<CustomerProfileResult | null>(() => {
    if (!ticket.mktArchetype) return null;
    return {
      archetype:           ticket.mktArchetype as CustomerProfileResult['archetype'],
      archetypeLabel:      ticket.mktArchetypeLabel ?? '',
      archetypeReason:     ticket.mktArchetypeReason ?? '',
      refundIntent:        (ticket.mktRefundIntent ?? 'low') as CustomerProfileResult['refundIntent'],
      refundIntentReason:  ticket.mktRefundIntentReason ?? '',
      churnRisk:           (ticket.mktChurnRisk ?? 'low') as CustomerProfileResult['churnRisk'],
      sentiment:           (ticket.mktSentiment ?? 'neutral') as CustomerProfileResult['sentiment'],
      lifetimeValueSignal: (ticket.mktLifetimeValueSignal ?? 'medium') as CustomerProfileResult['lifetimeValueSignal'],
      recommendedApproach: ticket.mktRecommendedApproach ?? '',
    };
  });
  const [profiling, setProfiling] = useState(false);

  // Remarketing
  const [remarketMode, setRemarketMode] = useState<'auto' | 'manual'>('auto');
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [pitch, setPitch] = useState<RemarketingPitchResult | null>(null);
  const [remarketing, setRemarketing] = useState(false);

  async function handleAnalyzeProfile() {
    setProfiling(true);
    try {
      const history = ticket.replies
        .map((r) => `${r.isAgent ? 'Agent' : 'Customer'} (${r.authorName}): ${r.body}`)
        .join('\n\n');
      const { data } = await adminApi.ai.customerProfile({
        ticketId:           ticket._id,
        subject:            ticket.title,
        message:            ticket.description,
        productTitle:       ticket.product?.name,
        conversationHistory: history || undefined,
      });
      setProfile(data);
      onProfileChange(data);
      toast('Customer profile ready', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Profile analysis failed', 'error');
    } finally {
      setProfiling(false);
    }
  }

  async function loadProducts() {
    if (productsLoaded) return;
    try {
      const res = await adminApi.products();
      setProducts(res.data);
      setProductsLoaded(true);
    } catch { /* silent */ }
  }

  async function handleRemarket() {
    setRemarketing(true);
    setPitch(null);
    try {
      const { data } = await adminApi.ai.remarket({
        subject:           ticket.title,
        message:           ticket.description,
        productTitle:      ticket.product?.name,
        customerArchetype: profile?.archetype,
        refundIntent:      profile?.refundIntent,
        sentiment:         profile?.sentiment,
        targetProductId:   remarketMode === 'manual' && selectedProductId ? selectedProductId : undefined,
      });
      setPitch(data);
      toast('Recommendation ready', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Remarketing failed', 'error');
    } finally {
      setRemarketing(false);
    }
  }

  function handleModeChange(mode: 'auto' | 'manual') {
    setRemarketMode(mode);
    setPitch(null);
    if (mode === 'manual') void loadProducts();
  }

  const archetypeMeta = profile ? (ARCHETYPE_META[profile.archetype] ?? ARCHETYPE_META.casual_buyer) : null;
  const sentimentMeta = profile ? (SENTIMENT_META[profile.sentiment] ?? SENTIMENT_META.neutral) : null;

  return (
    <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.03] overflow-hidden">
      {/* Header / Toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-rose-500/5"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">📊</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400/80">Marketing Tools</span>
        </div>
        <svg
          viewBox="0 0 12 12" fill="none"
          className={`h-3 w-3 text-rose-400/50 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="border-t border-rose-500/15 px-4 pb-4 pt-3 space-y-5">

          {/* ── Section 1: Customer Intelligence ── */}
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Customer Intelligence</p>
                {ticket.mktProfiledAt && (
                  <p className="mt-0.5 text-[9px] text-zinc-700">
                    Last run {new Date(ticket.mktProfiledAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => void handleAnalyzeProfile()}
                disabled={profiling}
                className="flex items-center gap-1 rounded border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-40"
              >
                <span>{profiling ? '⟳' : '✦'}</span>
                {profiling ? 'Analysing…' : profile ? 'Refresh' : 'Analyse'}
              </button>
            </div>

            {profiling && !profile && (
              <div className="space-y-1.5 animate-pulse">
                {[1,2,3].map((i) => <div key={i} className="h-2.5 rounded bg-zinc-800" style={{ width: `${90 - i * 15}%` }} />)}
              </div>
            )}

            {!profile && !profiling && (
              <p className="text-xs text-zinc-600">Click Analyse to profile this customer's intent, archetype, and churn risk.</p>
            )}

            {profile && (
              <div className="space-y-3">
                {/* Archetype */}
                <div className="flex items-start gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                  <span className="text-base leading-none mt-0.5">{archetypeMeta?.icon}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${archetypeMeta?.color}`}>
                        {profile.archetypeLabel}
                      </span>
                      <span className={`text-sm font-bold ${sentimentMeta?.color}`}>{sentimentMeta?.icon}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">{profile.archetypeReason}</p>
                  </div>
                </div>

                {/* Risk gauges */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Refund Risk</span>
                      <RiskPill level={profile.refundIntent} label={profile.refundIntent} />
                    </div>
                    <RiskBar level={profile.refundIntent} />
                    <p className="mt-1 text-[9px] text-zinc-600 leading-snug">{profile.refundIntentReason}</p>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Churn Risk</span>
                      <RiskPill level={profile.churnRisk} label={profile.churnRisk} />
                    </div>
                    <RiskBar level={profile.churnRisk} />
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-700">LTV</span>
                      <RiskPill level={profile.lifetimeValueSignal} label={profile.lifetimeValueSignal} />
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* ── Divider ── */}
          <div className="h-px bg-zinc-800" />

          {/* ── Section 2: AI Remarketing ── */}
          <div>
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Product Remarketing</p>

            {/* Mode selector */}
            <div className="mb-3 flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
              {(['auto', 'manual'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode)}
                  className={`flex-1 rounded-md py-1.5 text-[10px] font-semibold uppercase tracking-wider transition ${
                    remarketMode === mode
                      ? 'bg-zinc-700 text-zinc-100'
                      : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  {mode === 'auto' ? '✦ AI picks' : '☰ Manual'}
                </button>
              ))}
            </div>

            {/* Manual: product selector */}
            {remarketMode === 'manual' && (
              <div className="mb-3">
                <select
                  value={selectedProductId}
                  onChange={(e) => { setSelectedProductId(e.target.value); setPitch(null); }}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-rose-500/30"
                >
                  <option value="">— Select a product —</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>{p.name} · {p.category}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Generate button */}
            <button
              onClick={() => void handleRemarket()}
              disabled={remarketing || (remarketMode === 'manual' && !selectedProductId)}
              className="w-full rounded-lg border border-rose-500/30 bg-rose-500/10 py-2 text-[10px] font-semibold uppercase tracking-wider text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-40"
            >
              {remarketing
                ? '✦ Generating…'
                : pitch
                  ? '↻ Regenerate'
                  : remarketMode === 'auto'
                    ? '✦ Generate Recommendation'
                    : '✦ Generate Pitch'}
            </button>

            {/* Result */}
            {pitch && (
              <div className="mt-3 space-y-2.5">
                {!pitch.shouldPitch ? (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500">Not recommended</p>
                    <p className="mt-1 text-[11px] text-zinc-500">AI detected this customer may not be receptive to a pitch right now (high refund intent or hostile sentiment).</p>
                  </div>
                ) : (
                  <>
                    {/* Product card */}
                    <div className="flex items-center gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900 p-2.5">
                      {pitch.imageUrl ? (
                        <img src={pitch.imageUrl} alt={pitch.productName} className="h-12 w-12 shrink-0 rounded-md object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-800 text-lg text-zinc-700">☐</div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-zinc-200">{pitch.productName}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{pitch.matchReason}</p>
                      </div>
                    </div>

                    {/* Pitch preview */}
                    {pitch.appendedMessage && (
                      <div className="rounded-lg border border-rose-500/15 bg-zinc-900 px-3 py-2.5">
                        <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Message Add-on Preview</p>
                        <p className="text-[11px] leading-relaxed text-zinc-400 whitespace-pre-wrap">{pitch.appendedMessage}</p>
                        {pitch.productSlug && (
                          <p className="mt-2 text-[10px] text-zinc-500 italic">
                            + View product: …/products?product={pitch.productSlug}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {pitch.appendedMessage && (
                        <button
                          onClick={() => {
                            const productLink = pitch.productSlug
                              ? `\n\nView product: ${window.location.origin}/products?product=${pitch.productSlug}`
                              : '';
                            onAppendToReply('\n\n' + pitch.appendedMessage + productLink);
                            toast('Added to reply', 'success');
                          }}
                          className="flex-1 rounded border border-olive-500/30 bg-olive-500/10 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-olive-400 transition hover:bg-olive-500/20"
                        >
                          + Append to Reply
                        </button>
                      )}
                      {pitch.appendedMessage && (
                        <button
                          onClick={() => {
                            const productLink = pitch.productSlug
                              ? `\n\nView product: ${window.location.origin}/products?product=${pitch.productSlug}`
                              : '';
                            void navigator.clipboard.writeText(pitch.appendedMessage + productLink);
                            toast('Copied', 'success');
                          }}
                          className="rounded border border-zinc-800 px-3 py-1.5 text-[10px] font-semibold text-zinc-500 transition hover:text-zinc-300"
                        >
                          Copy
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminTicketDetailPage() {
  const { id }     = useParams<{ id: string }>();
  const { toast }  = useToast();

  const currentAgentId = getStoredAgent()?._id;
  const [ticket,  setTicket]  = useState<AdminTicket | null>(null);
  const [agents,  setAgents]  = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Priority
  const [updatingPriority, setUpdatingPriority] = useState(false);

  // Status
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Assign
  const [assigning,        setAssigning]        = useState(false);
  const [pendingAgentId,   setPendingAgentId]   = useState<string | null>(null);
  const [aiTyping,         setAiTyping]         = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reply
  const [replyBody,   setReplyBody]   = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Note
  const [noteBody,   setNoteBody]    = useState('');
  const [addingNote, setAddingNote]  = useState(false);

  // AI
  const [aiResult,      setAiResult]      = useState<AiTriageResult | null>(null);
  const [aiRunning,     setAiRunning]     = useState(false);
  const [aiError,       setAiError]       = useState<string | null>(null);
  const [suggestResult, setSuggestResult] = useState<AiSuggestReplyResult | null>(null);
  const [suggesting,    setSuggesting]    = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);

  // Coach
  const [coachOpen,    setCoachOpen]    = useState(false);
  const [coachProfile, setCoachProfile] = useState<CustomerProfileResult | null>(null);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [ticketRes, agentsRes] = await Promise.all([
        adminApi.tickets.get(id),
        adminApi.agents(),
      ]);
      setTicket(ticketRes.data);
      setAgents(agentsRes.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // Seed AI state from persisted ticket fields when ticket loads
  useEffect(() => {
    if (ticket?.aiSummary) {
      setAiResult({
        summary:           ticket.aiSummary,
        priority:          (ticket.aiPriority === 'low' || ticket.aiPriority === 'high') ? ticket.aiPriority : 'medium',
        suggestedNextStep: ticket.aiSuggestedNextStep ?? '',
        tags:              ticket.aiTags ?? [],
      });
    }
  }, [ticket?.aiSummary]);

  // Seed Customer Intelligence from persisted ticket fields
  useEffect(() => {
    if (!ticket?.mktArchetype) return;
    setCoachProfile({
      archetype:           ticket.mktArchetype as CustomerProfileResult['archetype'],
      archetypeLabel:      ticket.mktArchetypeLabel ?? '',
      archetypeReason:     ticket.mktArchetypeReason ?? '',
      refundIntent:        (ticket.mktRefundIntent ?? 'low') as CustomerProfileResult['refundIntent'],
      refundIntentReason:  ticket.mktRefundIntentReason ?? '',
      churnRisk:           (ticket.mktChurnRisk ?? 'low') as CustomerProfileResult['churnRisk'],
      sentiment:           (ticket.mktSentiment ?? 'neutral') as CustomerProfileResult['sentiment'],
      lifetimeValueSignal: (ticket.mktLifetimeValueSignal ?? 'medium') as CustomerProfileResult['lifetimeValueSignal'],
      recommendedApproach: ticket.mktRecommendedApproach ?? '',
    });
  }, [ticket?.mktArchetype]);


  async function handlePriorityChange(priority: TicketPriority) {
    if (!id) return;
    setUpdatingPriority(true);
    try {
      const res = await adminApi.tickets.updatePriority(id, priority);
      setTicket(res.data);
      toast(`Priority set to "${priority}"`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to update priority', 'error');
    } finally {
      setUpdatingPriority(false);
    }
  }

  async function handleStatusChange(status: TicketStatus) {
    if (!id) return;
    setUpdatingStatus(true);
    try {
      const res = await adminApi.tickets.updateStatus(id, status);
      setTicket(res.data);
      toast(`Status updated to "${status.replace('_', ' ')}"`, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to update status', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  }

  function startAiPolling(prevReplyCount: number) {
    if (pollRef.current) clearInterval(pollRef.current);
    const deadline = Date.now() + 90_000; // stop after 90s
    pollRef.current = setInterval(async () => {
      if (!id) return;
      if (Date.now() > deadline) {
        clearInterval(pollRef.current!);
        setAiTyping(false);
        return;
      }
      try {
        const res = await adminApi.tickets.get(id);
        if (res.data.replies.length > prevReplyCount) {
          setTicket(res.data);
          setAiTyping(false);
          clearInterval(pollRef.current!);
        }
      } catch { /* ignore poll errors */ }
    }, 2500);
  }

  async function handleAssign(agentId: string) {
    if (!id) return;
    setAssigning(true);
    const isAiAgent = agents.find((a) => a._id === agentId)?.isAiAgent ?? false;
    const prevReplyCount = ticket?.replies.length ?? 0;
    try {
      const res = await adminApi.tickets.assign(id, agentId === '' ? null : agentId);
      setTicket(res.data);
      toast(agentId ? 'Ticket assigned' : 'Ticket unassigned', 'success');
      if (isAiAgent) {
        setAiTyping(true);
        startAiPolling(prevReplyCount);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to assign', 'error');
    } finally {
      setAssigning(false);
    }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !replyBody.trim()) return;
    setSendingReply(true);
    try {
      const { data: replyData } = await adminApi.tickets.reply(id, replyBody.trim());
      setTicket((prev) => prev ? {
        ...prev,
        replies: [...prev.replies, replyData.reply],
        assignedTo: replyData.assignedTo ?? prev.assignedTo,
        status: replyData.status ?? prev.status,
      } : prev);
      setReplyBody('');
      toast('Reply sent', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to send reply', 'error');
    } finally {
      setSendingReply(false);
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !noteBody.trim()) return;
    setAddingNote(true);
    try {
      const { data: newNote } = await adminApi.tickets.addNote(id, noteBody.trim());
      setTicket((prev) => prev ? { ...prev, internalNotes: [...prev.internalNotes, newNote] } : prev);
      setNoteBody('');
      toast('Note added', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to add note', 'error');
    } finally {
      setAddingNote(false);
    }
  }

  async function handleRunTriage() {
    if (!ticket) return;
    setAiRunning(true);
    setAiError(null);
    try {
      const { data } = await adminApi.ai.triage({
        ticketId:        ticket._id,
        subject:         ticket.title,
        message:         ticket.description,
        productTitle:    ticket.product?.name,
        productCategory: ticket.product?.category,
      });
      setAiResult(data);
      toast('AI triage complete', 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI triage failed';
      setAiError(msg);
      toast(msg, 'error');
    } finally {
      setAiRunning(false);
    }
  }

  async function handleSuggestReply(goal?: string) {
    if (!ticket) return;
    setSuggesting(true);
    const conversationHistory = ticket.replies.map((r) => ({
      role: r.isAgent ? 'agent' as const : 'customer' as const,
      body: r.body,
    }));
    try {
      const { data } = await adminApi.ai.suggestReply({
        subject:             ticket.title,
        message:             ticket.description,
        productTitle:        ticket.product?.name,
        productCategory:     ticket.product?.category,
        productDescription:  ticket.product?.description ?? undefined,
        summary:             ticket.aiSummary ?? undefined,
        agentDraft:          replyBody.trim() || undefined,
        goal,
        conversationHistory: conversationHistory.length ? conversationHistory : undefined,
      });
      setSuggestResult(data);
      setReplyBody(data.suggestedReply);
      toast('Reply suggestion ready', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to suggest reply', 'error');
    } finally {
      setSuggesting(false);
    }
  }

  async function handleSendAiReply() {
    if (!id || !suggestResult?.suggestedReply) return;
    setSendingReply(true);
    try {
      const { data: replyData } = await adminApi.tickets.reply(id, suggestResult.suggestedReply);
      setTicket((prev) => prev ? {
        ...prev,
        replies: [...prev.replies, replyData.reply],
        assignedTo: replyData.assignedTo ?? prev.assignedTo,
        status: replyData.status ?? prev.status,
      } : prev);
      setReplyBody('');
      setSuggestResult(null);
      toast('AI reply sent', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to send reply', 'error');
    } finally {
      setSendingReply(false);
    }
  }

  if (loading) return <TicketDetailSkeleton />;

  if (error || !ticket) {
    return (
      <div className="flex flex-col items-center py-20 text-center">
        <p className="text-sm text-red-400">{error ?? 'Ticket not found'}</p>
        <button onClick={() => void fetchAll()} className="mt-3 text-xs text-olive-400 hover:underline">Retry</button>
      </div>
    );
  }

  // Build merged thread sorted by date
  const thread: ThreadItem[] = [
    ...ticket.replies.map((r): ThreadItem => ({ kind: 'reply', data: r })),
    ...ticket.internalNotes.map((n): ThreadItem => ({ kind: 'note', data: n })),
  ].sort((a, b) =>
    new Date(a.data.createdAt).getTime() - new Date(b.data.createdAt).getTime()
  );

  let replyIdx = 0;

  return (
    <div>
      <Link to="/admin/tickets" className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 transition hover:text-zinc-300">
        ← Back to Queue
      </Link>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* ── Left: ticket + thread ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className={`h-1 ${ticket.status === 'resolved' ? 'bg-violet-500' : ticket.status === 'in_progress' ? 'bg-sky-500' : 'bg-olive-500'}`} />
            <div className="p-6">
              {(() => {
                const parsed = parseTitle(ticket.title);
                const productName = ticket.product?.name ?? parsed.productName;
                const palette = productName ? productPalette(productName) : null;
                return (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {productName && palette && (
                    <div className="mb-1.5">
                      {ticket.product
                        ? <ProductThumbnail product={ticket.product} />
                        : <span className={`inline-flex items-center gap-2 rounded-lg border bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold ${palette.border} ${palette.text}`}>
                            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold ${palette.bg} ${palette.text}`}>
                              {productName[0]?.toUpperCase()}
                            </span>
                            {productName}
                          </span>
                      }
                    </div>
                  )}
                  <h1 className="text-lg font-bold text-zinc-100 sm:text-xl">{parsed.title}</h1>
                </div>
                <div className="flex gap-2">
                  <StatusBadge status={ticket.status} />
                  <PriorityBadge priority={ticket.aiPriority ?? null} aiAssessed={!!ticket.aiTriagedAt} />
                </div>
              </div>
                ); })()}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
                <span>From <span className="text-zinc-400">{ticket.authorName}</span></span>
                <span>{ticket.authorEmail}</span>
                <span>Opened {formatDate(ticket.createdAt)}</span>
                <span className="text-zinc-700">{formatAge(ticket.createdAt)}</span>
              </div>
              <div className="mt-5 border-t border-zinc-800 pt-5">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{ticket.description}</p>
              </div>
              <AttachmentGallery attachments={ticket.attachments} title="Customer Images" />
            </div>
          </div>

          {/* Thread */}
          <div>
            {thread.length === 0 && !aiTyping ? (
              <p className="text-center text-xs text-zinc-700 py-6">No replies or notes yet.</p>
            ) : (
              <div className="space-y-4">
                {thread.map((item) => {
                  if (item.kind === 'reply') {
                    const idx = replyIdx++;
                    return <ReplyBubble key={item.data._id} reply={item.data} index={idx} />;
                  }
                  return <NoteBubble key={item.data._id} note={item.data} />;
                })}
                {aiTyping && <AiTypingBubble />}
              </div>
            )}
          </div>

          {/* Agent Reply */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-olive-600">Reply to Customer</p>
                <button
                  type="button"
                  onClick={() => setGoalModalOpen(true)}
                  disabled={suggesting}
                  className="flex items-center gap-1.5 rounded border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-400 transition hover:bg-violet-500/20 disabled:opacity-40"
                >
                  <span>{suggesting ? '⟳' : '✦'}</span>
                  {suggesting ? 'Analysing…' : replyBody.trim() ? 'Improve my answer' : 'Suggest Reply'}
                </button>
              </div>
              <form onSubmit={(e) => void handleReply(e)}>
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={4}
                  placeholder="Type your response to the customer…"
                  className={textareaCls}
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  {suggestResult ? (
                    suggestResult.autoReplyEligible ? (
                      <button
                        type="button"
                        onClick={() => void handleSendAiReply()}
                        disabled={sendingReply}
                        className="flex items-center gap-1.5 rounded border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-sky-400 transition hover:bg-sky-500/20 disabled:opacity-40"
                      >
                        ✦ Send AI Reply
                      </button>
                    ) : (
                      <span className="flex items-center gap-1.5 rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-amber-500">
                        ⚠ Human review required
                      </span>
                    )
                  ) : <span />}
                  <button
                    type="submit"
                    disabled={sendingReply || !replyBody.trim()}
                    className="rounded border border-olive-500/40 bg-olive-500/15 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-olive-400 transition hover:bg-olive-500/25 disabled:opacity-40"
                  >
                    {sendingReply ? 'Sending…' : 'Send Reply'}
                  </button>
                </div>
              </form>
          </div>

          {/* Internal Note */}
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-5">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-amber-600">Internal Note</p>
            <form onSubmit={(e) => void handleAddNote(e)}>
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                rows={noteBody ? 3 : 1}
                placeholder="Visible to agents only — not shown to customer…"
                className="block w-full rounded-lg border border-amber-500/20 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-none transition-all"
              />
              {noteBody && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={addingNote || !noteBody.trim()}
                    className="rounded border border-amber-500/30 bg-amber-500/10 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-amber-400 transition hover:bg-amber-500/20 disabled:opacity-40"
                  >
                    {addingNote ? 'Adding…' : 'Add Note'}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* ── Right: management panel ── */}
        <div className="space-y-4 md:sticky md:top-4 md:self-start">
          {/* Status */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">Status</p>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  disabled={updatingStatus || ticket.status === opt.value}
                  onClick={() => void handleStatusChange(opt.value)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                    ticket.status === opt.value
                      ? opt.activeCls
                      : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300 disabled:opacity-40'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">Priority</p>
            <div className="grid grid-cols-2 gap-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  disabled={updatingPriority || ticket.aiPriority === opt.value}
                  onClick={() => void handlePriorityChange(opt.value)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                    ticket.aiPriority === opt.value
                      ? opt.activeCls
                      : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300 disabled:opacity-40'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Assign */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">Assigned To</p>
              <div className="flex items-center gap-1.5">
                {currentAgentId && ticket.assignedTo?._id !== currentAgentId && (
                  <button
                    onClick={() => void handleAssign(currentAgentId)}
                    disabled={assigning}
                    className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-400 transition hover:border-olive-500/40 hover:text-olive-300 disabled:opacity-40"
                  >
                    Assign myself
                  </button>
                )}
                {(() => {
                  const aiAgent = agents.find((a) => a.isAiAgent);
                  if (!aiAgent || ticket.assignedTo?._id === aiAgent._id) return null;
                  return (
                    <button
                      onClick={() => {
                        setPendingAgentId(aiAgent._id);
                      }}
                      disabled={assigning}
                      className="rounded border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[10px] font-semibold text-violet-400 transition hover:bg-violet-500/15 disabled:opacity-40"
                    >
                      ✦ Assign AI
                    </button>
                  );
                })()}
              </div>
            </div>
            <select
              value={pendingAgentId ?? ticket.assignedTo?._id ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                const isAi = agents.find((a) => a._id === val)?.isAiAgent;
                if (isAi) {
                  setPendingAgentId(val);
                } else {
                  setPendingAgentId(null);
                  void handleAssign(val);
                }
              }}
              disabled={assigning}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-olive-500/30 disabled:opacity-50"
            >
              <option value="">— Unassigned —</option>
              {agents.filter((a) => a.isAiAgent).map((a) => (
                <option key={a._id} value={a._id}>✦ {a.name} — Autonomous Handling</option>
              ))}
              {agents.filter((a) => !a.isAiAgent).map((a) => (
                <option key={a._id} value={a._id}>{a.name}{a._id === currentAgentId ? ' (you)' : ''}</option>
              ))}
            </select>

            {pendingAgentId && (
              <div className="mt-3 rounded-lg border border-violet-500/25 bg-violet-500/5 p-3">
                <p className="text-[11px] text-violet-300">
                  The AI Agent will autonomously manage this ticket end-to-end — handling replies, assessing each customer response, and escalating to you if human expertise is required. Confirm?
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => { void handleAssign(pendingAgentId); setPendingAgentId(null); }}
                    disabled={assigning}
                    className="rounded border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-400 transition hover:bg-violet-500/25 disabled:opacity-40"
                  >
                    ✦ Confirm
                  </button>
                  <button
                    onClick={() => setPendingAgentId(null)}
                    className="rounded border border-zinc-700 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 transition hover:text-zinc-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!pendingAgentId && ticket.assignedTo && agents.find((a) => a._id === ticket.assignedTo?._id)?.isAiAgent && (
              <div className="mt-2 flex flex-col gap-1">
                {ticket.aiAutoAssigned ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
                    ✦ Auto-assigned by AI
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
                    Manually assigned to AI
                  </span>
                )}
                <p className="text-[10px] text-zinc-600">AI Agent handles the full conversation autonomously</p>
              </div>
            )}

            {ticket.aiEscalated && (
              <div className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5">
                <p className="text-[10px] font-semibold text-amber-400">⚠ Escalated by AI Agent</p>
                <p className="mt-0.5 text-[10px] text-zinc-500">The AI determined this ticket requires human expertise and has reassigned it. See the internal notes for the reason.</p>
              </div>
            )}
          </div>

          {/* AI Insights */}
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-500">AI Insights</p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCoachOpen(true)}
                  className="flex items-center gap-1 rounded border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-400 transition hover:bg-violet-500/20"
                >
                  ✦ AI Advisor
                </button>
                <button
                  onClick={() => void handleRunTriage()}
                  disabled={aiRunning}
                  className="rounded border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-400 transition hover:bg-violet-500/20 disabled:opacity-40"
                >
                  {aiRunning ? 'Analysing…' : aiResult ? 'Refresh' : 'Run Triage'}
                </button>
              </div>
            </div>

            {aiError && !aiResult && (
              <p className="text-xs text-red-400">{aiError}</p>
            )}

            {(suggesting || aiRunning) && !suggestResult && !aiResult && (
              <div className="space-y-2 animate-pulse">
                <div className="h-3 w-full rounded bg-zinc-800" />
                <div className="h-3 w-4/5 rounded bg-zinc-800" />
                <div className="h-3 w-2/3 rounded bg-zinc-800" />
              </div>
            )}

            {!suggestResult && !aiResult && !aiRunning && !suggesting && !aiError && (
              <p className="text-xs text-zinc-600">Use "Suggest Reply" or "Run Triage" to analyse this ticket.</p>
            )}

            {/* Suggest Reply result — shown when available, takes precedence */}
            {suggestResult && (
              <div className="space-y-3 text-xs">
                <p className="leading-relaxed text-zinc-300">{suggestResult.summary}</p>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    suggestResult.priority === 'high'   ? 'border-red-500/30 bg-red-500/10 text-red-400' :
                    suggestResult.priority === 'medium' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' :
                                                          'border-sky-500/30 bg-sky-500/10 text-sky-400'
                  }`}>{suggestResult.priority}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    suggestResult.riskLevel === 'high'   ? 'border-red-500/30 bg-red-500/10 text-red-400' :
                    suggestResult.riskLevel === 'medium' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' :
                                                           'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  }`}>{suggestResult.riskLevel} risk</span>
                </div>

                {/* Confidence bar */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Confidence</span>
                    <span className="text-[10px] text-zinc-500">{Math.round(suggestResult.confidence * 100)}%</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-zinc-800">
                    <div
                      className={`h-1 rounded-full transition-all ${suggestResult.confidence >= 0.8 ? 'bg-emerald-500' : suggestResult.confidence >= 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.round(suggestResult.confidence * 100)}%` }}
                    />
                  </div>
                </div>

                {suggestResult.reason && (
                  <p className="leading-relaxed text-zinc-500 italic">{suggestResult.reason}</p>
                )}

                {suggestResult.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {suggestResult.tags.map((tag) => (
                      <span key={tag} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500 whitespace-nowrap">{tag.replace(/\n/g, ' ').trim()}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Triage-only result — shown when no suggest result yet */}
            {aiResult && !suggestResult && (
              <div className="space-y-3 text-xs">
                <p className="leading-relaxed text-zinc-300">{aiResult.summary}</p>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-600">Priority</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    aiResult.priority === 'high'   ? 'border-red-500/30 bg-red-500/10 text-red-400' :
                    aiResult.priority === 'medium' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' :
                                                     'border-zinc-700 bg-zinc-800 text-zinc-400'
                  }`}>{aiResult.priority}</span>
                </div>
                {aiResult.suggestedNextStep && (
                  <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Next Step Suggestion</p>
                    <p className="leading-relaxed text-zinc-400">{aiResult.suggestedNextStep}</p>
                  </div>
                )}
                {aiResult.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {aiResult.tags.map((tag) => (
                      <span key={tag} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500 whitespace-nowrap">{tag.replace(/\n/g, ' ').trim()}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Marketing Tools */}
          <MarketingPanel
            ticket={ticket}
            onAppendToReply={(text) => setReplyBody((prev) => prev + text)}
            onProfileChange={setCoachProfile}
          />

          {/* Metadata */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">Details</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-600">Customer</span>
                <span className="text-zinc-300">{ticket.authorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Email</span>
                <span className="truncate max-w-[60%] text-right text-zinc-400">{ticket.authorEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Created</span>
                <span className="text-zinc-400">{formatAge(ticket.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Replies</span>
                <span className="text-zinc-400">{ticket.replies.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Images</span>
                <span className="text-zinc-400">{ticket.attachments.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Notes</span>
                <span className="text-zinc-400">{ticket.internalNotes.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CoachSlideOver
        open={coachOpen}
        onClose={() => setCoachOpen(false)}
        ticket={ticket}
        profile={coachProfile}
        onUseInReply={(text) => setReplyBody((prev) => prev ? prev + '\n\n' + text : text)}
      />
      <ReplyGoalModal
        open={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        hasTyped={!!replyBody.trim()}
        onSelect={(goal) => { void handleSuggestReply(goal); }}
      />
    </div>
  );
}
