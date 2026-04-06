import { useState, useEffect, useRef } from 'react';
import { adminApi } from '../../services/adminApi';
import type { StoreInsightsResult } from '../../types/admin';
import { useToast } from '../Toast';

// ── Helpers ──────────────────────────────────────────────────────────────────

const URGENCY_COLOR: Record<string, string> = {
  high:   'border-red-500/30 bg-red-500/10 text-red-400',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  low:    'border-green-500/30 bg-green-500/10 text-green-400',
};

const SCORE_COLOR = (s: number) =>
  s >= 7 ? 'text-green-400' : s >= 4 ? 'text-amber-400' : 'text-red-400';

function ScoreRing({ score }: { score: number }) {
  const pct = score / 10;
  const r = 26;
  const circ = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 64 64" className="h-20 w-20 -rotate-90">
      <circle cx="32" cy="32" r={r} fill="none" stroke="#27272a" strokeWidth="6" />
      <circle
        cx="32" cy="32" r={r} fill="none"
        stroke={score >= 7 ? '#86efac' : score >= 4 ? '#fcd34d' : '#f87171'}
        strokeWidth="6"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Download helper ───────────────────────────────────────────────────────────

function downloadReport(insights: StoreInsightsResult, generatedAt: string) {
  const URGENCY_ICON: Record<string, string> = { high: '[HIGH]', medium: '[MED]', low: '[LOW]' };
  const lines = [
    `AI STORE INSIGHTS REPORT`,
    `Generated: ${generatedAt}`,
    ``,
    `═══════════════════════════════════════`,
    `STORE HEALTH SCORE: ${insights.storeHealthScore.toFixed(1)} / 10`,
    `═══════════════════════════════════════`,
    ``,
    insights.executiveSummary,
    ``,
    `─── PRIORITY ACTIONS (Top 5) ───────────`,
    ...insights.priorityActions.map((a) => `${a.rank}. ${a.action}\n   Why: ${a.rationale}`),
    ``,
    `─── TOP ISSUES ─────────────────────────`,
    ...insights.topIssues.map((i) => `${URGENCY_ICON[i.urgency] ?? '[?]'} ${i.issue}\n   Recommendation: ${i.recommendation}`),
    ``,
    `─── CUSTOMER INTELLIGENCE ──────────────`,
    ...insights.customerIntel.map((c) => `• ${c.insight}\n  Action: ${c.action}`),
    ``,
    `─── REVENUE RISKS ───────────────────────`,
    ...insights.revenueRisks.map((r) => `${URGENCY_ICON[r.magnitude] ?? '[?]'} ${r.risk}\n   Mitigation: ${r.mitigation}`),
    ``,
    `─── OPPORTUNITIES ───────────────────────`,
    ...insights.opportunities.map((o) => `✦ ${o.opportunity}\n  Potential Impact: ${o.potentialImpact}`),
    ``,
    `──────────────────────────────────────���──`,
    `Powered by Agilate AI Support Workspace`,
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `store-insights-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  open: boolean;
  onClose: () => void;
}

// ── Fake progress bar ─────────────────────────────────────────────────────────

function useProgressBar(active: boolean) {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active) {
      setProgress(0);
      // Advance to ~85% over ~28 s, then hold
      intervalRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 85) { clearInterval(intervalRef.current!); return p; }
          // Slower near the top
          const step = p < 40 ? 3 : p < 65 ? 1.5 : 0.5;
          return Math.min(85, p + step);
        });
      }, 500);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      // Jump to 100 on completion, then fade out
      setProgress(100);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active]);

  return progress;
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function InsightsPanel({ open, onClose }: Props) {
  const { toast } = useToast();
  const [loading,     setLoading]     = useState(false);
  const [emailing,    setEmailing]    = useState(false);
  const [insights,    setInsights]    = useState<StoreInsightsResult | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [cached,      setCached]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const progress = useProgressBar(loading);

  // Auto-load when panel opens (use cache if available)
  useEffect(() => {
    if (!open || insights) return;
    void load(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  async function load(refresh: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.aiInsights(refresh);
      setInsights(res.data);
      setGeneratedAt(res.generatedAt);
      setCached(res.cached && !refresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate insights');
    } finally {
      setLoading(false);
    }
  }

  async function handleEmail() {
    setEmailing(true);
    try {
      await adminApi.emailAiInsights();
      toast('Report sent to your email', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to send email', 'error');
    } finally {
      setEmailing(false);
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />

      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl transition-transform duration-300 overflow-hidden ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-500">AI Intelligence</p>
            <h2 className="text-sm font-bold text-zinc-100">Store Insights</h2>
            {generatedAt && (
              <p className="mt-0.5 text-[10px] text-zinc-600">
                {cached ? 'Cached · ' : ''}Generated {generatedAt}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {insights && (
              <>
                <button
                  onClick={() => void handleEmail()}
                  disabled={emailing}
                  className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[10px] font-semibold text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-40"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3"><rect x="1" y="3" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1 5l7 5 7-5" stroke="currentColor" strokeWidth="1.2"/></svg>
                  {emailing ? 'Sending…' : 'Email'}
                </button>
                <button
                  onClick={() => downloadReport(insights, generatedAt ?? '')}
                  className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[10px] font-semibold text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
                >
                  <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3"><path d="M8 2v8m0 0l-3-3m3 3l3-3M2 12h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Download
                </button>
                <button
                  onClick={() => void load(true)}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-violet-400 transition hover:bg-violet-500/15 disabled:opacity-40"
                >
                  ↻ Refresh
                </button>
              </>
            )}
            <button onClick={onClose} className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300">
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-6">
              <div className="w-full max-w-xs">
                <div className="mb-3 text-center">
                  <p className="text-sm font-semibold text-zinc-300">Analysing your store data…</p>
                  <p className="mt-1 text-xs text-zinc-600">This takes 15–30 seconds</p>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-2 text-center text-[10px] text-zinc-700">{Math.round(progress)}%</p>
              </div>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-5 text-center">
              <p className="text-sm text-red-400">{error}</p>
              <button onClick={() => void load(false)} className="mt-3 text-xs font-semibold text-olive-400 hover:underline">Retry</button>
            </div>
          )}

          {/* Insights */}
          {!loading && !error && insights && (
            <div className="space-y-8">

              {/* Health score + summary */}
              <div className="flex items-start gap-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                <div className="relative shrink-0">
                  <ScoreRing score={insights.storeHealthScore} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-xl font-bold ${SCORE_COLOR(insights.storeHealthScore)}`}>
                      {insights.storeHealthScore.toFixed(1)}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Store Health Score</p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">{insights.executiveSummary}</p>
                </div>
              </div>

              {/* Priority actions */}
              <Section title="Priority Actions" icon="🎯">
                <ol className="space-y-3">
                  {insights.priorityActions.map((a) => (
                    <li key={a.rank} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10 text-[11px] font-bold text-violet-400">
                        {a.rank}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-zinc-200">{a.action}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">{a.rationale}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Section>

              {/* Top issues */}
              <Section title="Top Issues" icon="⚠️">
                <div className="space-y-3">
                  {insights.topIssues.map((issue, i) => (
                    <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase ${URGENCY_COLOR[issue.urgency] ?? URGENCY_COLOR.low}`}>
                          {issue.urgency}
                        </span>
                        <p className="text-sm font-semibold text-zinc-200">{issue.issue}</p>
                      </div>
                      <p className="mt-2 text-xs text-zinc-500">→ {issue.recommendation}</p>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Customer intel */}
              <Section title="Customer Intelligence" icon="👥">
                <div className="space-y-3">
                  {insights.customerIntel.map((c, i) => (
                    <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                      <p className="text-sm text-zinc-300">{c.insight}</p>
                      <p className="mt-1.5 text-xs font-semibold text-olive-500">Action: <span className="font-normal text-olive-400">{c.action}</span></p>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Revenue risks */}
              <Section title="Revenue Risks" icon="💸">
                <div className="space-y-3">
                  {insights.revenueRisks.map((r, i) => (
                    <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase ${URGENCY_COLOR[r.magnitude] ?? URGENCY_COLOR.low}`}>
                          {r.magnitude}
                        </span>
                        <p className="text-sm font-semibold text-zinc-200">{r.risk}</p>
                      </div>
                      <p className="mt-2 text-xs text-zinc-500">Mitigation: {r.mitigation}</p>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Opportunities */}
              <Section title="Opportunities" icon="✦">
                <div className="space-y-3">
                  {insights.opportunities.map((o, i) => (
                    <div key={i} className="rounded-xl border border-olive-500/20 bg-olive-500/5 p-4">
                      <p className="text-sm font-semibold text-zinc-200">{o.opportunity}</p>
                      <p className="mt-1 text-xs text-olive-600">Potential impact: <span className="text-olive-400">{o.potentialImpact}</span></p>
                    </div>
                  ))}
                </div>
              </Section>

            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
        <span>{icon}</span>{title}
      </p>
      {children}
    </div>
  );
}
