import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminApi } from '../../services/adminApi';
import { useToast } from '../../components/Toast';
import type { AdminTicket, Agent, InternalNote, AiTriageResult, AiSuggestReplyResult } from '../../types/admin';
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

// Merged thread item
type ThreadItem =
  | { kind: 'reply'; data: Reply }
  | { kind: 'note';  data: InternalNote };

function ReplyBubble({ reply, index }: { reply: Reply; index: number }) {
  const isAgent  = reply.isAgent;
  const isAiBot  = isAgent && reply.authorName === 'Agilite Support AI';

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

export default function AdminTicketDetailPage() {
  const { id }     = useParams<{ id: string }>();
  const { toast }  = useToast();

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
        priority:          ticket.aiPriority ?? 'medium',
        suggestedNextStep: ticket.aiSuggestedNextStep ?? '',
        tags:              ticket.aiTags ?? [],
      });
    }
  }, [ticket?.aiSummary]);


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
      const { data: newReply } = await adminApi.tickets.reply(id, replyBody.trim());
      setTicket((prev) => prev ? { ...prev, replies: [...prev.replies, newReply] } : prev);
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
        ticketId: ticket._id,
        subject:  ticket.title,
        message:  ticket.description,
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

  async function handleSuggestReply() {
    if (!ticket) return;
    setSuggesting(true);
    try {
      const { data } = await adminApi.ai.suggestReply({
        subject: ticket.title,
        message: ticket.description,
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
      const { data: newReply } = await adminApi.tickets.reply(id, suggestResult.suggestedReply);
      setTicket((prev) => prev ? { ...prev, replies: [...prev.replies, newReply] } : prev);
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left: ticket + thread ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className={`h-1 ${ticket.status === 'resolved' ? 'bg-violet-500' : ticket.status === 'in_progress' ? 'bg-sky-500' : 'bg-olive-500'}`} />
            <div className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="text-lg font-bold text-zinc-100">{ticket.title}</h1>
                <div className="flex gap-2">
                  <StatusBadge status={ticket.status} />
                  <PriorityBadge priority={ticket.aiPriority ?? null} aiAssessed={!!ticket.aiTriagedAt} />
                </div>
              </div>
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
                  onClick={() => void handleSuggestReply()}
                  disabled={suggesting}
                  className="flex items-center gap-1.5 rounded border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-400 transition hover:bg-violet-500/20 disabled:opacity-40"
                >
                  <span>{suggesting ? '⟳' : '✦'}</span>
                  {suggesting ? 'Analysing…' : 'Suggest Reply'}
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
                <div className="mt-3 flex items-center justify-between gap-3">
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
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
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
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">Assigned To</p>
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
                <option key={a._id} value={a._id}>✦ {a.name} (Auto-reply)</option>
              ))}
              {agents.filter((a) => !a.isAiAgent).map((a) => (
                <option key={a._id} value={a._id}>{a.name}</option>
              ))}
            </select>

            {pendingAgentId && (
              <div className="mt-3 rounded-lg border border-violet-500/25 bg-violet-500/5 p-3">
                <p className="text-[11px] text-violet-300">
                  AI Agent will automatically reply to this ticket. Confirm the assignment?
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
                <p className="text-[10px] text-zinc-600">AI Agent will reply automatically</p>
              </div>
            )}
          </div>

          {/* AI Insights */}
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-500">AI Insights</p>
              <button
                onClick={() => void handleRunTriage()}
                disabled={aiRunning}
                className="rounded border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-400 transition hover:bg-violet-500/20 disabled:opacity-40"
              >
                {aiRunning ? 'Analysing…' : aiResult ? 'Refresh' : 'Run Triage'}
              </button>
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
                      <span key={tag} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">{tag}</span>
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
                      <span key={tag} className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

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
    </div>
  );
}
