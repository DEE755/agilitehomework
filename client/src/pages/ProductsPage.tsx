import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts';
import type { Product } from '../types/product';

const CATEGORY_COLORS: Record<string, string> = {
  'Body Armor':     'text-red-400 bg-red-500/10 border-red-500/20',
  'Packs & Bags':   'text-sand-300 bg-sand-400/10 border-sand-400/20',
  'Load Bearing':   'text-olive-400 bg-olive-500/10 border-olive-500/20',
  'Hand Protection':'text-amber-400 bg-amber-500/10 border-amber-500/20',
  'Protective Gear':'text-orange-400 bg-orange-500/10 border-orange-500/20',
  'Communications': 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  'Hydration':      'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
};

const CATEGORY_PLACEHOLDER_BG: Record<string, string> = {
  'Body Armor':     'from-red-900/40 to-zinc-900',
  'Packs & Bags':   'from-stone-800/60 to-zinc-900',
  'Load Bearing':   'from-olive-700/30 to-zinc-900',
  'Hand Protection':'from-amber-900/30 to-zinc-900',
  'Protective Gear':'from-orange-900/30 to-zinc-900',
  'Communications': 'from-sky-900/30 to-zinc-900',
  'Hydration':      'from-cyan-900/30 to-zinc-900',
};

function categoryStyle(cat: string) {
  return CATEGORY_COLORS[cat] ?? 'text-zinc-400 bg-zinc-800 border-zinc-700';
}

function placeholderBg(cat: string) {
  return CATEGORY_PLACEHOLDER_BG[cat] ?? 'from-zinc-800 to-zinc-900';
}

function ProductImage({ product }: { product: Product }) {
  const [errored, setErrored] = useState(false);

  if (product.imageUrl && !errored) {
    return (
      <img
        src={product.imageUrl}
        alt={product.name}
        onError={() => setErrored(true)}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />
    );
  }

  return (
    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-b ${placeholderBg(product.category)}`}>
      <span className="text-3xl opacity-20 select-none">◈</span>
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden animate-pulse">
      <div className="h-44 bg-zinc-800" />
      <div className="p-5 flex-1 space-y-3">
        <div className="h-3 w-20 rounded bg-zinc-800" />
        <div className="h-4 w-3/4 rounded bg-zinc-800" />
        <div className="space-y-1.5">
          <div className="h-3 w-full rounded bg-zinc-800/70" />
          <div className="h-3 w-5/6 rounded bg-zinc-800/70" />
        </div>
      </div>
      <div className="mx-5 mb-5 h-px bg-zinc-800" />
      <div className="flex items-center justify-between px-5 pb-5">
        <div className="h-3 w-16 rounded bg-zinc-800" />
        <div className="h-7 w-20 rounded bg-zinc-800" />
      </div>
    </div>
  );
}

// ─── Product Detail Modal ─────────────────────────────────────────────────────

function ProductModal({ product, onClose, onGetHelp }: {
  product: Product;
  onClose: () => void;
  onGetHelp: (p: Product) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [imgErrored, setImgErrored] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const storeUrl = `https://www.agilite.com/products/${product.slug}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        ref={ref}
        className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl"
      >
        {/* Image */}
        <div className="relative h-64 w-full shrink-0 overflow-hidden bg-zinc-800 sm:h-80">
          {product.imageUrl && !imgErrored ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              onError={() => setImgErrored(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className={`flex h-full w-full items-center justify-center bg-gradient-to-b ${placeholderBg(product.category)}`}>
              <span className="text-5xl opacity-20 select-none">◈</span>
            </div>
          )}
          {/* Category badge */}
          <span className={`absolute bottom-3 left-3 rounded-full border px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide backdrop-blur-sm ${categoryStyle(product.category)}`}>
            {product.category}
          </span>
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-zinc-400 backdrop-blur-sm transition hover:text-zinc-100"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-xl font-bold text-zinc-100">{product.name}</h2>
            <span className="shrink-0 font-mono text-[10px] text-zinc-700 mt-1">{product.sku}</span>
          </div>

          <p className="text-sm leading-relaxed text-zinc-400">{product.description}</p>

          {/* Actions */}
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.preventDefault()}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:text-white cursor-not-allowed"
              title="Store link — coming soon"
            >
              <span>🛒</span>
              Buy on Website
              <span className="ml-1 rounded-full border border-zinc-600 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-zinc-600">soon</span>
            </a>
            <button
              onClick={() => { onClose(); onGetHelp(product); }}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-olive-500/40 bg-olive-500/15 px-5 py-2.5 text-sm font-semibold text-olive-400 transition hover:bg-olive-500/25"
            >
              Get Help →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const DESCRIPTION_LIMIT = 80;
const PAGE_SIZE_OPTIONS = [8, 16, 24] as const;
type PageSize = typeof PAGE_SIZE_OPTIONS[number] | 'all';

export default function ProductsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { products, loading, error, reload } = useProducts();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [pageSize, setPageSize] = useState<PageSize>(8);
  const [page, setPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Auto-open modal when ?product=<slug> is present
  useEffect(() => {
    const slug = searchParams.get('product');
    if (!slug || products.length === 0) return;
    const match = products.find((p) => p.slug === slug);
    if (match) setSelectedProduct(match);
  }, [searchParams, products]);

  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category)))];

  const filtered = products.filter((p) => {
    const matchCat = activeCategory === 'All' || p.category === activeCategory;
    const q = query.toLowerCase();
    const matchQuery =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q);
    return matchCat && matchQuery;
  });

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(filtered.length / pageSize);
  const safePage   = Math.min(page, totalPages || 1);
  const paginated  = pageSize === 'all'
    ? filtered
    : filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function handleFilterChange(fn: () => void) { fn(); setPage(1); }

  function openTicket(product: Product) {
    navigate(`/support/new?product=${encodeURIComponent(product.slug)}`);
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
          Customer Portal
        </p>
        <h1 className="text-2xl font-bold text-zinc-100">Products</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Choose the product you need help with, then start a support request with the details pre-filled.
        </p>
      </div>

      {/* Search + filter */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-600">⌕</span>
          <input
            type="text"
            value={query}
            onChange={(e) => handleFilterChange(() => setQuery(e.target.value))}
            placeholder="Search by name, category, or SKU…"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2.5 pl-8 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-olive-500/30"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Per page</span>
          <div className="flex rounded-lg border border-zinc-800 overflow-hidden">
            {([...PAGE_SIZE_OPTIONS, 'all'] as PageSize[]).map((s) => (
              <button
                key={s}
                onClick={() => { setPageSize(s); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium transition border-r border-zinc-800 last:border-0 ${
                  pageSize === s
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Category chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => handleFilterChange(() => setActiveCategory(cat))}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              activeCategory === cat
                ? 'border-olive-500/40 bg-olive-500/15 text-olive-400'
                : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      {error ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-red-500/20 bg-red-500/5 py-16 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={reload}
            className="mt-3 text-xs font-medium text-olive-400 hover:underline"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-16 text-center">
          <p className="text-sm text-zinc-500">
            {products.length === 0 ? 'No products available yet' : 'No products match your search'}
          </p>
          {products.length > 0 && (
            <button
              onClick={() => { setQuery(''); setActiveCategory('All'); }}
              className="mt-3 text-xs font-medium text-olive-400 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paginated.map((product) => (
            <div
              key={product._id}
              className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden transition hover:border-zinc-700 hover:shadow-xl hover:shadow-black/30 cursor-pointer"
              onClick={() => setSelectedProduct(product)}
            >
              {/* Image */}
              <div className="relative h-44 overflow-hidden bg-zinc-800">
                <ProductImage product={product} />
                <span className={`absolute bottom-2.5 left-2.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide backdrop-blur-sm ${categoryStyle(product.category)}`}>
                  {product.category}
                </span>
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col p-5">
                <h2 className="text-sm font-bold text-zinc-100">{product.name}</h2>
                <div className="mt-1.5 flex-1">
                  <p className="text-xs leading-relaxed text-zinc-500">
                    {product.description.length > DESCRIPTION_LIMIT
                      ? product.description.slice(0, DESCRIPTION_LIMIT).trimEnd() + '…'
                      : product.description}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-800 pt-3" onClick={(e) => e.stopPropagation()}>
                  <a
                    href={`https://www.agilite.com/products/${product.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.preventDefault()}
                    className="rounded border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300 cursor-not-allowed"
                    title="Store link — coming soon"
                  >
                    🛒 Buy
                  </a>
                  <button
                    onClick={() => openTicket(product)}
                    className="rounded border border-olive-500/30 bg-olive-500/10 px-3 py-1 text-xs font-semibold text-olive-400 transition hover:bg-olive-500/20 hover:text-olive-300"
                  >
                    Get Help
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product detail modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onGetHelp={(p) => { setSelectedProduct(null); openTicket(p); }}
        />
      )}

      {/* Pagination */}
      {!loading && !error && filtered.length > 0 && pageSize !== 'all' && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between">
          <p className="text-xs text-zinc-600">
            {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="rounded border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:text-zinc-300 disabled:opacity-30"
            >
              ← Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`rounded border px-3 py-1.5 text-xs font-medium transition ${
                  n === safePage
                    ? 'border-olive-500/40 bg-olive-500/15 text-olive-400'
                    : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="rounded border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:text-zinc-300 disabled:opacity-30"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
