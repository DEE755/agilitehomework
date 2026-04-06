import { useState, useEffect, useRef, useCallback } from 'react';
import { adminApi } from '../../services/adminApi';
import type {
  StoreInsightsResult,
  InsightsSnapshotMeta,
  InsightsSnapshot,
  InsightsComparison,
} from '../../types/admin';
import { useToast } from '../Toast';

// ── Helpers ──────────────────────────────────────────────────────────────────

const URGENCY_COLOR: Record<string, string> = {
  high:   'border-red-500/30 bg-red-500/10 text-red-400',
  medium: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  low:    'border-green-500/30 bg-green-500/10 text-green-400',
};

const VERDICT_COLOR: Record<string, string> = {
  good:    'border-green-500/30 bg-green-500/10 text-green-400',
  ok:      'border-amber-500/30 bg-amber-500/10 text-amber-400',
  concern: 'border-red-500/30 bg-red-500/10 text-red-400',
};

const AI_EFFECTIVENESS_COLOR: Record<string, string> = {
  high:   'text-green-400',
  medium: 'text-amber-400',
  low:    'text-red-400',
};

const SCORE_COLOR = (s: number) =>
  s >= 7 ? 'text-green-400' : s >= 4 ? 'text-amber-400' : 'text-red-400';

const SCORE_STROKE = (s: number) =>
  s >= 7 ? '#86efac' : s >= 4 ? '#fcd34d' : '#f87171';

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r    = size * 0.406;
  const circ = 2 * Math.PI * r;
  const cx   = size / 2;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={`-rotate-90`} style={{ width: size, height: size }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#27272a" strokeWidth={size * 0.075} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={SCORE_STROKE(score)}
        strokeWidth={size * 0.075}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - score / 10)}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Trend chart ───────────────────────────────────────────────────────────────

function TrendChart({
  snapshots,
  selectedId,
  onSelect,
}: {
  snapshots: InsightsSnapshotMeta[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (snapshots.length === 0) return null;
  const W = 460; const H = 80; const PAD = 16;
  const inner = W - PAD * 2;
  const pts = [...snapshots].reverse(); // oldest first for left-to-right
  const xs = pts.map((_, i) => PAD + (pts.length === 1 ? inner / 2 : (i / (pts.length - 1)) * inner));
  const ys = pts.map((p) => PAD + (1 - p.healthScore / 10) * (H - PAD * 2));

  const d = pts.length === 1
    ? ''
    : pts.map((_, i) => `${i === 0 ? 'M' : 'L'}${xs[i]},${ys[i]}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      {/* Grid lines at 0,5,10 */}
      {[0, 5, 10].map((v) => {
        const y = PAD + (1 - v / 10) * (H - PAD * 2);
        return (
          <line key={v} x1={PAD} y1={y} x2={W - PAD} y2={y}
            stroke="#3f3f46" strokeWidth="0.5" strokeDasharray="3 4" />
        );
      })}
      {/* Trend line */}
      {d && <path d={d} fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
      {/* Dots */}
      {pts.map((p, i) => (
        <g key={p._id} className="cursor-pointer" onClick={() => onSelect(p._id)}>
          <circle cx={xs[i]} cy={ys[i]} r={8} fill="transparent" />
          <circle
            cx={xs[i]} cy={ys[i]} r={selectedId === p._id ? 5 : 3.5}
            fill={SCORE_STROKE(p.healthScore)}
            stroke={selectedId === p._id ? 'white' : 'transparent'}
            strokeWidth="1.5"
          />
        </g>
      ))}
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
    `─── VENDOR / TEAM PERFORMANCE ───────────`,
    `Operational Score: ${insights.vendorPerformance.operationalScore.toFixed(1)} / 10`,
    insights.vendorPerformance.summary,
    ``,
    `Agent Efficiency Metrics:`,
    ...insights.vendorPerformance.agentEfficiency.map((m) => `[${m.verdict.toUpperCase()}] ${m.metric}: ${m.reading}`),
    ``,
    `Blind Spots:`,
    ...insights.vendorPerformance.blindSpots.map((b) => `⚠ ${b.issue}\n   Impact: ${b.impact}\n   Fix: ${b.fix}`),
    ``,
    `AI Agent Role (${insights.vendorPerformance.aiAgentRole.effectiveness}): ${insights.vendorPerformance.aiAgentRole.finding}`,
    ``,
    `Strengths:`,
    ...insights.vendorPerformance.strengths.map((s) => `✓ ${s}`),
    ``,
    `───────────────────────────────────────────`,
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

// ── Progress bar hook ─────────────────────────────────────────────────────────

function useProgressBar(active: boolean) {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active) {
      setProgress(0);
      intervalRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 85) { clearInterval(intervalRef.current!); return p; }
          const step = p < 40 ? 3 : p < 65 ? 1.5 : 0.5;
          return Math.min(85, p + step);
        });
      }, 500);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setProgress(100);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active]);

  return progress;
}

// ── Main panel ────────────────────────────────────────────────────────────────

interface Props { open: boolean; onClose: () => void; }

export default function InsightsPanel({ open, onClose }: Props) {
  const { toast } = useToast();

  // Current insights
  const [loading,     setLoading]     = useState(false);
  const [emailing,    setEmailing]    = useState(false);
  const [insights,    setInsights]    = useState<StoreInsightsResult | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [cached,      setCached]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const progress = useProgressBar(loading);

  // History
  const [tab,         setTab]          = useState<'current' | 'history'>('current');
  const [history,     setHistory]      = useState<InsightsSnapshotMeta[]>([]);
  const [histLoading, setHistLoading]  = useState(false);
  const [selectedSnap, setSelectedSnap] = useState<InsightsSnapshot | null>(null);
  const [snapLoading,  setSnapLoading]  = useState(false);

  // Comparison
  const [compareTarget, setCompareTarget]   = useState<string | null>(null);
  const [comparison,    setComparison]      = useState<InsightsComparison | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Keyboard close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Auto-load on open
  useEffect(() => {
    if (!open) return;
    if (!insights) void loadCurrent(false);
    if (history.length === 0) void loadHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadCurrent(refresh: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.aiInsights(refresh);
      setInsights(res.data);
      setGeneratedAt(res.generatedAt);
      setCached(res.cached && !refresh);
      if (refresh) await loadHistory(); // refresh history list too
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate insights');
    } finally {
      setLoading(false);
    }
  }

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const res = await adminApi.insightsHistory();
      setHistory(res.data);
    } catch { /* non-critical */ }
    finally { setHistLoading(false); }
  }, []);

  async function loadSnapshot(id: string) {
    setSnapLoading(true);
    setSelectedSnap(null);
    setComparison(null);
    setCompareTarget(null);
    try {
      const res = await adminApi.insightsSnapshot(id);
      setSelectedSnap(res.data);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load snapshot', 'error');
    } finally {
      setSnapLoading(false);
    }
  }

  async function runComparison(idA: string, idB: string) {
    setCompareLoading(true);
    setComparison(null);
    try {
      const res = await adminApi.compareInsights(idA, idB);
      setComparison(res.data);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Comparison failed', 'error');
    } finally {
      setCompareLoading(false);
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

  // The insights data to display (current or historical)
  const displayInsights = tab === 'history' && selectedSnap ? selectedSnap.data : insights;
  const displayDate     = tab === 'history' && selectedSnap
    ? new Date(selectedSnap.generatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : generatedAt;

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
            {displayDate && (
              <p className="mt-0.5 text-[10px] text-zinc-600">
                {tab === 'current' && cached ? 'Cached · ' : ''}
                {tab === 'history' && selectedSnap ? 'Viewing past snapshot · ' : ''}
                {displayDate}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {tab === 'current' && insights && (
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
                  onClick={() => void loadCurrent(true)}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-violet-400 transition hover:bg-violet-500/15 disabled:opacity-40"
                >
                  ↻ Refresh
                </button>
              </>
            )}
            {tab === 'history' && selectedSnap && (
              <button
                onClick={() => downloadReport(selectedSnap.data, new Date(selectedSnap.generatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }))}
                className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[10px] font-semibold text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
              >
                <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3"><path d="M8 2v8m0 0l-3-3m3 3l3-3M2 12h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Download
              </button>
            )}
            <button onClick={onClose} className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300">
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b border-zinc-800">
          {(['current', 'history'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition ${
                tab === t
                  ? 'border-b-2 border-violet-500 text-violet-400'
                  : 'text-zinc-600 hover:text-zinc-300'
              }`}
            >
              {t === 'current' ? 'Latest Analysis' : `History${history.length > 0 ? ` (${history.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">

          {/* ── CURRENT TAB ── */}
          {tab === 'current' && (
            <>
              {loading && (
                <div className="flex flex-col items-center justify-center py-24 gap-6">
                  <div className="w-full max-w-xs">
                    <div className="mb-3 text-center">
                      <p className="text-sm font-semibold text-zinc-300">Analysing your store data…</p>
                      <p className="mt-1 text-xs text-zinc-600">This takes 15–30 seconds</p>
                    </div>
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

              {!loading && error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-5 text-center">
                  <p className="text-sm text-red-400">{error}</p>
                  <button onClick={() => void loadCurrent(false)} className="mt-3 text-xs font-semibold text-olive-400 hover:underline">Retry</button>
                </div>
              )}

              {!loading && !error && insights && (
                <InsightsContent insights={insights} />
              )}
            </>
          )}

          {/* ── HISTORY TAB ── */}
          {tab === 'history' && (
            <div className="space-y-6">
              {/* Trend chart */}
              {history.length >= 2 && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 pt-4 pb-2">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                    Health Score Trend
                    <span className="ml-2 font-normal text-zinc-700">— click a dot to view that snapshot</span>
                  </p>
                  <TrendChart
                    snapshots={history}
                    selectedId={selectedSnap?._id ?? null}
                    onSelect={(id) => void loadSnapshot(id)}
                  />
                  <div className="mt-1 flex justify-between text-[9px] text-zinc-700">
                    <span>{history.length > 0 ? new Date(history[history.length - 1].generatedAt).toLocaleDateString('en-GB') : ''}</span>
                    <span>{history.length > 0 ? new Date(history[0].generatedAt).toLocaleDateString('en-GB') : ''}</span>
                  </div>
                </div>
              )}

              {/* History list */}
              {histLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-zinc-900 border border-zinc-800" />)}
                </div>
              ) : history.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-8 text-center">
                  <p className="text-sm text-zinc-500">No saved snapshots yet.</p>
                  <p className="mt-1 text-xs text-zinc-700">Insights are saved automatically each time you generate them.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((snap) => {
                    const isSelected = selectedSnap?._id === snap._id;
                    return (
                      <button
                        key={snap._id}
                        onClick={() => void loadSnapshot(snap._id)}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                          isSelected
                            ? 'border-violet-500/40 bg-violet-500/10'
                            : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold text-zinc-200">
                              {new Date(snap.generatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                            <p className="mt-0.5 text-[10px] text-zinc-600">
                              {snap.metrics.totalTickets} tickets · {snap.metrics.humanAgentCount} agents
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${SCORE_COLOR(snap.healthScore)}`}>
                              {snap.healthScore.toFixed(1)}
                            </span>
                            <span className="text-[10px] text-zinc-600">/ 10</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Snapshot detail */}
              {snapLoading && (
                <div className="flex justify-center py-10">
                  <span className="text-sm text-zinc-600">Loading snapshot…</span>
                </div>
              )}

              {!snapLoading && selectedSnap && (
                <div className="space-y-6 border-t border-zinc-800 pt-6">
                  {/* Compare toolbar */}
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Compare with another snapshot</p>
                    <div className="flex items-center gap-2">
                      <select
                        value={compareTarget ?? ''}
                        onChange={(e) => setCompareTarget(e.target.value || null)}
                        className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
                      >
                        <option value="">Select a snapshot to compare…</option>
                        {history
                          .filter((s) => s._id !== selectedSnap._id)
                          .map((s) => (
                            <option key={s._id} value={s._id}>
                              {new Date(s.generatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} — {s.healthScore.toFixed(1)}/10
                            </option>
                          ))}
                      </select>
                      <button
                        disabled={!compareTarget || compareLoading}
                        onClick={() => compareTarget && void runComparison(selectedSnap._id, compareTarget)}
                        className="rounded border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-[10px] font-semibold text-violet-400 transition hover:bg-violet-500/20 disabled:opacity-40"
                      >
                        {compareLoading ? 'Comparing…' : 'Compare with AI'}
                      </button>
                    </div>
                  </div>

                  {/* Comparison result */}
                  {comparison && <ComparisonView comparison={comparison} />}

                  {/* Full snapshot content */}
                  <InsightsContent insights={selectedSnap.data} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Comparison view ───────────────────────────────────────────────────────────

function ComparisonView({ comparison }: { comparison: InsightsComparison }) {
  const VERDICT_STYLE = {
    improving: { color: 'text-green-400', bg: 'border-green-500/20 bg-green-500/5', icon: '↑' },
    declining: { color: 'text-red-400',   bg: 'border-red-500/20 bg-red-500/5',   icon: '↓' },
    stable:    { color: 'text-zinc-400',  bg: 'border-zinc-700 bg-zinc-900/40',   icon: '→' },
  }[comparison.verdict];

  return (
    <div className={`rounded-xl border p-5 space-y-4 ${VERDICT_STYLE.bg}`}>
      <div className="flex items-center gap-3">
        <span className={`text-2xl font-black ${VERDICT_STYLE.color}`}>{VERDICT_STYLE.icon}</span>
        <div>
          <p className={`text-xs font-bold uppercase tracking-wider ${VERDICT_STYLE.color}`}>
            {comparison.verdict} · {comparison.healthScoreDelta >= 0 ? '+' : ''}{comparison.healthScoreDelta.toFixed(1)} pts
          </p>
          <p className="mt-0.5 text-sm text-zinc-300">{comparison.summary}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {comparison.improvements.length > 0 && (
          <div className="rounded-lg border border-green-500/15 bg-green-500/5 p-3">
            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-green-600">Improved</p>
            {comparison.improvements.map((m, i) => (
              <div key={i} className="mb-2 last:mb-0">
                <p className="text-[10px] font-semibold text-green-400">{m.area}</p>
                <p className="text-[10px] text-zinc-400">{m.observation}</p>
              </div>
            ))}
          </div>
        )}
        {comparison.declines.length > 0 && (
          <div className="rounded-lg border border-red-500/15 bg-red-500/5 p-3">
            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-red-600">Declined</p>
            {comparison.declines.map((m, i) => (
              <div key={i} className="mb-2 last:mb-0">
                <p className="text-[10px] font-semibold text-red-400">{m.area}</p>
                <p className="text-[10px] text-zinc-400">{m.observation}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {(comparison.newRisks.length > 0 || comparison.resolvedIssues.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {comparison.newRisks.length > 0 && (
            <div>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-amber-600">New Risks</p>
              {comparison.newRisks.map((r, i) => <p key={i} className="text-[10px] text-zinc-400">⚠ {r}</p>)}
            </div>
          )}
          {comparison.resolvedIssues.length > 0 && (
            <div>
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-green-600">Resolved</p>
              {comparison.resolvedIssues.map((r, i) => <p key={i} className="text-[10px] text-zinc-400">✓ {r}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Insights content (shared between current and historical view) ─────────────

function InsightsContent({ insights }: { insights: StoreInsightsResult }) {
  return (
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

      {/* Vendor / Team Performance */}
      {insights.vendorPerformance && (
        <Section title="Team Performance" icon="📊">
          {/* Operational score + summary */}
          <div className="mb-4 flex items-start gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="relative shrink-0">
              <ScoreRing score={insights.vendorPerformance.operationalScore} size={64} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-sm font-bold ${SCORE_COLOR(insights.vendorPerformance.operationalScore)}`}>
                  {insights.vendorPerformance.operationalScore.toFixed(1)}
                </span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Operational Score</p>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">{insights.vendorPerformance.summary}</p>
            </div>
          </div>

          {/* Agent efficiency metrics */}
          {insights.vendorPerformance.agentEfficiency.length > 0 && (
            <div className="mb-4 grid gap-2 sm:grid-cols-2">
              {insights.vendorPerformance.agentEfficiency.map((m, i) => (
                <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{m.metric}</p>
                    <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${VERDICT_COLOR[m.verdict] ?? VERDICT_COLOR.ok}`}>
                      {m.verdict}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-300">{m.reading}</p>
                </div>
              ))}
            </div>
          )}

          {/* AI agent role */}
          <div className="mb-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-500">AI Agent Effectiveness</span>
              <span className={`text-[10px] font-bold uppercase ${AI_EFFECTIVENESS_COLOR[insights.vendorPerformance.aiAgentRole.effectiveness] ?? 'text-zinc-400'}`}>
                · {insights.vendorPerformance.aiAgentRole.effectiveness}
              </span>
            </div>
            <p className="text-xs text-zinc-300">{insights.vendorPerformance.aiAgentRole.finding}</p>
          </div>

          {/* Blind spots */}
          {insights.vendorPerformance.blindSpots.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-2">Blind Spots</p>
              {insights.vendorPerformance.blindSpots.map((b, i) => (
                <div key={i} className="rounded-xl border border-red-500/15 bg-red-500/5 p-4">
                  <p className="text-sm font-semibold text-zinc-200">{b.issue}</p>
                  <p className="mt-1 text-xs text-zinc-500">Impact: {b.impact}</p>
                  <p className="mt-1 text-xs font-semibold text-red-400/80">Fix: <span className="font-normal text-red-400">{b.fix}</span></p>
                </div>
              ))}
            </div>
          )}

          {/* Strengths */}
          {insights.vendorPerformance.strengths.length > 0 && (
            <div className="rounded-xl border border-green-500/15 bg-green-500/5 p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-green-600">What's Working</p>
              <ul className="space-y-1.5">
                {insights.vendorPerformance.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                    <span className="mt-0.5 shrink-0 text-green-500">✓</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}
    </div>
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
