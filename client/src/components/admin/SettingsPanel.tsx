import { useEffect, useState, useRef } from 'react';
import { adminApi } from '../../services/adminApi';
import type { AppSettings } from '../../types/admin';
import { THEMES, applyTheme, getTheme } from '../../themes/seasonal';

interface Props {
  open: boolean;
  onClose: () => void;
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

function SectionHeader({ label, expanded, onToggle }: { label: string; expanded: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-lg px-1 py-0.5 text-left transition hover:bg-zinc-900/60"
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{label}</p>
      <svg
        viewBox="0 0 12 12"
        fill="none"
        className={`h-3 w-3 shrink-0 text-zinc-600 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`}
      >
        <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

const JEWISH_THEMES     = THEMES.filter((t) => t.group === 'jewish');
const COMMERCIAL_THEMES = THEMES.filter((t) => t.group === 'commercial');

export default function SettingsPanel({ open, onClose }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [aiExpanded, setAiExpanded]     = useState(true);
  const [themesExpanded, setThemesExpanded] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    adminApi.settings.get()
      .then((res) => {
        setSettings(res.data);
        if (res.data.activeTheme) applyTheme(res.data.activeTheme);
      })
      .catch((e: Error) => setError(e.message));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  async function toggle(key: keyof AppSettings, value: boolean) {
    if (!settings) return;
    const optimistic = { ...settings, [key]: value };
    setSettings(optimistic);
    setSaving(true);
    setError(null);
    try {
      const res = await adminApi.settings.update({ [key]: value });
      setSettings(res.data);
    } catch (e) {
      setSettings(settings);
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function setTheme(themeId: string) {
    if (!settings) return;
    applyTheme(themeId);
    const optimistic = { ...settings, activeTheme: themeId === 'default' ? null : themeId };
    setSettings(optimistic);
    setSaving(true);
    setError(null);
    try {
      const res = await adminApi.settings.update({ activeTheme: themeId === 'default' ? null : themeId });
      setSettings(res.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const activeTheme = settings?.activeTheme ?? 'default';

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
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Workspace</p>
            <h2 className="text-sm font-bold text-zinc-100">Settings</h2>
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
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* ── AI Settings ──────────────────────────────────────────────── */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
            <SectionHeader label="AI Settings" expanded={aiExpanded} onToggle={() => setAiExpanded((v) => !v)} />

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
              </div>
            )}
          </div>

          {/* ── Themes ───────────────────────────────────────────────────── */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <SectionHeader label="Themes" expanded={themesExpanded} onToggle={() => setThemesExpanded((v) => !v)} />
              </div>
              {activeTheme !== 'default' && themesExpanded && (
                <button
                  onClick={() => void setTheme('default')}
                  className="shrink-0 text-[10px] text-zinc-600 transition hover:text-zinc-400"
                >
                  Reset
                </button>
              )}
            </div>

            {themesExpanded && (
              <div className="mt-3 space-y-4">
                {/* Active theme preview */}
                {activeTheme !== 'default' && (() => {
                  const th = getTheme(activeTheme);
                  return (
                    <div
                      className="overflow-hidden rounded-lg border border-zinc-700"
                      style={{ background: th.banner?.gradient ?? '#18181b' }}
                    >
                      <div className="px-3.5 py-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-widest text-white/50">Active</p>
                        <p className="mt-0.5 text-sm font-bold text-white">
                          {th.emoji} {th.name}
                          {th.nameHe && <span className="ms-2 text-white/60">{th.nameHe}</span>}
                        </p>
                        {th.banner && (
                          <p className="mt-0.5 text-[11px] text-white/70 leading-snug">{th.banner.text}</p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Holidays */}
                <div>
                  <p className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-zinc-700">Holidays</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {JEWISH_THEMES.map((theme) => {
                      const isActive = activeTheme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          onClick={() => void setTheme(theme.id)}
                          disabled={saving}
                          className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition disabled:opacity-50 ${
                            isActive
                              ? 'border-zinc-500 bg-zinc-800 text-zinc-100'
                              : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                          }`}
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: theme.vars['--th-accent'] ?? '#6b7c3a' }}
                          />
                          <span className="flex-1 truncate font-medium">{theme.name}</span>
                          <span className="shrink-0 text-sm">{theme.emoji}</span>
                          {isActive && <span className="shrink-0 text-[8px] text-zinc-400">●</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Commercial */}
                <div>
                  <p className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-zinc-700">Commercial</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {COMMERCIAL_THEMES.map((theme) => {
                      const isActive = activeTheme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          onClick={() => void setTheme(theme.id)}
                          disabled={saving}
                          className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition disabled:opacity-50 ${
                            isActive
                              ? 'border-zinc-500 bg-zinc-800 text-zinc-100'
                              : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                          }`}
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: theme.vars['--th-accent'] ?? '#6b7c3a' }}
                          />
                          <span className="flex-1 truncate font-medium">{theme.name}</span>
                          <span className="shrink-0 text-sm">{theme.emoji}</span>
                          {isActive && <span className="shrink-0 text-[8px] text-zinc-400">●</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-5 py-4">
          <p className="text-[10px] text-zinc-700">
            Theme changes apply to the storefront immediately. AI settings take effect on new tickets.
          </p>
        </div>
      </div>
    </>
  );
}
