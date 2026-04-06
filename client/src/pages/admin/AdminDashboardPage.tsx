import { useEffect, useState, useCallback, useRef } from 'react';

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
function parseTitle(raw: string): { productName: string | null; title: string } {
  const m = raw.match(/^\[(.+?)\]\s*(.+)$/);
  if (m) return { productName: m[1], title: m[2] };
  return { productName: null, title: raw };
}

function productPalette(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return PRODUCT_PALETTES[h % PRODUCT_PALETTES.length];
}
import { Link } from 'react-router-dom';
import { adminApi, getStoredAgent } from '../../services/adminApi';
import type { AdminTicketSummary, AdminStats, Agent } from '../../types/admin';
import type { TicketStatus, TicketPriority } from '../../types/ticket';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import { TicketCardSkeleton } from '../../components/Skeleton';

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function formatAge(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type StatusFilter   = TicketStatus | 'all' | 'unresolved';
type PriorityFilter = TicketPriority | 'all';

export type SortKey =
  | 'date'
  | 'ai_priority'
  | 'ticket_value'
  | 'refund_risk'
  | 'churn_risk'
  | 'sentiment'
  | 'lifetime_value'
  | 'archetype';

const SORT_OPTIONS: { key: SortKey; label: string; group: 'standard' | 'marketing' }[] = [
  { key: 'date',          label: 'Date',                group: 'standard'  },
  { key: 'ai_priority',   label: 'Priority',            group: 'standard'  },
  { key: 'ticket_value',  label: 'Ticket Value',        group: 'standard'  },
  { key: 'refund_risk',   label: 'Refund Risk',         group: 'marketing' },
  { key: 'churn_risk',    label: 'Churn Risk',          group: 'marketing' },
  { key: 'sentiment',     label: 'Customer Sentiment',  group: 'marketing' },
  { key: 'lifetime_value',label: 'Lifetime Value',      group: 'marketing' },
  { key: 'archetype',     label: 'Customer Archetype',  group: 'marketing' },
];

function ClassByDropdown({ value, onChange }: { value: SortKey; onChange: (k: SortKey) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const activeLabel = SORT_OPTIONS.find((o) => o.key === value)?.label ?? 'Date';
  const standard  = SORT_OPTIONS.filter((o) => o.group === 'standard');
  const marketing = SORT_OPTIONS.filter((o) => o.group === 'marketing');

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-300"
      >
        <span className="text-zinc-600">Sort by:</span>
        <span className={`font-semibold ${marketing.some((o) => o.key === value) ? 'text-rose-400' : 'text-zinc-300'}`}>
          {activeLabel}
        </span>
        <svg viewBox="0 0 12 12" fill="none" className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-60 rounded-xl border border-zinc-800 bg-zinc-950 py-1.5 shadow-2xl">
          {/* Standard group */}
          <p className="px-4 pb-1 pt-1.5 text-[9px] font-semibold uppercase tracking-widest text-zinc-700">Standard</p>
          {standard.map((item) => (
            <button
              key={item.key}
              onClick={() => { onChange(item.key); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 px-4 py-2 text-xs transition hover:bg-zinc-800 ${
                value === item.key ? 'font-semibold text-olive-400' : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {value === item.key && <span className="text-[8px]">●</span>}
              {value !== item.key && <span className="text-[8px] opacity-0">●</span>}
              {item.label}
            </button>
          ))}

          <div className="mx-3 my-1.5 border-t border-zinc-800" />

          {/* Marketing group */}
          <p className="px-4 pb-1 pt-0.5 text-[9px] font-semibold uppercase tracking-widest text-rose-500/70">
            Marketing Intelligence
          </p>
          {marketing.map((item) => (
            <button
              key={item.key}
              onClick={() => { onChange(item.key); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 px-4 py-2 text-xs transition hover:bg-zinc-800 ${
                value === item.key ? 'font-semibold text-rose-400' : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              {value === item.key && <span className="text-rose-500 text-[8px]">●</span>}
              {value !== item.key && <span className="text-[8px] opacity-0">●</span>}
              {item.label}
            </button>
          ))}

          {/* Footer hint */}
          <div className="mx-3 my-1.5 border-t border-zinc-800" />
          <p className="px-4 py-1.5 text-[9px] text-zinc-700">
            Marketing sorts use AI Intelligence data. Unanalyzed tickets appear last.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Marketing intelligence badge shown in ticket rows when a mkt sort is active ──
const RISK_COLOR: Record<string, string> = {
  high:   'border-red-500/30 bg-red-500/10 text-red-400',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  low:    'border-green-500/30 bg-green-500/10 text-green-400',
};
const SENTIMENT_COLOR: Record<string, string> = {
  hostile:   'border-red-500/30 bg-red-500/10 text-red-400',
  frustrated:'border-orange-500/30 bg-orange-500/10 text-orange-400',
  neutral:   'border-zinc-700 bg-zinc-800 text-zinc-400',
  positive:  'border-green-500/30 bg-green-500/10 text-green-400',
};
const LTV_COLOR: Record<string, string> = {
  high:   'border-olive-500/30 bg-olive-500/10 text-olive-400',
  medium: 'border-zinc-700 bg-zinc-800 text-zinc-400',
  low:    'border-red-500/30 bg-red-500/10 text-red-400',
};

function MktBadge({ ticket, sortBy }: { ticket: AdminTicketSummary; sortBy: SortKey }) {
  let label = '';
  let cls = 'border-zinc-700 bg-zinc-800/60 text-zinc-600';

  switch (sortBy) {
    case 'refund_risk':
      if (!ticket.mktRefundIntent) { label = 'Not analyzed'; break; }
      label = `${ticket.mktRefundIntent.charAt(0).toUpperCase() + ticket.mktRefundIntent.slice(1)} refund risk`;
      cls = RISK_COLOR[ticket.mktRefundIntent] ?? cls;
      break;
    case 'churn_risk':
      if (!ticket.mktChurnRisk) { label = 'Not analyzed'; break; }
      label = `${ticket.mktChurnRisk.charAt(0).toUpperCase() + ticket.mktChurnRisk.slice(1)} churn risk`;
      cls = RISK_COLOR[ticket.mktChurnRisk] ?? cls;
      break;
    case 'sentiment':
      if (!ticket.mktSentiment) { label = 'Not analyzed'; break; }
      label = ticket.mktSentiment.charAt(0).toUpperCase() + ticket.mktSentiment.slice(1);
      cls = SENTIMENT_COLOR[ticket.mktSentiment] ?? cls;
      break;
    case 'lifetime_value':
      if (!ticket.mktLifetimeValueSignal) { label = 'Not analyzed'; break; }
      label = `${ticket.mktLifetimeValueSignal.charAt(0).toUpperCase() + ticket.mktLifetimeValueSignal.slice(1)} LTV`;
      cls = LTV_COLOR[ticket.mktLifetimeValueSignal] ?? cls;
      break;
    case 'archetype':
      if (!ticket.mktArchetypeLabel) { label = 'Not analyzed'; break; }
      label = ticket.mktArchetypeLabel;
      cls = 'border-violet-500/30 bg-violet-500/10 text-violet-400';
      break;
    case 'ticket_value':
      if (!ticket.product?.price) { label = 'No product'; break; }
      label = `$${ticket.product.price}`;
      cls = 'border-olive-500/30 bg-olive-500/10 text-olive-400';
      break;
  }

  if (!label) return null;
  return (
    <span className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

const STATUS_OPTS: { label: string; value: StatusFilter }[] = [
  { label: 'All',         value: 'all'         },
  { label: 'Pending',     value: 'unresolved'  },
  { label: 'New',         value: 'new'         },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved',    value: 'resolved'    },
];

export default function AdminDashboardPage() {
  const currentAgentId = getStoredAgent()?._id;
  const [tickets, setTickets]   = useState<AdminTicketSummary[]>([]);
  const [stats,   setStats]     = useState<AdminStats | null>(null);
  const [agents,  setAgents]    = useState<Agent[]>([]);
  const [allTags, setAllTags]   = useState<string[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState<string | null>(null);

  const [status,     setStatus]     = useState<StatusFilter>('unresolved');
  const [priority,   setPriority]   = useState<PriorityFilter>('all');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [activeTag,  setActiveTag]  = useState<string>('');
  const [sortBy,     setSortBy]     = useState<SortKey>('date');
  const [showMktCols, setShowMktCols] = useState(false);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total,      setTotal]      = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ticketRes, statsRes, agentsRes, tagsRes] = await Promise.all([
        adminApi.tickets.list({ status, priority, assignedTo: assignedTo || undefined, tag: activeTag || undefined, page, limit: 15 }),
        stats === null ? adminApi.stats() : Promise.resolve(null),
        agents.length === 0 ? adminApi.agents() : Promise.resolve(null),
        allTags.length === 0 ? adminApi.tags() : Promise.resolve(null),
      ]);
      setTickets(ticketRes.data);
      setTotalPages(ticketRes.meta.pages);
      setTotal(ticketRes.meta.total);
      if (statsRes)  setStats(statsRes.data);
      if (agentsRes) setAgents(agentsRes.data);
      if (tagsRes)   setAllTags(tagsRes.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, priority, assignedTo, activeTag, page]);

  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [status, priority, assignedTo, activeTag]);


  // Client-side sort (operates on the current page of results)
  const RISK_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const SENTIMENT_ORDER: Record<string, number> = { hostile: 0, frustrated: 1, neutral: 2, positive: 3 };
  const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2, irrelevant: 3 };

  const sortedTickets = [...tickets].sort((a, b) => {
    const nullLast = (v: string | null | undefined) => v == null ? 1 : 0;
    switch (sortBy) {
      case 'refund_risk':
        if (!a.mktRefundIntent && !b.mktRefundIntent) return 0;
        if (!a.mktRefundIntent) return 1;
        if (!b.mktRefundIntent) return -1;
        return (RISK_ORDER[a.mktRefundIntent] ?? 9) - (RISK_ORDER[b.mktRefundIntent] ?? 9);
      case 'churn_risk':
        if (!a.mktChurnRisk && !b.mktChurnRisk) return 0;
        if (!a.mktChurnRisk) return 1;
        if (!b.mktChurnRisk) return -1;
        return (RISK_ORDER[a.mktChurnRisk] ?? 9) - (RISK_ORDER[b.mktChurnRisk] ?? 9);
      case 'sentiment':
        if (!a.mktSentiment && !b.mktSentiment) return 0;
        if (!a.mktSentiment) return 1;
        if (!b.mktSentiment) return -1;
        return (SENTIMENT_ORDER[a.mktSentiment] ?? 9) - (SENTIMENT_ORDER[b.mktSentiment] ?? 9);
      case 'lifetime_value':
        if (!a.mktLifetimeValueSignal && !b.mktLifetimeValueSignal) return 0;
        if (!a.mktLifetimeValueSignal) return 1;
        if (!b.mktLifetimeValueSignal) return -1;
        // Lifetime value: high first (most valuable customers need attention)
        return (RISK_ORDER[a.mktLifetimeValueSignal] ?? 9) - (RISK_ORDER[b.mktLifetimeValueSignal] ?? 9);
      case 'archetype':
        if (nullLast(a.mktArchetypeLabel) !== nullLast(b.mktArchetypeLabel))
          return nullLast(a.mktArchetypeLabel) - nullLast(b.mktArchetypeLabel);
        return (a.mktArchetypeLabel ?? '').localeCompare(b.mktArchetypeLabel ?? '');
      case 'ticket_value':
        return (b.product?.price ?? 0) - (a.product?.price ?? 0);
      case 'ai_priority':
        return (PRIORITY_ORDER[a.aiPriority ?? ''] ?? 9) - (PRIORITY_ORDER[b.aiPriority ?? ''] ?? 9);
      default: // 'date'
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  const isMarketingSort = ['refund_risk', 'churn_risk', 'sentiment', 'lifetime_value', 'archetype', 'ticket_value'].includes(sortBy);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Support Workspace</p>
          <h1 className="text-xl font-bold text-zinc-100 sm:text-2xl">Ticket Queue</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {loading ? '\u00A0' : `${total} request${total !== 1 ? 's' : ''} in queue`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => void fetchData()} className="rounded border border-zinc-800 px-3 py-2 text-xs font-medium text-zinc-500 transition hover:text-zinc-300">
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total"       value={stats.total}       color="text-zinc-100" />
          <StatCard label="New"         value={stats.new}         color="text-olive-400" />
          <StatCard label="In Progress" value={stats.in_progress} color="text-sky-400" />
          <StatCard label="Resolved"    value={stats.resolved}    color="text-violet-400" />
          <StatCard label="Unassigned"  value={stats.unassigned}  color="text-red-400" />
        </div>
      )}

      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-2">
        {/* Status tabs */}
        <div className="flex overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 p-1 scrollbar-none">
          {STATUS_OPTS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                status === opt.value
                  ? 'bg-olive-500/20 text-olive-400 ring-1 ring-olive-500/30'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Priority */}
        <select
          value={priority}
          onChange={(e) => {
            const val = e.target.value as PriorityFilter;
            setPriority(val);
            if (val === 'irrelevant') setStatus('resolved');
          }}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 focus:outline-none focus:ring-2 focus:ring-olive-500/30"
        >
          <option value="all">All priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="irrelevant">Irrelevant</option>
        </select>

        {/* Agent filter */}
        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-400 focus:outline-none focus:ring-2 focus:ring-olive-500/30"
        >
          <option value="">All agents</option>
          <option value="unassigned">Unassigned</option>
          {agents.map((a) => (
            <option key={a._id} value={a._id}>{a.name}</option>
          ))}
        </select>

        <ClassByDropdown value={sortBy} onChange={setSortBy} />

        <button
          onClick={() => setShowMktCols((v) => !v)}
          title={showMktCols ? 'Hide marketing intelligence columns' : 'Show marketing intelligence columns'}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition ${
            showMktCols
              ? 'border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/15'
              : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
          }`}
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
            <path d="M1 10s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
            {!showMktCols && <line x1="3" y1="3" x2="17" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>}
          </svg>
          <span className="hidden sm:inline">{showMktCols ? 'Hide intel' : 'Show intel'}</span>
        </button>
      </div>

      <div className="mb-5 h-px bg-zinc-800" />

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <span>{error}</span>
          <button onClick={() => void fetchData()} className="ml-auto text-xs underline">Retry</button>
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 8 }).map((_, i) => <TicketCardSkeleton key={i} />)}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && tickets.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-20 text-center">
          <p className="text-sm text-zinc-500">No tickets found</p>
          <button onClick={() => { setStatus('all'); setPriority('all'); setAssignedTo(''); setActiveTag(''); }} className="mt-2 text-xs text-olive-400 hover:underline">
            Clear filters
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && tickets.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                    Ticket
                    {isMarketingSort && (
                      <span className="ml-2 rounded-full border border-rose-500/25 bg-rose-500/10 px-1.5 py-0.5 text-[8px] font-semibold text-rose-400">
                        ↑ {SORT_OPTIONS.find((o) => o.key === sortBy)?.label}
                      </span>
                    )}
                  </th>
                  <th className="hidden px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-600 sm:table-cell">Status</th>
                  <th className="hidden px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-600 sm:table-cell">Priority</th>
                  <th className="hidden px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-600 md:table-cell">Assigned</th>
                  <th className="hidden px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-600 lg:table-cell">Age</th>
                  {showMktCols && <>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-rose-500/60">Value</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-rose-500/60">Sentiment</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-rose-500/60">Refund Risk</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-rose-500/60">Archetype</th>
                  </>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {sortedTickets.map((ticket) => (
                  <tr key={ticket._id} className="group bg-zinc-900 transition hover:bg-zinc-800/60">
                    <td className="px-4 py-3.5">
                      {(() => {
                        const parsed = parseTitle(ticket.title);
                        const productName = ticket.product?.name ?? parsed.productName;
                        const price = ticket.product?.price;
                        const pp = productName ? productPalette(productName) : null;
                        return (
                          <Link to={`/admin/tickets/${ticket._id}`} className="block">
                            {/* Product name — uniform colour, category chip alongside */}
                            {productName && (
                              <div className="mb-1 flex items-center gap-1.5 flex-wrap">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                  {productName}{price != null ? ` · $${price}` : ''}
                                </p>
                                {ticket.product?.category && (
                                  <span className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide text-zinc-500">
                                    {ticket.product.category}
                                  </span>
                                )}
                              </div>
                            )}
                            {/* Thumbnail + title row */}
                            <div className="flex items-center gap-3">
                              {ticket.product?.imageUrl ? (
                                <img
                                  src={ticket.product.imageUrl}
                                  alt={ticket.product.name}
                                  className="hidden h-9 w-9 shrink-0 rounded-md object-cover sm:block"
                                />
                              ) : ticket.product ? (
                                <div className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-md border text-xs font-bold sm:flex ${pp?.bg} ${pp?.text} ${pp?.border}`}>
                                  {ticket.product.name[0]?.toUpperCase()}
                                </div>
                              ) : null}
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-zinc-200 group-hover:text-white line-clamp-1">{parsed.title}</p>
                                {/* Status + priority inline on mobile */}
                                <div className="mt-1 flex items-center gap-1.5 sm:hidden">
                                  <StatusBadge status={ticket.status} />
                                  <PriorityBadge priority={ticket.aiPriority ?? null} aiAssessed={!!ticket.aiTriagedAt} />
                                </div>
                                <p className="mt-0.5 text-xs text-zinc-600">{ticket.authorName} · {ticket.authorEmail}</p>
                                {ticket.description && (
                                  <p className="mt-1 text-[11px] leading-snug text-zinc-600 line-clamp-2">
                                    {ticket.description}
                                  </p>
                                )}
                                {isMarketingSort && !showMktCols && <MktBadge ticket={ticket} sortBy={sortBy} />}
                              </div>
                            </div>
                          </Link>
                        );
                      })()}
                    </td>
                    <td className="hidden px-4 py-3.5 sm:table-cell"><StatusBadge status={ticket.status} /></td>
                    <td className="hidden px-4 py-3.5 sm:table-cell"><PriorityBadge priority={ticket.aiPriority ?? null} aiAssessed={!!ticket.aiTriagedAt} /></td>
                    <td className="hidden px-4 py-3.5 md:table-cell">
                      {ticket.assignedTo ? (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                            {ticket.assignedTo.isAiAgent ? (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/20 text-[10px] font-bold text-violet-400">✦</span>
                            ) : ticket.assignedTo.avatarUrl ? (
                              <img src={ticket.assignedTo.avatarUrl} alt={ticket.assignedTo.name} className="h-5 w-5 rounded-full object-cover" />
                            ) : (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-[10px] font-bold text-zinc-300">
                                {ticket.assignedTo.name[0]?.toUpperCase()}
                              </span>
                            )}
                            {ticket.assignedTo.name}{ticket.assignedTo._id === currentAgentId ? <span className="ml-1 text-zinc-600">(you)</span> : null}
                          </span>
                          {ticket.assignedTo.isAiAgent && ticket.aiAutoAssigned && (
                            <span className="inline-flex w-fit items-center gap-1 rounded-full border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-violet-400">
                              ✦ auto-assigned
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-700">Unassigned</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3.5 text-xs text-zinc-600 lg:table-cell">
                      {formatAge(ticket.createdAt)}
                    </td>
                    {showMktCols && <>
                      <td className="px-4 py-3.5 text-xs">
                        {ticket.product?.price != null
                          ? <span className="font-semibold text-olive-400">${ticket.product.price}</span>
                          : <span className="text-zinc-700">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {ticket.mktSentiment
                          ? <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold ${SENTIMENT_COLOR[ticket.mktSentiment] ?? 'border-zinc-700 bg-zinc-800 text-zinc-400'}`}>
                              {ticket.mktSentiment.charAt(0).toUpperCase() + ticket.mktSentiment.slice(1)}
                            </span>
                          : <span className="text-[9px] text-zinc-700">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {ticket.mktRefundIntent
                          ? <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold ${RISK_COLOR[ticket.mktRefundIntent] ?? 'border-zinc-700 bg-zinc-800 text-zinc-400'}`}>
                              {ticket.mktRefundIntent.charAt(0).toUpperCase() + ticket.mktRefundIntent.slice(1)}
                            </span>
                          : <span className="text-[9px] text-zinc-700">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {ticket.mktArchetypeLabel
                          ? <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[9px] font-semibold leading-none text-violet-400">
                              {ticket.mktArchetypeLabel}
                            </span>
                          : <span className="text-[9px] text-zinc-700">—</span>}
                      </td>
                    </>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
                className="rounded border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-400 transition hover:text-zinc-200 disabled:opacity-30"
              >
                ← Prev
              </button>
              <span className="text-xs text-zinc-600">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="rounded border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-400 transition hover:text-zinc-200 disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
