import { useEffect, useState, useRef } from 'react';
import { adminApi, getStoredAgent } from '../../services/adminApi';
import type { AppSettings } from '../../types/admin';
import { THEMES, applyTheme as applySeasonalTheme, getTheme } from '../../themes/seasonal';

interface Props {
  open: boolean;
  onClose: () => void;
  initialSection?: 'ai' | 'themes';
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-olive-500/40 disabled:opacity-50 ${
        checked ? 'bg-olive-500' : 'bg-zinc-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

/** Collapsible section header. When collapsed, shows an optional badge to the right of the label. */
function SectionHeader({
  label, expanded, onToggle, badge,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-0.5 text-left transition hover:bg-zinc-900/60"
    >
      <p className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
      <div className="flex min-w-0 items-center gap-2">
        {!expanded && badge && (
          <span className="truncate text-[10px] text-zinc-500">
            Applied: <span className="font-semibold text-zinc-300">{badge}</span>
          </span>
        )}
        <svg
          viewBox="0 0 12 12"
          fill="none"
          className={`h-3 w-3 shrink-0 text-zinc-600 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </button>
  );
}

const JEWISH_THEMES     = THEMES.filter((t) => t.group === 'jewish');
const COMMERCIAL_THEMES = THEMES.filter((t) => t.group === 'commercial');

export default function SettingsPanel({ open, onClose, initialSection }: Props) {
  const [settings, setSettings]           = useState<AppSettings | null>(null);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [aiExpanded, setAiExpanded]       = useState(false);
  const [themesExpanded, setThemesExpanded] = useState(false);
  // Theme the user clicked but hasn't confirmed yet
  const [pendingTheme, setPendingTheme]   = useState<string | null>(null);
  // AI avatar upload
  const [aiAvatar, setAiAvatar]           = useState<string | null>(null);
  const [aiAvatarUploading, setAiAvatarUploading] = useState(false);
  const aiAvatarRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      // Fold everything when panel closes
      setAiExpanded(false);
      setThemesExpanded(false);
      return;
    }
    setAiExpanded(initialSection === 'ai');
    setThemesExpanded(initialSection === 'themes');
    adminApi.settings.get()
      .then((res) => {
        setSettings(res.data);
        if (res.data.activeTheme) applySeasonalTheme(res.data.activeTheme);
      })
      .catch((e: Error) => setError(e.message));
    // Load AI agent's current avatar
    adminApi.agents().then((res) => {
      const ai = res.data.find((a) => a.isAiAgent);
      if (ai) setAiAvatar(ai.avatarUrl ?? null);
    }).catch(() => null);
  }, [open, initialSection]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear pending selection when section collapses
  useEffect(() => {
    if (!themesExpanded) setPendingTheme(null);
  }, [themesExpanded]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  async function toggle(key: keyof AppSettings, value: boolean) {
    if (!settings) return;
    const prev = settings;
    setSettings({ ...settings, [key]: value });
    setSaving(true);
    setError(null);
    try {
      const res = await adminApi.settings.update({ [key]: value });
      setSettings(res.data);
    } catch (e) {
      setSettings(prev);
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadAiAvatar(file: File) {
    setAiAvatarUploading(true);
    setError(null);
    try {
      const { data: presign } = await adminApi.settings.presignAiAvatar(file.type);
      await fetch(presign.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      const { data } = await adminApi.settings.updateAiAvatar(presign.key);
      setAiAvatar(data.avatarUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload avatar');
    } finally {
      setAiAvatarUploading(false);
    }
  }

  async function resetAiAvatar() {
    setAiAvatarUploading(true);
    setError(null);
    try {
      const { data } = await adminApi.settings.updateAiAvatar(null);
      setAiAvatar(data.avatarUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset avatar');
    } finally {
      setAiAvatarUploading(false);
    }
  }

  async function applyTheme(themeId: string) {
    if (!settings) return;
    // Live preview immediately so the admin can see what they confirmed
    applySeasonalTheme(themeId);
    const prev = settings;
    setSettings({ ...settings, activeTheme: themeId === 'default' ? null : themeId });
    setSaving(true);
    setError(null);
    try {
      const res = await adminApi.settings.update({ activeTheme: themeId === 'default' ? null : themeId });
      setSettings(res.data);
    } catch (e) {
      setSettings(prev);
      setError((e as Error).message);
    } finally {
      setSaving(false);
      setPendingTheme(null);
    }
  }

  const activeTheme = settings?.activeTheme ?? 'default';
  const activeThemeLabel = activeTheme === 'default'
    ? 'Default'
    : `${getTheme(activeTheme).emoji} ${getTheme(activeTheme).name}`;

  function themeChipClass(themeId: string) {
    const isApplied = activeTheme === themeId;
    const isPending = pendingTheme === themeId;
    if (isPending)  return 'border-olive-500/60 bg-olive-500/10 text-zinc-100 ring-1 ring-olive-500/30';
    if (isApplied)  return 'border-zinc-500 bg-zinc-800 text-zinc-100';
    return 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200';
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={panelRef}
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Platform-wide</p>
            <h2 className="text-sm font-bold text-zinc-100">Store Configuration</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
            aria-label="Close settings"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
              <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* ── AI Settings (collapsed by default) ───────────────────────── */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
            <SectionHeader
              label="AI Settings"
              expanded={aiExpanded}
              onToggle={() => setAiExpanded((v) => !v)}
            />

            {aiExpanded && (
              <div className="mt-3 space-y-3">
                {/* Auto-reply */}
                <div className="flex items-start justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-zinc-200">Auto-reply</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                      AI replies automatically to simple tickets and marks them resolved — no agent needed.
                    </p>
                    {settings?.autoReplyEnabled && (
                      <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-olive-500/20 bg-olive-500/10 px-2 py-0.5 text-[10px] font-semibold text-olive-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-olive-400" />
                        Active
                      </p>
                    )}
                  </div>
                  <Toggle
                    checked={settings?.autoReplyEnabled ?? false}
                    onChange={(v) => void toggle('autoReplyEnabled', v)}
                    disabled={saving || settings === null}
                  />
                </div>

                {/* Force recommendations — admin only */}
                {getStoredAgent()?.role === 'admin' && (
                  <div className="flex items-start justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-200">Force recommendations</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                        Always generate a product recommendation regardless of customer sentiment. Overrides the AI's "not recommended" decision.
                      </p>
                      {settings?.forceRecommendations && (
                        <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          Always on
                        </p>
                      )}
                    </div>
                    <Toggle
                      checked={settings?.forceRecommendations ?? false}
                      onChange={(v) => void toggle('forceRecommendations', v)}
                      disabled={saving || settings === null}
                    />
                  </div>
                )}

                {/* AI Agent avatar */}
                <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3.5">
                  <p className="mb-3 text-xs font-semibold text-zinc-200">AI Agent Picture</p>
                  <div className="flex items-center gap-3">
                    {aiAvatar ? (
                      <img src={aiAvatar} alt="AI Agent" className="h-12 w-12 rounded-full object-cover shrink-0 border border-zinc-700" />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-[10px] font-bold text-zinc-400">AI</div>
                    )}
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <button
                        onClick={() => aiAvatarRef.current?.click()}
                        disabled={aiAvatarUploading}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100 disabled:opacity-50"
                      >
                        {aiAvatarUploading ? 'Uploading…' : 'Upload photo'}
                      </button>
                      <button
                        onClick={() => void resetAiAvatar()}
                        disabled={aiAvatarUploading}
                        className="text-[11px] text-zinc-600 transition hover:text-zinc-400 disabled:opacity-50"
                      >
                        Reset to default
                      </button>
                    </div>
                  </div>
                  <input
                    ref={aiAvatarRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadAiAvatar(file);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── General Website Theme (collapsed by default) ──────────────── */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
            <SectionHeader
              label="General Website Theme"
              expanded={themesExpanded}
              onToggle={() => setThemesExpanded((v) => !v)}
              badge={activeThemeLabel}
            />

            {themesExpanded && (
              <div className="mt-3 space-y-4">

                {/* Holidays */}
                <div>
                  <p className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-zinc-700">Holidays</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {JEWISH_THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => setPendingTheme(pendingTheme === theme.id ? null : theme.id)}
                        disabled={saving}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition disabled:opacity-50 ${themeChipClass(theme.id)}`}
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: theme.vars['--th-accent'] ?? '#6b7c3a' }}
                        />
                        <span className="flex-1 truncate font-medium">{theme.name}</span>
                        <span className="shrink-0 text-sm">{theme.emoji}</span>
                        {activeTheme === theme.id && pendingTheme !== theme.id && (
                          <span className="shrink-0 text-[8px] text-zinc-400">●</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Commercial */}
                <div>
                  <p className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-zinc-700">Commercial</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {COMMERCIAL_THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => setPendingTheme(pendingTheme === theme.id ? null : theme.id)}
                        disabled={saving}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition disabled:opacity-50 ${themeChipClass(theme.id)}`}
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: theme.vars['--th-accent'] ?? '#6b7c3a' }}
                        />
                        <span className="flex-1 truncate font-medium">{theme.name}</span>
                        <span className="shrink-0 text-sm">{theme.emoji}</span>
                        {activeTheme === theme.id && pendingTheme !== theme.id && (
                          <span className="shrink-0 text-[8px] text-zinc-400">●</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reset to default chip */}
                {activeTheme !== 'default' && (
                  <button
                    onClick={() => setPendingTheme(pendingTheme === 'default' ? null : 'default')}
                    disabled={saving}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition disabled:opacity-50 ${themeChipClass('default')}`}
                  >
                    <span className="font-medium text-zinc-500">✕ Reset to default</span>
                  </button>
                )}

                {/* ── Confirm panel — appears when a theme is selected ── */}
                {pendingTheme !== null && pendingTheme !== activeTheme && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="mb-3 flex items-start gap-2">
                      <span className="mt-px text-amber-400">⚠</span>
                      <p className="text-[11px] leading-relaxed text-amber-300/80">
                        This will update the storefront design for <span className="font-semibold text-amber-300">all visitors</span>.
                        The change goes live the moment you apply it.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPendingTheme(null)}
                        className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 py-2 text-xs font-semibold text-zinc-400 transition hover:text-zinc-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => void applyTheme(pendingTheme)}
                        disabled={saving}
                        className="flex-1 rounded-lg border border-olive-500/40 bg-olive-500/15 py-2 text-xs font-semibold text-olive-300 transition hover:bg-olive-500/25 disabled:opacity-50"
                      >
                        {saving ? 'Applying…' : 'Apply theme'}
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-5 py-4">
          <p className="text-[10px] text-zinc-700">
            Changes here affect all customers and agents across the entire store.
          </p>
        </div>
      </div>
    </>
  );
}
