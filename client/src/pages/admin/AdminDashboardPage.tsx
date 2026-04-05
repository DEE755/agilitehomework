import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../services/adminApi';
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

const STATUS_OPTS: { label: string; value: StatusFilter }[] = [
  { label: 'All',         value: 'all'         },
  { label: 'Pending',     value: 'unresolved'  },
  { label: 'New',         value: 'new'         },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved',    value: 'resolved'    },
];

export default function AdminDashboardPage() {
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


  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Support Workspace</p>
          <h1 className="text-2xl font-bold text-zinc-100">Ticket Queue</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {loading ? '\u00A0' : `${total} customer request${total !== 1 ? 's' : ''} in the queue`}
          </p>
        </div>
        <button onClick={() => void fetchData()} className="rounded border border-zinc-800 px-3 py-2 text-xs font-medium text-zinc-500 transition hover:text-zinc-300">
          ↻ Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:items-end">
          <StatCard label="Total"       value={stats.total}       color="text-zinc-100" />
          <StatCard label="New"         value={stats.new}         color="text-olive-400" />
          <StatCard label="In Progress" value={stats.in_progress} color="text-sky-400" />
          <StatCard label="Resolved"    value={stats.resolved}    color="text-violet-400" />
          <StatCard label="Unassigned"  value={stats.unassigned}  color="text-red-400" />
          <button
            disabled
            className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-5 py-4 text-left transition hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-500">AI Insights</p>
            <p className="mt-1 text-xs text-violet-400">View report →</p>
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-5 flex flex-wrap gap-2">
        {/* Status tabs */}
        <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-1">
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
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Ticket</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Priority</th>
                  <th className="hidden px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-600 sm:table-cell">Assigned</th>
                  <th className="hidden px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-600 lg:table-cell">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {tickets.map((ticket) => (
                  <tr key={ticket._id} className="group bg-zinc-900 transition hover:bg-zinc-800/60">
                    <td className="px-4 py-3.5">
                      <Link to={`/admin/tickets/${ticket._id}`} className="block">
                        <p className="font-medium text-zinc-200 group-hover:text-white line-clamp-1">{ticket.title}</p>
                        <p className="mt-0.5 text-xs text-zinc-600">{ticket.authorName} · {ticket.authorEmail}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={ticket.status} /></td>
                    <td className="px-4 py-3.5"><PriorityBadge priority={ticket.aiPriority ?? null} aiAssessed={!!ticket.aiTriagedAt} /></td>
                    <td className="hidden px-4 py-3.5 sm:table-cell">
                      {ticket.assignedTo ? (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${ticket.assignedTo.isAiAgent ? 'bg-violet-500/20 text-violet-400' : 'bg-zinc-700 text-zinc-300'}`}>
                              {ticket.assignedTo.isAiAgent ? '✦' : ticket.assignedTo.name[0]?.toUpperCase()}
                            </span>
                            {ticket.assignedTo.name}
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
