import { useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import SettingsPanel from './SettingsPanel';
import NotificationBell from './NotificationBell';
import { adminApi, getStoredAgent } from '../../services/adminApi';
import { useToast } from '../Toast';

const TOKEN_KEY = 'ag_admin_token';
const AGENT_KEY = 'ag_admin_agent';

const inputCls =
  'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-olive-500/60 focus:ring-1 focus:ring-olive-500/30';

function ChangePasswordModal({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [current,  setCurrent]  = useState('');
  const [next,     setNext]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) { setError('Passwords do not match'); return; }
    if (next.length < 8)  { setError('Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      await adminApi.changePassword({ currentPassword: current, newPassword: next });
      // Clear flag in localStorage
      const stored = getStoredAgent();
      if (stored) {
        localStorage.setItem(AGENT_KEY, JSON.stringify({ ...stored, mustChangePassword: false }));
      }
      toast('Password updated', 'success');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-8 shadow-2xl">
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-lg">
          🔑
        </div>
        <h2 className="mt-4 text-lg font-bold text-zinc-100">Set your password</h2>
        <p className="mt-1 text-sm text-zinc-500">
          You're using a temporary login code. Please choose a permanent password to continue.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Temporary Code (current password)
            </label>
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              placeholder="Enter the code sent to your email"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              New Password
            </label>
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              minLength={8}
              placeholder="Min. 8 characters"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg border border-olive-500/40 bg-olive-500/15 py-2.5 text-xs font-semibold uppercase tracking-wider text-olive-400 transition hover:bg-olive-500/25 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Set Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const agent = getStoredAgent();

  const [mustChange, setMustChange] = useState(() => agent?.mustChangePassword ?? false);

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(AGENT_KEY);
    void navigate('/admin/login');
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {mustChange && <ChangePasswordModal onDone={() => setMustChange(false)} />}

      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          {/* Brand */}
          <div className="flex items-center gap-4">
            <Link to="/admin/tickets" className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded border border-olive-500/40 bg-olive-500/15">
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-olive-400">
                  <path d="M10 2L2 7v6l8 5 8-5V7L10 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" fill="currentColor"/>
                </svg>
              </span>
              <div>
                <span className="block text-xs font-bold uppercase tracking-widest text-zinc-100">Agilite</span>
                <span className="block text-[9px] uppercase tracking-widest text-olive-600">Support Workspace</span>
              </div>
            </Link>

            <span className="hidden h-4 w-px bg-zinc-800 sm:block" />

            <nav className="hidden items-center gap-1 sm:flex">
              <NavLink
                to="/admin/tickets"
                className={({ isActive }) =>
                  `rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                    isActive ? 'text-olive-400' : 'text-zinc-500 hover:text-zinc-200'
                  }`
                }
              >
                Tickets
              </NavLink>
              <NavLink
                to="/admin/agents"
                className={({ isActive }) =>
                  `rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                    isActive ? 'text-olive-400' : 'text-zinc-500 hover:text-zinc-200'
                  }`
                }
              >
                Agents
              </NavLink>
            </nav>
          </div>

          {/* Context switch + notifications */}
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 sm:inline-flex">
              Internal Staff Portal
            </span>
            <Link
              to="/products"
              className="rounded border border-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-300"
            >
              Customer Portal
            </Link>
            <NotificationBell />
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded border border-zinc-800 p-1.5 text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-300"
              aria-label="Open settings"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                <path d="M10 13a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.1 4.1l1.06 1.06M14.84 14.84l1.06 1.06M4.1 15.9l1.06-1.06M14.84 5.16l1.06-1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>

            {/* Agent identity + logout */}
            <div className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900 pl-2.5 pr-1 py-1">
              <span className="hidden text-[10px] text-zinc-500 sm:block">
                {agent?.name ?? 'Agent'}
              </span>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 transition hover:text-red-400"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
