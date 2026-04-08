import { useEffect, useState, useRef } from 'react';
import { productPalette } from '../../../utils/formatting';
import type { AdminTicketProduct } from '../../../types/admin';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

interface FullProduct {
  _id: string;
  name: string;
  category: string;
  description: string;
  sku: string;
  price: number | null;
  imageUrl: string | null;
}

export function ProductViewerModal({ product, onClose }: { product: AdminTicketProduct; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const palette = productPalette(product.name);
  const [full, setFull] = useState<FullProduct | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${BASE}/products/${product._id}`);
        if (res.ok) {
          const json = await res.json() as { data: FullProduct };
          setFull(json.data);
        }
      } finally {
        setFetching(false);
      }
    })();
  }, [product._id]);

  const display = full ?? product;
  const imageUrl = full?.imageUrl ?? product.imageUrl;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={(e) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        ref={ref}
        className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header band */}
        <div className={`relative flex h-40 w-full shrink-0 items-center justify-center overflow-hidden ${palette.bg}`}>
          {imageUrl ? (
            <img src={imageUrl} alt={display.name} className="h-full w-full object-cover opacity-80" />
          ) : (
            <span className={`text-7xl font-bold select-none opacity-60 ${palette.text}`}>
              {display.name[0]?.toUpperCase()}
            </span>
          )}
          {display.category && (
            <span className="absolute bottom-3 left-3 rounded-full border border-zinc-700/60 bg-zinc-900/70 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 backdrop-blur-sm">
              {display.category}
            </span>
          )}
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 text-zinc-400 backdrop-blur-sm transition hover:text-zinc-100"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-xl font-bold text-zinc-100">{display.name}</h2>
            {display.price != null && (
              <span className="shrink-0 rounded-full border border-olive-500/30 bg-olive-500/10 px-3 py-1 text-sm font-bold text-olive-400">
                ${display.price}
              </span>
            )}
          </div>


          <div className="mt-4">
            {fetching ? (
              <div className="space-y-2">
                <div className="h-3 w-full animate-pulse rounded bg-zinc-800" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-zinc-800" />
                <div className="h-3 w-3/5 animate-pulse rounded bg-zinc-800" />
              </div>
            ) : display.description ? (
              <p className="text-sm leading-relaxed text-zinc-400">{display.description}</p>
            ) : (
              <p className="text-xs italic text-zinc-700">No description available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProductThumbnail({ product }: { product: AdminTicketProduct }) {
  const [modalOpen, setModalOpen] = useState(false);
  const palette = productPalette(product.name);

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        title={`View product: ${product.name}`}
        className={`inline-flex items-center gap-2 rounded-lg border bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold transition hover:bg-zinc-800 ${palette.border} ${palette.text}`}
      >
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="h-5 w-5 shrink-0 rounded object-cover" />
        ) : (
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold ${palette.bg} ${palette.text}`}>
            {product.name[0]?.toUpperCase()}
          </span>
        )}
        <span>{product.name}</span>
        {product.price != null && (
          <span className="font-normal text-zinc-500">${product.price}</span>
        )}
      </button>
      {modalOpen && <ProductViewerModal product={product} onClose={() => setModalOpen(false)} />}
    </>
  );
}
