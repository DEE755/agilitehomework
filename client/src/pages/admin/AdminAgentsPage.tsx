import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, getStoredAgent } from '../../services/adminApi';
import { useToast } from '../../components/Toast';
import type { Agent, AgentActivity } from '../../types/admin';
import StatusBadge from '../../components/StatusBadge';

const inputCls = 'w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-olive-500/60 focus:ring-1 focus:ring-olive-500/30';

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
  const [activityAgent, setActivityAgent] = useState<AgentActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

  async function openActivity(id: string) {
    setActivityLoading(true);
    setActivityAgent(null);
    try {
      const res = await adminApi.getAgentActivity(id);
      setActivityAgent(res.data);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load activity', 'error');
    } finally {
      setActivityLoading(false);
    }
  }

  // Resend invite
  const [resending, setResending] = useState<string | null>(null);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
        <h1 className="text-2xl font-bold text-zinc-100">Agents</h1>
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
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Agent</th>
                    <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Role</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {agents.map((agent) => {
                    const isSelf = agent._id === currentAgent?._id;
                    const isAi   = agent.isAiAgent;
                    return (
                      <tr
                        key={agent._id}
                        className="group bg-zinc-900 cursor-pointer hover:bg-zinc-800/50 transition"
                        onClick={() => void openActivity(agent._id)}
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                              isAi
                                ? 'border-violet-500/40 bg-violet-500/10 text-violet-400'
                                : 'border-zinc-700 bg-zinc-800 text-zinc-300'
                            }`}>
                              {isAi ? '✦' : agent.name[0]?.toUpperCase()}
                            </span>
                            <div>
                              <p className="font-medium text-zinc-200">
                                {agent.name}
                                {isSelf && <span className="ml-2 text-[10px] text-zinc-600">(you)</span>}
                              </p>
                              <p className="text-xs text-zinc-600">{agent.email}</p>
                              <p className="mt-0.5 text-[10px] text-zinc-700 group-hover:text-olive-600 transition">
                                View performance profile →
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
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
                          {isAdmin && !isAi && !isSelf && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => void handleResend(agent._id)}
                                disabled={resending === agent._id}
                                className="rounded border border-zinc-800 px-2.5 py-1 text-[10px] font-semibold text-zinc-600 transition hover:border-sky-500/30 hover:text-sky-400 disabled:opacity-40"
                              >
                                {resending === agent._id ? '…' : 'Resend invite'}
                              </button>
                            {confirmDelete === agent._id ? (
                              <div className="flex items-center justify-end gap-2">
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
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDelete(agent._id)}
                                className="rounded border border-zinc-800 px-2.5 py-1 text-[10px] font-semibold text-zinc-600 transition hover:border-red-500/30 hover:text-red-400"
                              >
                                Remove
                              </button>
                            )}
                            </div>
                          )}
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

      {/* Activity slide-over */}
      {(activityLoading || activityAgent) && (
        <>
          <div
            className="fixed inset-0 z-20 bg-black/50"
            onClick={() => { setActivityAgent(null); setActivityLoading(false); }}
          />
          <div className="fixed inset-y-0 right-0 z-30 flex w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <p className="text-sm font-semibold text-zinc-200">
                {activityAgent ? activityAgent.agent.name : 'Loading…'}
              </p>
              <button
                onClick={() => { setActivityAgent(null); setActivityLoading(false); }}
                className="text-zinc-600 transition hover:text-zinc-300"
              >
                ✕
              </button>
            </div>

            {activityLoading && (
              <div className="flex flex-1 items-center justify-center">
                <span className="text-sm text-zinc-600">Loading activity…</span>
              </div>
            )}

            {activityAgent && (
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Assigned', value: activityAgent.stats.assigned },
                    { label: 'Resolved', value: activityAgent.stats.resolved },
                    { label: 'Replies',  value: activityAgent.stats.replies  },
                    { label: 'Notes',    value: activityAgent.stats.notes    },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 text-center">
                      <p className="text-lg font-bold text-zinc-100">{s.value}</p>
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Assigned tickets */}
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

                {/* Recent replies */}
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
