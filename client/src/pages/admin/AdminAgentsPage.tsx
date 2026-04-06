import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, getStoredAgent } from '../../services/adminApi';
import { useToast } from '../../components/Toast';
import type { Agent, AgentActivity, AgentRating } from '../../types/admin';
import StatusBadge from '../../components/StatusBadge';
import MessagesPanel from '../../components/admin/MessagesPanel';

const inputCls = 'w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-olive-500/60 focus:ring-1 focus:ring-olive-500/30';

const ONLINE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

type AgentStatus = 'online' | 'active' | 'pending';

function agentStatus(agent: Agent): AgentStatus {
  if (agent.isAiAgent) return 'online'; // AI agent is always online
  if (agent.mustChangePassword) return 'pending';
  if (agent.lastActiveAt && Date.now() - new Date(agent.lastActiveAt).getTime() < ONLINE_THRESHOLD_MS) return 'online';
  return 'active';
}

function StatusDot({ status }: { status: AgentStatus }) {
  if (status === 'online') return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
    </span>
  );
  if (status === 'pending') return (
    <span className="h-2 w-2 shrink-0 rounded-full border border-amber-500/60 bg-amber-500/30" />
  );
  return <span className="h-2 w-2 shrink-0 rounded-full bg-zinc-700" />;
}

function StatusLabel({ status, lastActiveAt }: { status: AgentStatus; lastActiveAt?: string | null }) {
  if (status === 'pending') return <span className="text-[10px] font-semibold text-amber-500">Pending setup</span>;
  if (status === 'online')  return null; // dot alone is enough
  if (lastActiveAt) {
    const d = new Date(lastActiveAt);
    const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return <span className="text-[10px] text-zinc-600">Last connected: {label}</span>;
  }
  return null;
}

export default function AdminAgentsPage() {
  const { toast } = useToast();
  const currentAgent = getStoredAgent();
  const isAdmin = currentAgent?.role === 'admin';

  const [agents,  setAgents]  = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Create form
  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');
  const [role,  setRole]  = useState<'agent' | 'admin'>('agent');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form visibility
  const [formOpen, setFormOpen] = useState(false);

  // Activity panel
  const [activityAgent,   setActivityAgent]   = useState<AgentActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

  // Rating
  const [aiRating,      setAiRating]      = useState<AgentRating | null>(null);
  const [aiRating_busy, setAiRating_busy] = useState(false);
  const [manualStars,   setManualStars]   = useState<number>(0);
  const [savingManual,  setSavingManual]  = useState(false);
  const [hoverStar,     setHoverStar]     = useState<number>(0);

  async function openActivity(id: string) {
    setActivityLoading(true);
    setActivityAgent(null);
    setAiRating(null);
    setManualStars(0);
    try {
      const res = await adminApi.getAgentActivity(id);
      setActivityAgent(res.data);
      setAiRating(res.data.rating);
      // Final Rating defaults to manualRating if set, otherwise seeds from AI rating
      setManualStars(res.data.rating?.manualRating ?? res.data.rating?.aiRating ?? 0);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load activity', 'error');
    } finally {
      setActivityLoading(false);
    }
  }

  async function handleAiRate() {
    if (!activityAgent) return;
    setAiRating_busy(true);
    try {
      const res = await adminApi.aiRateAgent(activityAgent.agent._id);
      setAiRating(res.data);
      // Seed Final Rating from AI if not already manually set
      setManualStars((prev) => prev > 0 ? prev : (res.data.aiRating ?? 0));
      toast('AI rating generated', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Rating failed', 'error');
    } finally {
      setAiRating_busy(false);
    }
  }

  async function handleSaveManualRating() {
    if (!activityAgent || manualStars < 1) return;
    setSavingManual(true);
    try {
      await adminApi.updateAgentRating(activityAgent.agent._id, manualStars);
      setAiRating((prev) => prev ? { ...prev, manualRating: manualStars } : prev);
      toast('Rating saved', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to save rating', 'error');
    } finally {
      setSavingManual(false);
    }
  }

  // Resend invite
  const [resending, setResending] = useState<string | null>(null);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Direct message
  const [msgTarget, setMsgTarget] = useState<{ _id: string; name: string; avatarUrl?: string | null } | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.agents();
      setAgents(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAgents(); }, [fetchAgents]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setCreating(true);
    try {
      const res = await adminApi.createAgent({ name, email, role });
      setAgents((prev) => [...prev, res.data]);
      setName(''); setEmail(''); setRole('agent');
      setFormOpen(false);
      toast('Agent created — login code sent by email', 'success');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create agent');
    } finally {
      setCreating(false);
    }
  }

  async function handleResend(id: string) {
    setResending(id);
    try {
      await adminApi.resendAgentInvite(id);
      toast('Invite sent', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to send invite', 'error');
    } finally {
      setResending(null);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await adminApi.deleteAgent(id);
      setAgents((prev) => prev.filter((a) => a._id !== id));
      setConfirmDelete(null);
      toast('Agent removed', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to delete agent', 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Support Workspace</p>
        <h1 className="text-xl font-bold text-zinc-100 sm:text-2xl">Agents</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage who has access to the support workspace.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Agent list */}
        <div className="lg:col-span-2">
          {loading && (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-zinc-900 border border-zinc-800" />
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {!loading && !error && (
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Agent</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Role</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {agents.map((agent) => {
                    const isSelf  = agent._id === currentAgent?._id;
                    const isAi    = agent.isAiAgent;
                    const status  = agentStatus(agent);
                    return (
                      <tr
                        key={agent._id}
                        className="group bg-zinc-900 cursor-pointer hover:bg-zinc-800/50 transition"
                        onClick={() => void openActivity(agent._id)}
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              {isAi ? (
                                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 text-xs font-bold text-violet-400">✦</span>
                              ) : agent.avatarUrl ? (
                                <img src={agent.avatarUrl} alt={agent.name} className="h-8 w-8 rounded-full object-cover border border-zinc-700" />
                              ) : (
                                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-xs font-bold text-zinc-300">
                                  {agent.name[0]?.toUpperCase()}
                                </span>
                              )}
                              {!isAi && (
                                <span className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center">
                                  <StatusDot status={status} />
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-zinc-200">
                                  {agent.name}
                                  {isSelf && <span className="ml-1.5 text-[10px] text-zinc-600">(you)</span>}
                                </p>
                                <StatusLabel status={status} lastActiveAt={agent.lastActiveAt} />
                              </div>
                              <p className="text-xs text-zinc-600">{agent.email}</p>
                              <div className="mt-0.5 flex items-center gap-2">
                                <span className="text-[10px] text-zinc-700 group-hover:text-olive-600 transition">
                                  View performance →
                                </span>
                                {!isAi && !isSelf && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setMsgTarget({ _id: agent._id, name: agent.name, avatarUrl: agent.avatarUrl }); }}
                                    className="flex items-center justify-center rounded p-0.5 text-zinc-600 transition hover:text-sky-400 hover:bg-sky-500/10"
                                    title={`Chat with ${agent.name.split(' ')[0]}`}
                                  >
                                    <svg viewBox="0 0 14 14" fill="none" className="h-3 w-3">
                                      <path d="M12 7c0 2.8-2.25 5-5 5a4.97 4.97 0 01-2.5-.66L2 12l.66-2.5A4.97 4.97 0 012 7c0-2.8 2.25-5 5-5s5 2.2 5 5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3.5">
                          {isAi ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
                              ✦ AI Agent
                            </span>
                          ) : (
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              agent.role === 'admin'
                                ? 'border-olive-500/30 bg-olive-500/10 text-olive-400'
                                : 'border-zinc-700 bg-zinc-800 text-zinc-400'
                            }`}>
                              {agent.role}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col items-end gap-1.5">
                            {/* AI agent parameters button */}
                            {isAdmin && isAi && (
                              <button
                                onClick={() => window.dispatchEvent(new CustomEvent('open-store-settings', { detail: { section: 'ai' } }))}
                                className="flex items-center gap-1.5 rounded border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold text-violet-400 transition hover:bg-violet-500/20"
                              >
                                <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3">
                                  <path d="M8 10.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" strokeWidth="1.3"/>
                                  <path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                                </svg>
                                AI Parameters
                              </button>
                            )}
                            {/* Admin actions */}
                            {isAdmin && !isAi && !isSelf && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => void handleResend(agent._id)}
                                  disabled={resending === agent._id}
                                  className="rounded border border-zinc-800 px-2.5 py-1 text-[10px] font-semibold text-zinc-600 transition hover:border-sky-500/30 hover:text-sky-400 disabled:opacity-40"
                                >
                                  {resending === agent._id ? '…' : 'Resend invite'}
                                </button>
                                {confirmDelete === agent._id ? (
                                  <>
                                    <span className="text-xs text-zinc-500">Remove?</span>
                                    <button
                                      onClick={() => void handleDelete(agent._id)}
                                      disabled={deleting}
                                      className="rounded border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-40"
                                    >
                                      {deleting ? '…' : 'Confirm'}
                                    </button>
                                    <button
                                      onClick={() => setConfirmDelete(null)}
                                      className="rounded border border-zinc-700 px-2.5 py-1 text-[10px] font-semibold text-zinc-500 transition hover:text-zinc-300"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDelete(agent._id)}
                                    className="rounded border border-zinc-800 p-1.5 text-zinc-600 transition hover:border-red-500/30 hover:text-red-400"
                                    title="Remove agent"
                                  >
                                    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                                      <path d="M2 4h12M5 4V2.5A.5.5 0 015.5 2h5a.5.5 0 01.5.5V4M6 7v5M10 7v5M3 4l1 9.5A.5.5 0 004.5 14h7a.5.5 0 00.5-.5L13 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create form — admins only */}
        {isAdmin && (
          <div>
            {!formOpen ? (
              <button
                onClick={() => setFormOpen(true)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 transition hover:border-olive-500/40 hover:text-olive-400"
              >
                + New Agent
              </button>
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600">New Agent</p>
                  <button
                    onClick={() => { setFormOpen(false); setFormError(null); }}
                    className="text-zinc-600 transition hover:text-zinc-300"
                  >
                    ✕
                  </button>
                </div>

                {formError && (
                  <p className="mb-3 rounded border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                    {formError}
                  </p>
                )}

                <form onSubmit={(e) => void handleCreate(e)} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className={inputCls}
                    />
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
                    <p className="text-[10px] text-zinc-600">
                      A one-time login code will be generated and sent to the agent's email. They'll be prompted to set their own password on first login.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as 'agent' | 'admin')}
                      className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-olive-500/30"
                    >
                      <option value="agent">Agent</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={creating}
                    className="w-full rounded border border-olive-500/40 bg-olive-500/15 py-2 text-xs font-semibold uppercase tracking-wider text-olive-400 transition hover:bg-olive-500/25 disabled:opacity-50"
                  >
                    {creating ? 'Creating…' : 'Create Agent'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Direct message panel */}
      <MessagesPanel
        open={!!msgTarget}
        onClose={() => setMsgTarget(null)}
        initialPartner={msgTarget ?? undefined}
      />

      {/* Activity slide-over */}
      {(activityLoading || activityAgent) && (
        <>
          <div
            className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm"
            onClick={() => { setActivityAgent(null); setActivityLoading(false); }}
          />
          <div className="fixed inset-y-0 right-0 z-30 flex w-full max-w-lg flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4 shrink-0">
              <div className="flex items-center gap-3">
                {activityAgent?.agent.avatarUrl ? (
                  <img src={activityAgent.agent.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover border border-zinc-700" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-xs font-bold text-zinc-300">
                    {activityAgent?.agent.name[0]?.toUpperCase() ?? '…'}
                  </span>
                )}
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{activityAgent?.agent.name ?? 'Loading…'}</p>
                  <p className="text-[10px] text-zinc-600">{activityAgent?.agent.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activityAgent && !activityAgent.agent.isAiAgent && activityAgent.agent._id !== currentAgent?._id && (
                  <button
                    onClick={() => setMsgTarget({ _id: activityAgent.agent._id, name: activityAgent.agent.name, avatarUrl: activityAgent.agent.avatarUrl })}
                    className="flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold text-sky-400 transition hover:bg-sky-500/20"
                  >
                    <svg viewBox="0 0 14 14" fill="none" className="h-3 w-3">
                      <path d="M12 7c0 2.8-2.25 5-5 5a4.97 4.97 0 01-2.5-.66L2 12l.66-2.5A4.97 4.97 0 012 7c0-2.8 2.25-5 5-5s5 2.2 5 5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                    </svg>
                    Chat with {activityAgent.agent.name.split(' ')[0]}
                  </button>
                )}
                <button
                  onClick={() => { setActivityAgent(null); setActivityLoading(false); }}
                  className="text-zinc-600 transition hover:text-zinc-300"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>

            {activityLoading && (
              <div className="flex flex-1 items-center justify-center">
                <svg className="h-6 w-6 animate-spin text-zinc-600" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31" strokeDashoffset="10"/>
                </svg>
              </div>
            )}

            {activityAgent && (
              <div className="flex-1 overflow-y-auto p-5 space-y-7">

                {/* ── Stats row ───────────────────────────────────────────── */}
                <div className="grid grid-cols-4 gap-2.5">
                  {[
                    { label: 'Assigned', value: activityAgent.stats.assigned },
                    { label: 'Resolved', value: activityAgent.stats.resolved },
                    { label: 'Replies',  value: activityAgent.stats.replies  },
                    { label: 'Notes',    value: activityAgent.stats.notes    },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-center">
                      <p className="text-xl font-bold text-zinc-100">{s.value}</p>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* ── AI Rating ───────────────────────────────────────────── */}
                {isAdmin && !activityAgent.agent.isAiAgent && (
                  <div className="space-y-3">

                    {/* Block 1 — AI-generated, read-only */}
                    <div className="rounded-xl border border-violet-500/20 bg-zinc-900 overflow-hidden">
                      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-violet-400">
                            <path d="M8 1l1.5 4.5H14l-3.5 2.5 1.5 4.5L8 10 4 12.5l1.5-4.5L2 5.5h4.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                          </svg>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-400">AI Rating</p>
                          <span className="text-[9px] text-zinc-600 font-normal normal-case tracking-normal">— read only</span>
                        </div>
                        <button
                          onClick={() => void handleAiRate()}
                          disabled={aiRating_busy}
                          className="flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold text-violet-400 transition hover:bg-violet-500/20 disabled:opacity-50"
                        >
                          {aiRating_busy ? (
                            <>
                              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31" strokeDashoffset="10"/>
                              </svg>
                              Analyzing…
                            </>
                          ) : (
                            <>
                              <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5">
                                <path d="M6 1l1 3h3l-2.5 2 1 3L6 7.5 3.5 9l1-3L2 4h3z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
                              </svg>
                              {aiRating?.aiRating ? 'Re-rate with AI' : 'Rate with AI'}
                            </>
                          )}
                        </button>
                      </div>

                      <div className="p-4 space-y-4">
                        {aiRating?.aiRating ? (
                          <>
                            {/* Stars — NOT interactive */}
                            <div className="flex items-center gap-3">
                              <div className="flex gap-0.5">
                                {[1,2,3,4,5].map((n) => (
                                  <svg key={n} viewBox="0 0 16 16" className={`h-5 w-5 ${n <= (aiRating.aiRating ?? 0) ? 'text-violet-400' : 'text-zinc-700'}`}>
                                    <path d="M8 1l1.5 4.5H14l-3.5 2.5 1.5 4.5L8 10 4 12.5l1.5-4.5L2 5.5h4.5z" fill="currentColor"/>
                                  </svg>
                                ))}
                              </div>
                              <span className="text-2xl font-bold text-zinc-100">{aiRating.aiRating}<span className="text-sm font-normal text-zinc-500">/5</span></span>
                              {aiRating.aiRatedAt && (
                                <span className="ml-auto text-[10px] text-zinc-600">
                                  {new Date(aiRating.aiRatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                              )}
                            </div>

                            {aiRating.aiRatingExplanation && (
                              <p className="text-xs text-zinc-400 leading-relaxed border-l-2 border-violet-500/30 pl-3">
                                {aiRating.aiRatingExplanation}
                              </p>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                              {aiRating.aiRatingStrengths?.length > 0 && (
                                <div>
                                  <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                                    <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                    Strengths
                                  </p>
                                  <ul className="space-y-1">
                                    {aiRating.aiRatingStrengths.map((s, i) => (
                                      <li key={i} className="flex gap-1.5 text-[11px] text-zinc-400">
                                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-emerald-500/60" />
                                        {s}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {aiRating.aiRatingImprovements?.length > 0 && (
                                <div>
                                  <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-600">
                                    <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5"><path d="M6 2v4M6 8v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                                    To improve
                                  </p>
                                  <ul className="space-y-1">
                                    {aiRating.aiRatingImprovements.map((s, i) => (
                                      <li key={i} className="flex gap-1.5 text-[11px] text-zinc-400">
                                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-500/60" />
                                        {s}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-zinc-600 py-1">
                            No AI assessment yet — click "Rate with AI" to generate one based on this agent's ticket history and replies.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Block 2 — Final Rating, manually editable */}
                    <div className="rounded-xl border border-amber-500/20 bg-zinc-900 overflow-hidden">
                      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
                        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-amber-400">
                          <path d="M8 1l1.5 4.5H14l-3.5 2.5 1.5 4.5L8 10 4 12.5l1.5-4.5L2 5.5h4.5z" fill="currentColor"/>
                        </svg>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">Final Rating</p>
                        <span className="text-[9px] text-zinc-600 font-normal normal-case tracking-normal">— your call, editable</span>
                        {aiRating?.aiRating && manualStars === aiRating.aiRating && !aiRating.manualRating && (
                          <span className="ml-auto text-[9px] text-zinc-600 italic">pre-filled from AI</span>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map((n) => (
                              <button
                                key={n}
                                onMouseEnter={() => setHoverStar(n)}
                                onMouseLeave={() => setHoverStar(0)}
                                onClick={() => setManualStars(n)}
                              >
                                <svg viewBox="0 0 16 16" className={`h-6 w-6 transition ${
                                  n <= (hoverStar || manualStars) ? 'text-amber-400' : 'text-zinc-700 hover:text-zinc-500'
                                }`}>
                                  <path d="M8 1l1.5 4.5H14l-3.5 2.5 1.5 4.5L8 10 4 12.5l1.5-4.5L2 5.5h4.5z" fill="currentColor"/>
                                </svg>
                              </button>
                            ))}
                          </div>
                          {manualStars > 0 && (
                            <span className="text-sm font-bold text-zinc-100 tabular-nums">
                              {manualStars}<span className="text-xs font-normal text-zinc-500">/5</span>
                            </span>
                          )}
                          <button
                            onClick={() => void handleSaveManualRating()}
                            disabled={savingManual || manualStars < 1}
                            className="ml-auto rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-400 transition hover:bg-amber-500/20 disabled:opacity-40"
                          >
                            {savingManual ? 'Saving…' : 'Save Final Rating'}
                          </button>
                        </div>
                        {aiRating?.manualRating && (
                          <p className="mt-2 text-[10px] text-zinc-600">
                            Last saved: {aiRating.manualRating}/5
                          </p>
                        )}
                      </div>
                    </div>

                  </div>
                )}

                {/* ── Assigned Tickets ────────────────────────────────────── */}
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Assigned Tickets</p>
                  {activityAgent.assignedTickets.length === 0 ? (
                    <p className="text-xs text-zinc-600">No tickets assigned</p>
                  ) : (
                    <div className="space-y-1.5">
                      {activityAgent.assignedTickets.map((t) => (
                        <Link
                          key={t._id}
                          to={`/admin/tickets/${t._id}`}
                          onClick={() => setActivityAgent(null)}
                          className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 transition hover:border-zinc-700"
                        >
                          <span className="truncate text-xs text-zinc-300">{t.title}</span>
                          <StatusBadge status={t.status} />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Recent Replies ──────────────────────────────────────── */}
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Recent Replies</p>
                  {activityAgent.recentReplies.length === 0 ? (
                    <p className="text-xs text-zinc-600">No replies yet</p>
                  ) : (
                    <div className="space-y-2">
                      {activityAgent.recentReplies.map((r, i) => (
                        <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5">
                          <p className="mb-1 text-[10px] text-zinc-500 truncate">{r.ticketTitle}</p>
                          <p className="line-clamp-2 text-xs text-zinc-400">{r.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
