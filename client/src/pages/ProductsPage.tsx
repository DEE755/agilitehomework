import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts';
import type { Product } from '../types/product';
import ProductFinderWidget from '../components/ProductFinderWidget';
import { useLanguage } from '../i18n/LanguageContext';
import type { translations } from '../i18n/translations';

const PRODUCT_PALETTES = [
  { badge: 'text-sky-400 bg-sky-500/10 border-sky-500/20',      bg: 'bg-sky-500/10',     text: 'text-sky-300'     },
  { badge: 'text-violet-400 bg-violet-500/10 border-violet-500/20', bg: 'bg-violet-500/10', text: 'text-violet-300' },
  { badge: 'text-amber-400 bg-amber-500/10 border-amber-500/20', bg: 'bg-amber-500/10',   text: 'text-amber-300'   },
  { badge: 'text-rose-400 bg-rose-500/10 border-rose-500/20',   bg: 'bg-rose-500/10',    text: 'text-rose-300'    },
  { badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', bg: 'bg-emerald-500/10', text: 'text-emerald-300' },
  { badge: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',   bg: 'bg-cyan-500/10',    text: 'text-cyan-300'    },
  { badge: 'text-orange-400 bg-orange-500/10 border-orange-500/20', bg: 'bg-orange-500/10', text: 'text-orange-300' },
  { badge: 'text-pink-400 bg-pink-500/10 border-pink-500/20',   bg: 'bg-pink-500/10',    text: 'text-pink-300'    },
];

function categoryPalette(cat: string) {
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) & 0xffff;
  return PRODUCT_PALETTES[h % PRODUCT_PALETTES.length];
}

function ProductImage({ product }: { product: Product }) {
  const [errored, setErrored] = useState(false);
  const palette = categoryPalette(product.category);

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
    <div className={`flex h-full w-full items-center justify-center ${palette.bg}`}>
      <span className={`text-5xl font-bold select-none opacity-40 ${palette.text}`}>
        {product.name[0]?.toUpperCase()}
      </span>
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

// ─── Related products (client-side, no AI call) ───────────────────────────────

function getRelated(current: Product, all: Product[], max = 3): Product[] {
  const others = all.filter((p) => p._id !== current._id && !!p.imageUrl);
  const same  = others.filter((p) => p.category === current.category);
  const diff  = others.filter((p) => p.category !== current.category);
  const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
  const picks = shuffle(same).slice(0, 2);
  picks.push(...shuffle(diff).slice(0, max - picks.length));
  return picks.slice(0, max);
}

// ─── Product Detail Modal ─────────────────────────────────────────────────────

function ProductModal({ product, allProducts, onClose, onGetHelp, onSelect, tp }: {
  product: Product;
  allProducts: Product[];
  onClose: () => void;
  onGetHelp: (p: Product) => void;
  onSelect: (p: Product) => void;
  tp: typeof translations.en.products;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [imgErrored, setImgErrored] = useState(false);
  const related = getRelated(product, allProducts);
  const palette = categoryPalette(product.category);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        ref={ref}
        className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header band */}
        <div className={`relative flex h-48 w-full shrink-0 items-center justify-center sm:h-72 ${!product.imageUrl || imgErrored ? palette.bg : ''}`}>
          {product.imageUrl && !imgErrored ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              onError={() => setImgErrored(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className={`text-7xl font-bold select-none opacity-50 ${palette.text}`}>
              {product.name[0]?.toUpperCase()}
            </span>
          )}
          <span className={`absolute bottom-3 left-3 rounded-full border px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide backdrop-blur-sm ${palette.badge}`}>
            {product.category}
          </span>
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-zinc-400 backdrop-blur-sm transition hover:text-zinc-100"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-zinc-100">{product.name}</h2>
              {product.price != null && (
                <p className="mt-1 text-lg font-semibold th-price">${product.price}</p>
              )}
            </div>
            {product.sku && <span className="shrink-0 font-mono text-[10px] text-zinc-600 mt-1">{product.sku}</span>}
          </div>

          <p className="text-sm leading-relaxed text-zinc-400">{product.description}</p>

          {/* Actions */}
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <button
              disabled
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-5 py-2.5 text-sm font-semibold text-zinc-200 cursor-not-allowed"
            >
              {tp.buyIt}
            </button>
            <button
              onClick={() => { onClose(); onGetHelp(product); }}
              className="th-btn flex flex-1 items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-semibold transition"
            >
              {tp.getHelpArrow}
            </button>
          </div>

          {/* Goes well with */}
          {related.length > 0 && (
            <div className="mt-6 border-t border-zinc-800 pt-5">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{tp.goesWith}</p>
              <div className="grid grid-cols-3 gap-3">
                {related.map((p) => {
                  const rp = categoryPalette(p.category);
                  return (
                    <button
                      key={p._id}
                      onClick={() => onSelect(p)}
                      className="flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5 text-center transition hover:border-zinc-700 hover:bg-zinc-800/60 w-full"
                    >
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="h-12 w-12 rounded-lg object-cover" />
                      ) : (
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-xl font-bold ${rp.bg} ${rp.text}`}>
                          {p.name[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="w-full min-w-0">
                        <p className="truncate text-xs font-semibold text-zinc-200">{p.name}</p>
                        <p className="text-[10px] text-zinc-600">{p.category}</p>
                        {p.price != null && <p className="text-[10px] font-semibold th-price">${p.price}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
  const { t } = useLanguage();
  const tp = t.products;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { products: allProducts, loading, error, reload } = useProducts();
  const products = allProducts.filter(
    (p) => p.isActive !== false && !p.name.toLowerCase().includes('produ') && !!p.imageUrl,
  );
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<PageSize>(8);
  const [page, setPage] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Auto-open modal when ?product=<id or slug> is present
  useEffect(() => {
    const param = searchParams.get('product');
    if (!param || products.length === 0) return;
    const match = products.find((p) => p._id === param || p.slug === param);
    if (match) setSelectedProduct(match);
  }, [searchParams, products]);

  const categories = Array.from(new Set(products.map((p) => p.category)));

  const filtered = products.filter((p) => {
    const matchCat = activeCategory === null || p.category === activeCategory;
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
          {tp.portal}
        </p>
        <h1 className="text-xl font-bold text-zinc-100 sm:text-2xl">{tp.heading}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {tp.subtitle}
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
            placeholder={tp.searchPlaceholder}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 py-2.5 pl-8 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[var(--th-border)]"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{tp.perPage}</span>
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
                {s === 'all' ? tp.allOption : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Category chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        {/* "All" chip */}
        <button
          onClick={() => handleFilterChange(() => setActiveCategory(null))}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            activeCategory === null
              ? 'th-btn border'
              : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
          }`}
        >
          {tp.allOption}
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => handleFilterChange(() => setActiveCategory(cat))}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              activeCategory === cat
                ? 'th-btn border'
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
            className="mt-3 text-xs font-medium th-text hover:underline"
          >
            {tp.retry}
          </button>
        </div>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-16 text-center">
          <p className="text-sm text-zinc-500">
            {products.length === 0 ? tp.noProductsAvailable : tp.noProductsMatch}
          </p>
          {products.length > 0 && (
            <button
              onClick={() => { setQuery(''); setActiveCategory(null); }}
              className="mt-3 text-xs font-medium th-text hover:underline"
            >
              {tp.clearFilters}
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paginated.map((product) => (
            <div
              key={product._id}
              className="th-card group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden transition-all duration-300 cursor-pointer"
              onClick={() => setSelectedProduct(product)}
            >
              {/* Image */}
              <div className="relative h-44 overflow-hidden bg-zinc-800">
                <ProductImage product={product} />
                <span className={`absolute bottom-2.5 left-2.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide backdrop-blur-sm ${categoryPalette(product.category).badge}`}>
                  {product.category}
                </span>
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-bold text-zinc-100">{product.name}</h2>
                  {product.price != null && (
                    <span className="shrink-0 text-sm font-semibold th-price">${product.price}</span>
                  )}
                </div>
                <div className="mt-1.5 flex-1">
                  <p className="text-xs leading-relaxed text-zinc-500">
                    {product.description.length > DESCRIPTION_LIMIT
                      ? product.description.slice(0, DESCRIPTION_LIMIT).trimEnd() + '…'
                      : product.description}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-800 pt-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    disabled
                    className="rounded border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-300 cursor-not-allowed"
                  >
                    {tp.buyIt}
                  </button>
                  <button
                    onClick={() => openTicket(product)}
                    className="th-btn rounded border px-3 py-1 text-xs font-semibold transition"
                  >
                    {tp.getHelp}
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
          allProducts={products}
          onClose={() => setSelectedProduct(null)}
          onGetHelp={(p) => { setSelectedProduct(null); openTicket(p); }}
          onSelect={(p) => setSelectedProduct(p)}
          tp={tp}
        />
      )}

      {/* Pagination */}
      {!loading && !error && filtered.length > 0 && pageSize !== 'all' && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between">
          <p className="text-xs text-zinc-600">
            {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="rounded border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:text-zinc-300 disabled:opacity-30"
            >
              {tp.prev}
            </button>
            <span className="text-xs text-zinc-500">{safePage} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="rounded border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:text-zinc-300 disabled:opacity-30"
            >
              {tp.next}
            </button>
          </div>
        </div>
      )}

      <ProductFinderWidget
        products={products}
        onSelectProduct={(p) => setSelectedProduct(p)}
      />
    </div>
  );
}
