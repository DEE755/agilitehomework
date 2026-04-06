import { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import type { FinderMessage, FinderResponse } from '../services/api';
import type { Product } from '../types/product';

interface Props {
  products: Product[];
  onSelectProduct: (product: Product) => void;
}

function ProductCard({ slug, products, onSelect }: { slug: string; products: Product[]; onSelect: (p: Product) => void }) {
  const product = products.find((p) => p.slug === slug);
  if (!product) return null;
  return (
    <button
      onClick={() => onSelect(product)}
      className="flex items-center gap-3 w-full rounded-xl border border-zinc-700 bg-zinc-800 p-3 text-left transition hover:border-olive-500/40 hover:bg-zinc-700/60"
    >
      {product.imageUrl ? (
        <img src={product.imageUrl} alt={product.name} className="h-12 w-12 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-700 text-xl text-zinc-600">◈</div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-zinc-100 truncate">{product.name}</p>
        <p className="text-[10px] text-zinc-500">{product.category}</p>
      </div>
      {product.price != null && (
        <span className="shrink-0 text-sm font-bold text-olive-400">${product.price}</span>
      )}
    </button>
  );
}

export default function ProductFinderWidget({ products, onSelectProduct }: Props) {
  const [open, setOpen]           = useState(false);
  const [history, setHistory]     = useState<FinderMessage[]>([]);
  const [responses, setResponses] = useState<FinderResponse[]>([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [email, setEmail]         = useState('');
  const [emailSaved, setEmailSaved] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const latestResponse = responses[responses.length - 1] ?? null;
  const hasRecommendations = latestResponse?.phase === 'recommending' || latestResponse?.phase === 'following_up';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [responses, loading]);

  // Auto-start when opened
  useEffect(() => {
    if (open && responses.length === 0 && !loading) {
      void sendMessage('', true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function sendMessage(userText: string, isInit = false) {
    if (loading) return;
    const nextHistory: FinderMessage[] = isInit
      ? []
      : [...history, { role: 'user', content: userText.trim() }];

    if (!isInit) {
      setHistory(nextHistory);
      setInput('');
    }

    setLoading(true);
    try {
      const { data } = await api.finder.chat({ history: nextHistory, email: email || undefined });
      const assistantMsg: FinderMessage = { role: 'assistant', content: data.message };
      setHistory((h) => [...h, assistantMsg]);
      setResponses((r) => [...r, data]);
    } catch (e) {
      setResponses((r) => [...r, {
        message: e instanceof Error ? e.message : 'Something went wrong. Please try again.',
        quickReplies: [],
        phase: 'questioning',
        recommendations: [],
        profile: { useCase: null, experienceLevel: null, budget: null, environment: null, notes: null },
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSave() {
    if (!email.trim() || emailSaved || !latestResponse) return;
    try {
      await api.finder.chat({
        history,
        email: email.trim(),
      });
      setEmailSaved(true);
    } catch { /* silent */ }
  }

  function reset() {
    setHistory([]);
    setResponses([]);
    setInput('');
    setEmail('');
    setEmailSaved(false);
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-olive-500/40 bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-olive-400 shadow-2xl shadow-black/50 transition hover:border-olive-500/70 hover:bg-zinc-900 sm:bottom-6 sm:right-6 sm:gap-2.5 sm:px-5 sm:py-3 sm:text-sm"
      >
        <span className="text-base">✦</span>
        Help me choose
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Panel */}
      {open && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl">

          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-olive-500/40 bg-olive-500/10 text-sm">✦</div>
              <div>
                <p className="text-sm font-semibold text-zinc-100">Product Advisor</p>
                <p className="text-[10px] text-zinc-600">AI-powered product matching</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {responses.length > 0 && (
                <button
                  onClick={reset}
                  className="rounded border border-zinc-800 px-2.5 py-1 text-[10px] font-semibold text-zinc-600 transition hover:text-zinc-300"
                >
                  ↺ Start over
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-zinc-600 transition hover:text-zinc-300 text-lg leading-none">✕</button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

            {/* Initial loading */}
            {loading && responses.length === 0 && (
              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-olive-500/40 bg-olive-500/10 text-xs text-olive-400 font-bold">✦</span>
                <div className="rounded-xl rounded-tl-sm border border-olive-500/20 bg-olive-500/5 px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="h-1.5 w-1.5 rounded-full bg-olive-400/60 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Conversation */}
            {history.map((msg, i) => {
              if (msg.role === 'user') {
                return (
                  <div key={i} className="flex flex-row-reverse gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-[10px] font-bold text-zinc-400">You</span>
                    <div className="max-w-[85%] rounded-xl rounded-tr-sm border border-zinc-700 bg-zinc-800 px-4 py-2.5">
                      <p className="text-xs text-zinc-300">{msg.content}</p>
                    </div>
                  </div>
                );
              }

              // Find the matching response for this assistant message
              const responseIdx = history.slice(0, i + 1).filter((m) => m.role === 'assistant').length - 1;
              const resp = responses[responseIdx];

              return (
                <div key={i} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-olive-500/40 bg-olive-500/10 text-xs text-olive-400 font-bold">✦</span>
                  <div className="flex-1 space-y-3">
                    <div className="rounded-xl rounded-tl-sm border border-olive-500/20 bg-olive-500/5 px-4 py-3">
                      <p className="text-xs leading-relaxed text-zinc-300">{msg.content}</p>
                    </div>

                    {/* Product recommendations — only render when AI picked slugs that actually exist in the catalog */}
                    {resp && (resp.phase === 'recommending' || resp.phase === 'following_up') && (() => {
                      const matched = resp.recommendations.filter((slug) => products.some((p) => p.slug === slug));
                      if (matched.length === 0) return null;
                      return (
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-olive-600">Recommended for you</p>
                          {matched.map((slug) => (
                            <ProductCard
                              key={slug}
                              slug={slug}
                              products={products}
                              onSelect={(p) => { onSelectProduct(p); setOpen(false); }}
                            />
                          ))}
                        </div>
                      );
                    })()}

                    {/* Quick reply chips — only for the latest assistant message */}
                    {i === history.length - 1 && resp?.quickReplies && resp.quickReplies.length > 0 && !loading && (
                      <div className="flex flex-wrap gap-2">
                        {resp.quickReplies.map((qr) => (
                          <button
                            key={qr}
                            onClick={() => void sendMessage(qr)}
                            className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[11px] text-zinc-400 transition hover:border-olive-500/40 hover:text-olive-400"
                          >
                            {qr}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Loading next response */}
            {loading && responses.length > 0 && (
              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-olive-500/40 bg-olive-500/10 text-xs text-olive-400 font-bold">✦</span>
                <div className="rounded-xl rounded-tl-sm border border-olive-500/20 bg-olive-500/5 px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="h-1.5 w-1.5 rounded-full bg-olive-400/60 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Email capture — shown after first recommendations */}
            {hasRecommendations && !emailSaved && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <p className="mb-1 text-xs font-semibold text-zinc-300">Save your recommendations</p>
                <p className="mb-3 text-[11px] text-zinc-600">Enter your email to receive your personalised gear list.</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-olive-500/60"
                  />
                  <button
                    onClick={() => void handleEmailSave()}
                    disabled={!email.trim()}
                    className="rounded-lg border border-olive-500/30 bg-olive-500/10 px-3 py-2 text-xs font-semibold text-olive-400 transition hover:bg-olive-500/20 disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {emailSaved && (
              <p className="text-center text-[11px] text-olive-500">✓ Recommendations saved to your email</p>
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
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && input.trim()) { e.preventDefault(); void sendMessage(input); } }}
                disabled={loading}
                placeholder="Type your answer or question…"
                className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-olive-500/30 disabled:opacity-50"
              />
              <button
                onClick={() => { if (input.trim()) void sendMessage(input); }}
                disabled={loading || !input.trim()}
                className="rounded-lg border border-olive-500/40 bg-olive-500/15 px-4 py-2.5 text-xs font-semibold text-olive-400 transition hover:bg-olive-500/25 disabled:opacity-40"
              >
                {loading ? '…' : '↑'}
              </button>
            </div>
            <p className="mt-2 text-[9px] text-zinc-700">AI product advisor · powered by Agilate</p>
          </div>
        </div>
      )}
    </>
  );
}
