import { useEffect, useState, useCallback } from 'react';
import { adminApi, getStoredAgent } from '../../services/adminApi';
import { useToast } from '../../components/Toast';
import type { Agent } from '../../types/admin';

const inputCls = 'w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-olive-500/60 focus:ring-1 focus:ring-olive-500/30';

export default function AdminAgentsPage() {
  const { toast } = useToast();
  const currentAgent = getStoredAgent();
  const isAdmin = currentAgent?.role === 'admin';

  const [agents,  setAgents]  = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Create form
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [role,     setRole]     = useState<'agent' | 'admin'>('agent');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form visibility
  const [formOpen, setFormOpen] = useState(false);

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
    if (password !== confirm) {
      setFormError('Passwords do not match');
      return;
    }
    setCreating(true);
    try {
      const res = await adminApi.createAgent({ name, email, password, role });
      setAgents((prev) => [...prev, res.data]);
      setName(''); setEmail(''); setPassword(''); setConfirm(''); setRole('agent');
      setFormOpen(false);
      toast('Agent created', 'success');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create agent');
    } finally {
      setCreating(false);
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
                      <tr key={agent._id} className="bg-zinc-900">
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
                        <td className="px-4 py-3.5 text-right">
                          {isAdmin && !isAi && !isSelf && (
                            confirmDelete === agent._id ? (
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
                            )
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
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="Min. 8 characters"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Confirm Password</label>
                    <input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      className={inputCls}
                    />
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
    </div>
  );
}
