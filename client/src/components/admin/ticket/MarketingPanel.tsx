import { useState } from 'react';
import { adminApi } from '../../../services/adminApi';
import { useToast } from '../../Toast';
import type { AdminTicket, AdminProduct, CustomerProfileResult, RemarketingPitchResult } from '../../../types/admin';
import { RiskPill, RiskBar, ARCHETYPE_META, SENTIMENT_META } from './TicketSideHelpers';

interface MarketingPanelProps {
  ticket: AdminTicket;
  onAppendToReply: (text: string) => void;
  onProfileChange: (profile: CustomerProfileResult | null) => void;
}

export default function MarketingPanel({ ticket, onAppendToReply, onProfileChange }: MarketingPanelProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  // Customer Intelligence — seed from persisted ticket data
  const [profile, setProfile] = useState<CustomerProfileResult | null>(() => {
    if (!ticket.mktArchetype) return null;
    return {
      archetype:           ticket.mktArchetype as CustomerProfileResult['archetype'],
      archetypeLabel:      ticket.mktArchetypeLabel ?? '',
      archetypeReason:     ticket.mktArchetypeReason ?? '',
      refundIntent:        (ticket.mktRefundIntent ?? 'low') as CustomerProfileResult['refundIntent'],
      refundIntentReason:  ticket.mktRefundIntentReason ?? '',
      churnRisk:           (ticket.mktChurnRisk ?? 'low') as CustomerProfileResult['churnRisk'],
      sentiment:           (ticket.mktSentiment ?? 'neutral') as CustomerProfileResult['sentiment'],
      lifetimeValueSignal: (ticket.mktLifetimeValueSignal ?? 'medium') as CustomerProfileResult['lifetimeValueSignal'],
      recommendedApproach: ticket.mktRecommendedApproach ?? '',
    };
  });
  const [profiling, setProfiling] = useState(false);

  // Remarketing
  const [remarketMode, setRemarketMode] = useState<'auto' | 'manual'>('auto');
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [pitch, setPitch] = useState<RemarketingPitchResult | null>(null);
  const [remarketing, setRemarketing] = useState(false);

  async function handleAnalyzeProfile() {
    setProfiling(true);
    try {
      const history = ticket.replies
        .map((r) => `${r.isAgent ? 'Agent' : 'Customer'} (${r.authorName}): ${r.body}`)
        .join('\n\n');
      const { data } = await adminApi.ai.customerProfile({
        ticketId:           ticket._id,
        subject:            ticket.title,
        message:            ticket.description,
        productTitle:       ticket.product?.name,
        conversationHistory: history || undefined,
      });
      setProfile(data);
      onProfileChange(data);
      toast('Customer profile ready', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Profile analysis failed', 'error');
    } finally {
      setProfiling(false);
    }
  }

  async function loadProducts() {
    if (productsLoaded) return;
    try {
      const res = await adminApi.products();
      setProducts(res.data);
      setProductsLoaded(true);
    } catch { /* silent */ }
  }

  async function handleRemarket() {
    setRemarketing(true);
    setPitch(null);
    try {
      const { data } = await adminApi.ai.remarket({
        subject:           ticket.title,
        message:           ticket.description,
        productTitle:      ticket.product?.name,
        customerArchetype: profile?.archetype,
        sentiment:         profile?.sentiment,
        targetProductId:   remarketMode === 'manual' && selectedProductId ? selectedProductId : undefined,
      });
      setPitch(data);
      toast('Recommendation ready', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Remarketing failed', 'error');
    } finally {
      setRemarketing(false);
    }
  }

  function handleModeChange(mode: 'auto' | 'manual') {
    setRemarketMode(mode);
    setPitch(null);
    if (mode === 'manual') void loadProducts();
  }

  const archetypeMeta = profile ? (ARCHETYPE_META[profile.archetype] ?? ARCHETYPE_META.casual_buyer) : null;
  const sentimentMeta = profile ? (SENTIMENT_META[profile.sentiment] ?? SENTIMENT_META.neutral) : null;

  return (
    <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.03] overflow-hidden">
      {/* Header / Toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-rose-500/5"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">📊</span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-400/80">Marketing Tools</span>
        </div>
        <svg
          viewBox="0 0 12 12" fill="none"
          className={`h-3 w-3 text-rose-400/50 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="border-t border-rose-500/15 px-4 pb-4 pt-3 space-y-5">

          {/* ── Section 1: Customer Intelligence ── */}
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Customer Intelligence</p>
                {ticket.mktProfiledAt && (
                  <p className="mt-0.5 text-[9px] text-zinc-700">
                    Last run {new Date(ticket.mktProfiledAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => void handleAnalyzeProfile()}
                disabled={profiling}
                className="flex items-center gap-1 rounded border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-40"
              >
                <span>{profiling ? '⟳' : '✦'}</span>
                {profiling ? 'Analysing…' : profile ? 'Refresh' : 'Analyse'}
              </button>
            </div>

            {profiling && !profile && (
              <div className="space-y-1.5 animate-pulse">
                {[1,2,3].map((i) => <div key={i} className="h-2.5 rounded bg-zinc-800" style={{ width: `${90 - i * 15}%` }} />)}
              </div>
            )}

            {!profile && !profiling && (
              <p className="text-xs text-zinc-600">Click Analyse to profile this customer's intent, archetype, and churn risk.</p>
            )}

            {profile && (
              <div className="space-y-3">
                {/* Archetype */}
                <div className="flex items-start gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                  <span className="text-base leading-none mt-0.5">{archetypeMeta?.icon}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${archetypeMeta?.color}`}>
                        {profile.archetypeLabel}
                      </span>
                      <span className={`text-sm font-bold ${sentimentMeta?.color}`}>{sentimentMeta?.icon}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">{profile.archetypeReason}</p>
                  </div>
                </div>

                {/* Risk gauges */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Refund Risk</span>
                      <RiskPill level={profile.refundIntent} label={profile.refundIntent} />
                    </div>
                    <RiskBar level={profile.refundIntent} />
                    <p className="mt-1 text-[9px] text-zinc-600 leading-snug">{profile.refundIntentReason}</p>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Churn Risk</span>
                      <RiskPill level={profile.churnRisk} label={profile.churnRisk} />
                    </div>
                    <RiskBar level={profile.churnRisk} />
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-700">LTV</span>
                      <RiskPill level={profile.lifetimeValueSignal} label={profile.lifetimeValueSignal} />
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* ── Divider ── */}
          <div className="h-px bg-zinc-800" />

          {/* ── Section 2: AI Remarketing ── */}
          <div>
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Product Remarketing</p>

            {/* Mode selector */}
            <div className="mb-3 flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
              {(['auto', 'manual'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode)}
                  className={`flex-1 rounded-md py-1.5 text-[10px] font-semibold uppercase tracking-wider transition ${
                    remarketMode === mode
                      ? 'bg-zinc-700 text-zinc-100'
                      : 'text-zinc-600 hover:text-zinc-400'
                  }`}
                >
                  {mode === 'auto' ? '✦ AI picks' : '☰ Manual'}
                </button>
              ))}
            </div>

            {/* Manual: product selector */}
            {remarketMode === 'manual' && (
              <div className="mb-3">
                <select
                  value={selectedProductId}
                  onChange={(e) => { setSelectedProductId(e.target.value); setPitch(null); }}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-rose-500/30"
                >
                  <option value="">— Select a product —</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>{p.name} · {p.category}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Generate button */}
            <button
              onClick={() => void handleRemarket()}
              disabled={remarketing || (remarketMode === 'manual' && !selectedProductId)}
              className="w-full rounded-lg border border-rose-500/30 bg-rose-500/10 py-2 text-[10px] font-semibold uppercase tracking-wider text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-40"
            >
              {remarketing
                ? '✦ Generating…'
                : pitch
                  ? '↻ Regenerate'
                  : remarketMode === 'auto'
                    ? '✦ Generate Recommendation'
                    : '✦ Generate Pitch'}
            </button>

            {/* Result */}
            {pitch && (
              <div className="mt-3 space-y-2.5">
                {!pitch.shouldPitch ? (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500">Not recommended</p>
                    <p className="mt-1 text-[11px] text-zinc-500">AI detected this customer may not be receptive to a pitch right now (high refund intent or hostile sentiment).</p>
                  </div>
                ) : (
                  <>
                    {/* Product card */}
                    <div className="flex items-center gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900 p-2.5">
                      {pitch.imageUrl ? (
                        <img src={pitch.imageUrl} alt={pitch.productName} className="h-12 w-12 shrink-0 rounded-md object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-zinc-800 text-lg text-zinc-700">☐</div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-zinc-200">{pitch.productName}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">{pitch.matchReason}</p>
                      </div>
                    </div>

                    {/* Pitch preview */}
                    {pitch.appendedMessage && (
                      <div className="rounded-lg border border-rose-500/15 bg-zinc-900 px-3 py-2.5">
                        <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-600">Message Add-on Preview</p>
                        <p className="text-[11px] leading-relaxed text-zinc-400 whitespace-pre-wrap">{pitch.appendedMessage}</p>
                        {pitch.productSlug && (
                          <p className="mt-2 text-[10px] text-zinc-500 italic">
                            + View product: …/products?product={pitch.productSlug}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {pitch.appendedMessage && (
                        <button
                          onClick={() => {
                            const productLink = pitch.productSlug
                              ? `\n\nView product: ${window.location.origin}/products?product=${pitch.productSlug}`
                              : '';
                            onAppendToReply('\n\n' + pitch.appendedMessage + productLink);
                            toast('Added to reply', 'success');
                          }}
                          className="flex-1 rounded border border-olive-500/30 bg-olive-500/10 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-olive-400 transition hover:bg-olive-500/20"
                        >
                          + Append to Reply
                        </button>
                      )}
                      {pitch.appendedMessage && (
                        <button
                          onClick={() => {
                            const productLink = pitch.productSlug
                              ? `\n\nView product: ${window.location.origin}/products?product=${pitch.productSlug}`
                              : '';
                            void navigator.clipboard.writeText(pitch.appendedMessage + productLink);
                            toast('Copied', 'success');
                          }}
                          className="rounded border border-zinc-800 px-3 py-1.5 text-[10px] font-semibold text-zinc-500 transition hover:text-zinc-300"
                        >
                          Copy
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
