export function RiskPill({ level, label }: { level: 'low' | 'medium' | 'high'; label: string }) {
  const cls =
    level === 'high'   ? 'border-red-500/30 bg-red-500/10 text-red-400' :
    level === 'medium' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' :
                         'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

export function RiskBar({ level }: { level: 'low' | 'medium' | 'high' }) {
  const width = level === 'high' ? '90%' : level === 'medium' ? '55%' : '20%';
  const color = level === 'high' ? 'bg-red-500' : level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="h-1 w-full rounded-full bg-zinc-800">
      <div className={`h-1 rounded-full transition-all duration-500 ${color}`} style={{ width }} />
    </div>
  );
}

export const ARCHETYPE_META: Record<string, { icon: string; color: string }> = {
  early_adopter:      { icon: '🚀', color: 'border-sky-500/30 bg-sky-500/10 text-sky-400' },
  loyal_advocate:     { icon: '⭐', color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
  price_sensitive:    { icon: '💰', color: 'border-amber-500/30 bg-amber-500/10 text-amber-400' },
  casual_buyer:       { icon: '🛍️', color: 'border-zinc-600/40 bg-zinc-800 text-zinc-400' },
  frustrated_veteran: { icon: '⚡', color: 'border-red-500/30 bg-red-500/10 text-red-400' },
};

export const SENTIMENT_META: Record<string, { icon: string; color: string }> = {
  positive:   { icon: '😊', color: 'text-emerald-400' },
  neutral:    { icon: '😐', color: 'text-zinc-400' },
  frustrated: { icon: '😤', color: 'text-amber-400' },
  hostile:    { icon: '😠', color: 'text-red-400' },
};
