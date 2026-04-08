import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminApi, getStoredAgent } from '../../services/adminApi';
import { useToast } from '../../components/Toast';
import type { AdminTicket, Agent, AiTriageResult, AiSuggestReplyResult, CustomerProfileResult } from '../../types/admin';
import type { Reply, TicketStatus, TicketPriority } from '../../types/ticket';
import StatusBadge from '../../components/StatusBadge';
import PriorityBadge from '../../components/PriorityBadge';
import AttachmentGallery from '../../components/AttachmentGallery';
import { TicketDetailSkeleton } from '../../components/Skeleton';
import { formatDate, formatAge, parseTitle, productPalette } from '../../utils/formatting';
import { ReplyBubble, NoteBubble } from '../../components/admin/ticket/ThreadBubbles';
import AiTypingBubble from '../../components/admin/ticket/AiTypingBubble';
import { ProductThumbnail } from '../../components/admin/ticket/ProductViewer';
import MarketingPanel from '../../components/admin/ticket/MarketingPanel';
import CoachSlideOver from '../../components/admin/ticket/CoachSlideOver';
import type { InternalNote } from '../../types/admin';

// Merged thread item
type ThreadItem =
  | { kind: 'reply'; data: Reply }
  | { kind: 'note';  data: InternalNote };

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
                  {suggesting ? (
                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25"/>
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75"/>
                    </svg>
                  ) : (
                    <span>✦</span>
                  )}
                  {suggesting ? 'Generating…' : replyBody.trim() ? 'Improve my answer' : 'Suggest Reply'}
                </button>
              </div>
              <form onSubmit={(e) => void handleReply(e)}>
                <div className="relative">
                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    rows={4}
                    placeholder="Type your response to the customer…"
                    disabled={suggesting}
                    className={`${textareaCls} transition-opacity duration-200 ${suggesting ? 'opacity-30' : 'opacity-100'}`}
                  />
                  {suggesting && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg">
                      <div className="flex items-center gap-2 rounded-full border border-violet-500/40 bg-zinc-950/90 px-3.5 py-2 shadow-lg backdrop-blur-sm">
                        <svg className="h-3.5 w-3.5 animate-spin text-violet-400" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25"/>
                          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75"/>
                        </svg>
                        <span className="text-[11px] font-semibold text-violet-300">AI is crafting your reply…</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={sendingReply || !replyBody.trim() || suggesting}
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
