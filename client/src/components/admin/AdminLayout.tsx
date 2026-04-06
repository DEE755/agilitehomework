import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import SettingsPanel from './SettingsPanel';
import InsightsPanel from './InsightsPanel';
import NotificationBell from './NotificationBell';
import { adminApi, getStoredAgent } from '../../services/adminApi';
import { useToast } from '../Toast';
import { useLanguage } from '../../i18n/LanguageContext';

const ADMIN_THEME_KEY = 'admin-ui-theme';

const TOKEN_KEY = 'ag_admin_token';
const AGENT_KEY = 'ag_admin_agent';

const inputCls =
  'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-olive-500/60 focus:ring-1 focus:ring-olive-500/30';

// ── Forced password change modal (no current password required) ───────────────

function ChangePasswordModal({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [next,    setNext]    = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) { setError('Passwords do not match'); return; }
    if (next.length < 8)  { setError('Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      await adminApi.changePassword({ currentPassword: '', newPassword: next });
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
              New Password
            </label>
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} placeholder="Min. 8 characters" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Confirm New Password
            </label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className={inputCls} />
          </div>
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>
          )}
          <button type="submit" disabled={saving} className="w-full rounded-lg border border-olive-500/40 bg-olive-500/15 py-2.5 text-xs font-semibold uppercase tracking-wider text-olive-400 transition hover:bg-olive-500/25 disabled:opacity-50">
            {saving ? 'Saving…' : 'Set Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Profile slide-over ────────────────────────────────────────────────────────

const profileInputCls =
  'w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-olive-500/60 focus:ring-1 focus:ring-olive-500/30';

function ProfilePanel({ open, onClose, onLogout, onAvatarUpdate, adminTheme, onThemeChange }: {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  onAvatarUpdate: (url: string) => void;
  adminTheme: 'dark' | 'light';
  onThemeChange: (t: 'dark' | 'light') => void;
}) {
  const agent = getStoredAgent();
  const { toast } = useToast();
  const { lang, setLang } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState<string | null>(agent?.avatarUrl ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Change password
  const [pwOpen,   setPwOpen]   = useState(false);
  const [current,  setCurrent]  = useState('');
  const [next,     setNext]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [saving,   setSaving]   = useState(false);
  const [pwError,  setPwError]  = useState<string | null>(null);

  // Sync avatar when panel reopens
  useEffect(() => {
    if (open) setAvatarPreview(getStoredAgent()?.avatarUrl ?? null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Local preview
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setAvatarUploading(true);
    try {
      // 1. Get presigned URL
      const { data: presign } = await adminApi.presignAvatar(file.type);
      // 2. Upload directly to R2
      await fetch(presign.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      // 3. Save key on server
      const { data: profile } = await adminApi.updateProfile({ avatarKey: presign.key });
      const url = profile.avatarUrl ?? URL.createObjectURL(file);
      // 4. Persist in localStorage
      const stored = getStoredAgent();
      if (stored) localStorage.setItem(AGENT_KEY, JSON.stringify({ ...stored, avatarUrl: url }));
      setAvatarPreview(url);
      onAvatarUpdate(url);
      toast('Profile photo updated', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setAvatarUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handlePwSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (next !== confirm) { setPwError('Passwords do not match'); return; }
    if (next.length < 8)  { setPwError('Min. 8 characters required'); return; }
    setSaving(true);
    try {
      await adminApi.changePassword({ currentPassword: current, newPassword: next });
      setCurrent(''); setNext(''); setConfirm('');
      setPwOpen(false);
      toast('Password updated', 'success');
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Failed to update password');
    } finally {
      setSaving(false);
    }
  }

  const initials = agent?.name
    ?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">My Profile</p>
          <button onClick={onClose} className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300">
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
              <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">

          {/* Avatar + identity */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="relative">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt={agent?.name}
                  className={`h-20 w-20 rounded-full object-cover border-2 border-zinc-700 ${avatarUploading ? 'opacity-50' : ''}`}
                />
              ) : (
                <div className={`flex h-20 w-20 items-center justify-center rounded-full border-2 border-zinc-700 bg-zinc-800 text-xl font-bold text-zinc-300 ${avatarUploading ? 'opacity-50' : ''}`}>
                  {initials}
                </div>
              )}
              {avatarUploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                  <svg className="h-5 w-5 animate-spin text-olive-400" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
                  </svg>
                </div>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={avatarUploading}
              className="text-[10px] font-semibold text-zinc-500 transition hover:text-olive-400 disabled:opacity-40"
            >
              Change photo
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => void handleAvatarChange(e)} />
            <div>
              <p className="text-sm font-semibold text-zinc-100">{agent?.name ?? 'Agent'}</p>
              <p className="text-[10px] text-zinc-600">{agent?.email ?? ''}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-700">{agent?.role}</p>
            </div>
          </div>

          {/* Preferences */}
          <div className="border-t border-zinc-800/60 pt-4 space-y-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Preferences</p>

            {/* Language */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Language</span>
              <div className="flex rounded-lg border border-zinc-800 overflow-hidden">
                {(['en', 'he'] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`px-3 py-1.5 text-[11px] font-semibold transition ${
                      lang === l
                        ? 'bg-zinc-700 text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {l === 'en' ? 'EN' : 'א'}
                  </button>
                ))}
              </div>
            </div>

            {/* Display mode */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Display</span>
              <div className="flex rounded-lg border border-zinc-800 overflow-hidden">
                {(['dark', 'light'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => onThemeChange(t)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold transition ${
                      adminTheme === t
                        ? 'bg-zinc-700 text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {t === 'dark' ? '🌙 Dark' : '☀ Light'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Change password — collapsible */}
          <div className="border-t border-zinc-800/60 pt-4">
            <button
              onClick={() => { setPwOpen((v) => !v); setPwError(null); }}
              className="flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-zinc-600 transition hover:text-zinc-400"
            >
              Change Password
              <svg viewBox="0 0 12 12" fill="none" className={`h-3 w-3 transition-transform ${pwOpen ? 'rotate-180' : ''}`}>
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {pwOpen && (
              <form onSubmit={(e) => void handlePwSubmit(e)} className="mt-3 space-y-2.5">
                <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required placeholder="Current password" className={profileInputCls} />
                <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} placeholder="New password (min. 8 chars)" className={profileInputCls} />
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Confirm new password" className={profileInputCls} />
                {pwError && <p className="rounded border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{pwError}</p>}
                <button type="submit" disabled={saving} className="w-full rounded border border-zinc-700 bg-zinc-800 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-300 transition hover:border-olive-500/40 hover:text-olive-400 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Update Password'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer: sign out */}
        <div className="border-t border-zinc-800 px-5 py-4">
          <button
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 py-2.5 text-xs font-semibold text-red-400 transition hover:border-red-500/30 hover:bg-red-500/10"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
              <path d="M7 3H4a1 1 0 00-1 1v12a1 1 0 001 1h3M13 14l3-4-3-4M16 10H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function AdminLayout() {
  const [settingsOpen,   setSettingsOpen]   = useState(false);
  const [insightsOpen,   setInsightsOpen]   = useState(false);
  const [profileOpen,    setProfileOpen]    = useState(false);
  const [mobileNavOpen,  setMobileNavOpen]  = useState(false);
  const navigate = useNavigate();
  const [agent, setAgent] = useState(getStoredAgent);
  const [adminTheme, setAdminTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem(ADMIN_THEME_KEY) as 'dark' | 'light') ?? 'dark'
  );

  function handleThemeChange(t: 'dark' | 'light') {
    setAdminTheme(t);
    localStorage.setItem(ADMIN_THEME_KEY, t);
  }

  const [mustChange, setMustChange] = useState(() => agent?.mustChangePassword ?? false);

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(AGENT_KEY);
    void navigate('/admin/login');
  }

  function handleAvatarUpdate(url: string) {
    setAgent((prev) => prev ? { ...prev, avatarUrl: url } : prev);
  }

  const initials = agent?.name
    ?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';

  return (
    <div id="admin-root" className={`min-h-screen bg-zinc-950${adminTheme === 'light' ? ' admin-light' : ''}`}>
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
                <span className="block text-xs font-bold uppercase tracking-widest text-zinc-100">Agilate</span>
                <span className="block text-[9px] uppercase tracking-widest text-olive-600">Support Workspace</span>
              </div>
            </Link>

            <span className="hidden h-4 w-px bg-zinc-800 sm:block" />

            <nav className="hidden items-center gap-1 sm:flex">
              <NavLink to="/admin/tickets" className={({ isActive }) => `rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${isActive ? 'text-olive-400' : 'text-zinc-500 hover:text-zinc-200'}`}>
                Tickets
              </NavLink>
              <NavLink to="/admin/agents" className={({ isActive }) => `rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${isActive ? 'text-olive-400' : 'text-zinc-500 hover:text-zinc-200'}`}>
                Agents
              </NavLink>
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Mobile hamburger */}
            <button
              className="flex flex-col gap-1 p-1.5 sm:hidden"
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-label="Toggle navigation"
            >
              <span className={`block h-0.5 w-5 bg-zinc-400 transition-all ${mobileNavOpen ? 'translate-y-1.5 rotate-45' : ''}`} />
              <span className={`block h-0.5 w-5 bg-zinc-400 transition-all ${mobileNavOpen ? 'opacity-0' : ''}`} />
              <span className={`block h-0.5 w-5 bg-zinc-400 transition-all ${mobileNavOpen ? '-translate-y-1.5 -rotate-45' : ''}`} />
            </button>
            <span className="hidden rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 sm:inline-flex">
              Internal Staff Portal
            </span>
            <Link to="/products" className="hidden rounded border border-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-300 sm:block">
              Customer Portal
            </Link>
            <button
              onClick={() => setInsightsOpen(true)}
              className="hidden items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-400 transition hover:bg-violet-500/15 sm:flex"
              title="AI Insights"
            >
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                <path d="M8 1l1.5 4.5H14l-3.5 2.5 1.5 4.5L8 10 4 12.5l1.5-4.5L2 5.5h4.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              </svg>
              AI Insights
            </button>
            <NotificationBell />
            {agent?.role === 'admin' && <button
              onClick={() => setSettingsOpen(true)}
              className="rounded border border-zinc-800 p-1.5 text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-300"
              aria-label="Store configuration"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                <path d="M10 13a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M10 2v1.5M10 16.5V18M2 10h1.5M16.5 10H18M4.1 4.1l1.06 1.06M14.84 14.84l1.06 1.06M4.1 15.9l1.06-1.06M14.84 5.16l1.06-1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>}

            {/* Agent identity — click to open profile panel */}
            <button
              onClick={() => setProfileOpen(true)}
              className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 transition hover:border-zinc-700"
            >
              {agent?.avatarUrl ? (
                <img src={agent.avatarUrl} alt={agent.name} className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-700 text-[9px] font-bold text-zinc-300">
                  {initials}
                </span>
              )}
              <span className="hidden text-[10px] text-zinc-500 sm:block">{agent?.name ?? 'Agent'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile nav dropdown */}
      {mobileNavOpen && (
        <div className="border-b border-zinc-800 bg-zinc-950 px-4 py-3 sm:hidden">
          <nav className="flex flex-col gap-1">
            <NavLink
              to="/admin/tickets"
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) => `rounded px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-zinc-900 text-olive-400' : 'text-zinc-400 hover:text-zinc-100'}`}
            >
              Tickets
            </NavLink>
            <NavLink
              to="/admin/agents"
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) => `rounded px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-zinc-900 text-olive-400' : 'text-zinc-400 hover:text-zinc-100'}`}
            >
              Agents
            </NavLink>
            <Link
              to="/products"
              onClick={() => setMobileNavOpen(false)}
              className="mt-1 rounded border border-zinc-800 px-3 py-2.5 text-center text-sm font-medium text-zinc-500 transition hover:text-zinc-300"
            >
              Customer Portal
            </Link>
          </nav>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-5 sm:py-8">
        <Outlet />
      </main>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <InsightsPanel open={insightsOpen} onClose={() => setInsightsOpen(false)} />
      <ProfilePanel
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onLogout={handleLogout}
        onAvatarUpdate={handleAvatarUpdate}
        adminTheme={adminTheme}
        onThemeChange={handleThemeChange}
      />
    </div>
  );
}
