import { useState, useEffect, useRef } from 'react';
import { adminApi } from '../../../services/adminApi';
import { useToast } from '../../Toast';
import { productPalette } from '../../../utils/formatting';
import type { AdminTicket, CustomerProfileResult, CoachMessage } from '../../../types/admin';

const COACH_INTENTIONS = [
  {
    id: 'retention',
    label: 'Customer Retention',
    icon: '🤝',
    sub: 'Preserve the relationship and prevent churn',
    chip: 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10',
    active: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300',
  },
  {
    id: 'satisfaction',
    label: 'Satisfaction Recovery',
    icon: '⭐',
    sub: 'Turn a negative experience into a resolved, positive one',
    chip: 'border-sky-500/30 text-sky-400 hover:bg-sky-500/10',
    active: 'border-sky-500/50 bg-sky-500/15 text-sky-300',
  },
  {
    id: 'deescalation',
    label: 'De-escalation',
    icon: '🕊️',
    sub: 'Defuse emotional tension before addressing the core issue',
    chip: 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10',
    active: 'border-amber-500/50 bg-amber-500/15 text-amber-300',
  },
  {
    id: 'negotiation',
    label: 'Dispute Negotiation',
    icon: '⚖️',
    sub: 'Navigate refund or compensation toward the best mutual outcome',
    chip: 'border-red-500/30 text-red-400 hover:bg-red-500/10',
    active: 'border-red-500/50 bg-red-500/15 text-red-300',
  },
  {
    id: 'crosssell',
    label: 'Cross-sell Opportunity',
    icon: '🎯',
    sub: 'Identify the right moment to expand the customer\'s relationship with the brand',
    chip: 'border-violet-500/30 text-violet-400 hover:bg-violet-500/10',
    active: 'border-violet-500/50 bg-violet-500/15 text-violet-300',
  },
  {
    id: 'insight',
    label: 'Insight Extraction',
    icon: '💡',
    sub: 'Transform the complaint into actionable product or service intelligence',
    chip: 'border-zinc-600/40 text-zinc-400 hover:bg-zinc-800',
    active: 'border-zinc-500/50 bg-zinc-700 text-zinc-300',
  },
] as const;

const FREE_CHAT_INTENTION = {
  id: 'free' as const,
  label: 'Free Chat',
  icon: '💬',
  sub: 'Ask anything about this ticket without a specific objective',
  intentionLabel: 'General Question',
  intentionDescription: 'The agent wants to freely ask questions or explore ideas about this ticket and customer.',
};

type IntentionId = (typeof COACH_INTENTIONS)[number]['id'] | 'free';

interface CoachSlideOverProps {
  open: boolean;
  onClose: () => void;
  ticket: AdminTicket;
  profile: CustomerProfileResult | null;
  onUseInReply: (text: string) => void;
}

export default function CoachSlideOver({ open, onClose, ticket, profile, onUseInReply }: CoachSlideOverProps) {
  const { toast } = useToast();
  const [intention, setIntention] = useState<IntentionId | null>(null);
  const [history, setHistory] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const intentionMeta = intention === 'free'
    ? FREE_CHAT_INTENTION
    : intention
      ? COACH_INTENTIONS.find((i) => i.id === intention) ?? null
      : null;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading]);

  // Reset chat when closed
  useEffect(() => {
    if (!open) { setIntention(null); setHistory([]); setInput(''); }
  }, [open]);

  async function startSession(id: IntentionId) {
    setIntention(id);
    setHistory([]);
    // Free chat — don't auto-send opening briefing; let the user speak first
    if (id === 'free') return;
    const meta = COACH_INTENTIONS.find((i) => i.id === id)!;
    setLoading(true);
    try {
      const { data } = await adminApi.ai.coach({
        subject:              ticket.title,
        message:              ticket.description,
        productTitle:         ticket.product?.name,
        archetype:            profile?.archetype,
        archetypeLabel:       profile?.archetypeLabel,
        archetypeReason:      profile?.archetypeReason,
        refundIntent:         profile?.refundIntent,
        refundIntentReason:   profile?.refundIntentReason,
        churnRisk:            profile?.churnRisk,
        sentiment:            profile?.sentiment,
        lifetimeValueSignal:  profile?.lifetimeValueSignal,
        recommendedApproach:  profile?.recommendedApproach,
        aiSummary:            ticket.aiSummary,
        aiPriority:           ticket.aiPriority,
        aiSuggestedNextStep:  ticket.aiSuggestedNextStep,
        aiTags:               ticket.aiTags,
        intentionId:          id,
        intentionLabel:       meta.label,
        intentionDescription: meta.sub,
        history: [],
      });
      setHistory([{ role: 'assistant', content: data.reply }]);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Advisor unavailable', 'error');
      setIntention(null);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || !intention || loading) return;
    const meta = intention === 'free'
      ? { label: FREE_CHAT_INTENTION.intentionLabel, sub: FREE_CHAT_INTENTION.intentionDescription }
      : (COACH_INTENTIONS.find((i) => i.id === intention) ?? { label: '', sub: '' });
    const userMsg: CoachMessage = { role: 'user', content: input.trim() };
    const nextHistory = [...history, userMsg];
    setHistory(nextHistory);
    setInput('');
    setLoading(true);
    try {
      const { data } = await adminApi.ai.coach({
        subject:              ticket.title,
        message:              ticket.description,
        productTitle:         ticket.product?.name,
        archetype:            profile?.archetype,
        archetypeLabel:       profile?.archetypeLabel,
        archetypeReason:      profile?.archetypeReason,
        refundIntent:         profile?.refundIntent,
        refundIntentReason:   profile?.refundIntentReason,
        churnRisk:            profile?.churnRisk,
        sentiment:            profile?.sentiment,
        lifetimeValueSignal:  profile?.lifetimeValueSignal,
        recommendedApproach:  profile?.recommendedApproach,
        aiSummary:            ticket.aiSummary,
        aiPriority:           ticket.aiPriority,
        aiSuggestedNextStep:  ticket.aiSuggestedNextStep,
        aiTags:               ticket.aiTags,
        intentionId:          intention,
        intentionLabel:       meta.label,
        intentionDescription: meta.sub,
        history: nextHistory,
      });
      setHistory((h) => [...h, { role: 'assistant', content: data.reply }]);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Advisor unavailable', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-30 flex w-full max-w-lg flex-col bg-zinc-950 shadow-2xl border-l border-zinc-800">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 text-sm">
              💬
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-100">AI Advisor</p>
              {intentionMeta ? (
                intention === 'free' ? (
                  <p className="text-[10px] text-zinc-500">Free chat — ask anything about this ticket</p>
                ) : (
                  <p className="text-[10px] text-zinc-500">
                    Goal: <span className="text-violet-400">{intentionMeta.label}</span>
                  </p>
                )
              ) : (
                <p className="text-[10px] text-zinc-600">Select your objective to begin</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {intention && (
              <button
                onClick={() => { setIntention(null); setHistory([]); }}
                className="rounded border border-zinc-800 px-2.5 py-1 text-[10px] font-semibold text-zinc-600 transition hover:text-zinc-300"
              >
                ↩ Change goal
              </button>
            )}
            <button onClick={onClose} className="text-zinc-600 transition hover:text-zinc-300 text-lg leading-none">✕</button>
          </div>
        </div>

        {/* Ticket context pill */}
        <div className="shrink-0 border-b border-zinc-800/60 bg-zinc-900/50 px-5 py-2.5">
          <p className="truncate text-[11px] text-zinc-500">
            <span className="text-zinc-600">Ticket: </span>{ticket.title}
            {ticket.product && (() => { const p = productPalette(ticket.product.name); return <span className={`ml-2 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${p.bg} ${p.text} ${p.border}`}>{ticket.product.name[0]?.toUpperCase()} {ticket.product.name}</span>; })()}
          </p>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* Intention selector */}
          {!intention && (
            <div className="flex-1 overflow-y-auto p-5">
              <p className="mb-1 text-sm font-semibold text-zinc-200">What's your objective for this interaction?</p>
              <p className="mb-5 text-xs text-zinc-500">Your advisor will tailor every suggestion to your chosen goal.</p>
              <div className="grid grid-cols-2 gap-2.5">
                {COACH_INTENTIONS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => void startSession(item.id)}
                    className={`flex flex-col items-start rounded-xl border bg-zinc-900 p-3.5 text-left transition ${item.chip}`}
                  >
                    <span className="mb-1.5 text-xl leading-none">{item.icon}</span>
                    <span className="text-xs font-semibold">{item.label}</span>
                    <span className="mt-1 text-[10px] text-zinc-600 leading-snug">{item.sub}</span>
                  </button>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>
              <button
                onClick={() => void startSession('free')}
                className="mt-3 w-full flex items-center gap-3 rounded-xl border border-zinc-700/60 bg-zinc-900 p-3.5 text-left transition hover:border-zinc-600 hover:bg-zinc-800/60"
              >
                <span className="text-xl leading-none">{FREE_CHAT_INTENTION.icon}</span>
                <div>
                  <span className="text-xs font-semibold text-zinc-300">{FREE_CHAT_INTENTION.label}</span>
                  <p className="mt-0.5 text-[10px] text-zinc-600 leading-snug">{FREE_CHAT_INTENTION.sub}</p>
                </div>
              </button>

              {!profile && (
                <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                  <p className="text-[10px] text-amber-500/80">
                    💡 Run <span className="font-semibold">Customer Intelligence</span> first in Marketing Tools for sharper, profile-aware advisory.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Chat view */}
          {intention && (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

                {/* Free chat — empty state prompt */}
                {intention === 'free' && history.length === 0 && !loading && (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-2xl">💬</span>
                    <div>
                      <p className="text-xs font-semibold text-zinc-300">Ask anything about this ticket</p>
                      <p className="mt-1 text-[11px] text-zinc-600 leading-relaxed max-w-xs">
                        No objective needed — just type your question and get instant guidance on this customer, issue, or conversation.
                      </p>
                    </div>
                  </div>
                )}

                {/* Loading initial briefing */}
                {loading && history.length === 0 && (
                  <div className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 text-xs font-bold text-violet-400">✦</span>
                    <div className="flex-1 rounded-xl rounded-tl-sm border border-violet-500/20 bg-violet-500/5 p-3.5">
                      <div className="flex items-center gap-1.5">
                        {[0, 150, 300].map((d) => (
                          <span key={d} className="h-1.5 w-1.5 rounded-full bg-violet-500/60 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                        ))}
                        <span className="ml-2 text-[11px] text-violet-400/60">Analysing ticket…</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Messages */}
                {history.map((msg, i) => {
                  if (msg.role === 'user') {
                    return (
                      <div key={i} className="flex flex-row-reverse gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-[10px] font-bold text-zinc-400">A</span>
                        <div className="max-w-[85%] rounded-xl rounded-tr-sm border border-zinc-700 bg-zinc-800 px-3.5 py-2.5">
                          <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">{msg.content}</p>
                        </div>
                      </div>
                    );
                  }

                  // Render assistant message — parse "→ "..." " lines as highlighted suggestions
                  const parts = msg.content.split('\n');
                  return (
                    <div key={i} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 text-xs font-bold text-violet-400">✦</span>
                      <div className="flex-1 rounded-xl rounded-tl-sm border border-violet-500/20 bg-violet-500/5 px-3.5 py-3">
                        <div className="space-y-2 text-xs leading-relaxed">
                          {parts.map((line, li) => {
                            // Highlighted suggestion line: → "..."
                            const suggMatch = line.match(/^→\s*"(.+)"$/);
                            if (suggMatch) {
                              return (
                                <div key={li} className="group flex items-start gap-2 rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-2">
                                  <span className="mt-0.5 shrink-0 text-violet-500">→</span>
                                  <p className="flex-1 font-medium text-violet-300 leading-relaxed italic">"{suggMatch[1]}"</p>
                                  <button
                                    onClick={() => { onUseInReply(suggMatch[1]); toast('Added to reply', 'success'); }}
                                    className="shrink-0 rounded border border-violet-500/30 px-1.5 py-0.5 text-[9px] font-semibold text-violet-400 opacity-0 transition group-hover:opacity-100 hover:bg-violet-500/20"
                                  >
                                    Use →
                                  </button>
                                </div>
                              );
                            }
                            return line.trim() ? (
                              <p key={li} className="text-zinc-300">{line}</p>
                            ) : <div key={li} className="h-1" />;
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Loading while waiting for next reply */}
                {loading && history.length > 0 && (
                  <div className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 text-xs font-bold text-violet-400">✦</span>
                    <div className="rounded-xl rounded-tl-sm border border-violet-500/20 bg-violet-500/5 px-3.5 py-3">
                      <div className="flex items-center gap-1.5">
                        {[0, 150, 300].map((d) => (
                          <span key={d} className="h-1.5 w-1.5 rounded-full bg-violet-500/60 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="shrink-0 border-t border-zinc-800 p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
                    disabled={loading}
                    placeholder="Ask your advisor anything…"
                    className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500/30 disabled:opacity-50"
                  />
                  <button
                    onClick={() => void sendMessage()}
                    disabled={loading || !input.trim()}
                    className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-4 py-2.5 text-xs font-semibold text-violet-400 transition hover:bg-violet-500/25 disabled:opacity-40"
                  >
                    {loading ? '…' : '↑'}
                  </button>
                </div>
                <p className="mt-2 text-[9px] text-zinc-700">AI coaching — verify advice before acting · Enter to send</p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
