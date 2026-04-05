import { useState, useEffect, useRef } from 'react';
import type { Product } from '../types/product';

interface Props {
  products: Product[];
  selectedProductId: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (product: Product) => void;
  onClose: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Body Armor':     'text-red-400 bg-red-500/10 border-red-500/20',
  'Packs & Bags':   'text-sand-300 bg-sand-400/10 border-sand-400/20',
  'Load Bearing':   'text-olive-400 bg-olive-500/10 border-olive-500/20',
  'Hand Protection':'text-amber-400 bg-amber-500/10 border-amber-500/20',
  'Protective Gear':'text-orange-400 bg-orange-500/10 border-orange-500/20',
  'Communications': 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  'Hydration':      'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
};

function categoryStyle(cat: string) {
  return CATEGORY_COLORS[cat] ?? 'text-zinc-400 bg-zinc-700/50 border-zinc-600';
}

export default function ProductPickerModal({
  products,
  selectedProductId,
  loading,
  error,
  onRetry,
  onSelect,
  onClose,
}: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.category.toLowerCase().includes(query.toLowerCase()) ||
      p.sku.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/80 backdrop-blur-sm sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex h-[85vh] w-full max-w-lg flex-col rounded-t-2xl border border-zinc-800 bg-zinc-900 shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Select Product</h2>
            <p className="text-xs text-zinc-500">Choose the product this ticket relates to</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-zinc-800 px-5 py-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">⌕</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, category, or SKU…"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-8 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-olive-500/40"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {error && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={onRetry}
                className="mt-3 text-xs font-medium text-olive-400 hover:underline"
              >
                Retry
              </button>
            </div>
          )}
          {!error && loading && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-zinc-500">Loading products…</p>
            </div>
          )}
          {!error && !loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-zinc-500">
                {products.length === 0 ? 'No products available yet' : `No products match "${query}"`}
              </p>
            </div>
          )}
          {!error && !loading && filtered.map((product) => {
            const isSelected = selectedProductId === product._id;
            return (
              <button
                key={product._id}
                onClick={() => { onSelect(product); onClose(); }}
                className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                  isSelected
                    ? 'bg-olive-500/15 ring-1 ring-olive-500/40'
                    : 'hover:bg-zinc-800'
                }`}
              >
                {/* Thumbnail */}
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-zinc-700 bg-zinc-800">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="text-lg opacity-20 select-none">◈</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-100">{product.name}</span>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${categoryStyle(product.category)}`}>
                      {product.category}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{product.description}</p>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-zinc-600">{product.sku}</span>
                {isSelected && (
                  <span className="shrink-0 text-olive-400 text-sm">✓</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
