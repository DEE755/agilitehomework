import type { Request, Response } from 'express';

// Escuela JS — maintained fake-store API with grocery/lifestyle categories.
const ESCUELA_URL = 'https://api.escuelajs.co/api/v1/products?limit=200';
const ESCUELA_PRODUCT = 'https://api.escuelajs.co/api/v1/products';

// Canonical display names for the 6 Escuela JS categories
const CATEGORY_MAP: Record<number, string> = {
  1: 'Vegetables',
  2: 'Fruit',
  3: 'Bakery',
  4: 'Snacks',
  5: 'Grains',
  6: 'Personal Care',
};

const ALLOWED_CATEGORY_IDS = new Set(Object.keys(CATEGORY_MAP).map(Number));

interface EscuelaCategory {
  id: number;
  name: string;
  slug: string;
}

interface EscuelaProduct {
  id: number;
  title: string;
  description: string;
  price: number;
  images: string[];
  category: EscuelaCategory;
}

function cleanImageUrl(url: string): string {
  // The API sometimes wraps URLs in JSON array strings like '["https://..."]'
  const match = url.match(/https?:\/\/[^\]"]+/);
  return match ? match[0] : url;
}

function toProduct(p: EscuelaProduct) {
  const rawImage = p.images?.[0] ?? '';
  return {
    _id:         String(p.id),
    slug:        p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    name:        p.title,
    category:    CATEGORY_MAP[p.category?.id] ?? p.category?.name ?? 'Other',
    description: p.description,
    sku:         `EJ-${p.id}`,
    price:       p.price,
    imageUrl:    rawImage ? cleanImageUrl(rawImage) : undefined,
  };
}

// GET /api/products
export async function listProducts(_req: Request, res: Response): Promise<void> {
  const upstream = await fetch(ESCUELA_URL);
  if (!upstream.ok) {
    res.status(502).json({ error: 'Product catalog unavailable' });
    return;
  }

  const products = (await upstream.json()) as EscuelaProduct[];
  const data = products
    .filter((p) => ALLOWED_CATEGORY_IDS.has(p.category?.id) && p.title && p.images?.length)
    .map(toProduct);

  res.json({ data });
}

// GET /api/products/:id
export async function getProduct(req: Request, res: Response): Promise<void> {
  const upstream = await fetch(`${ESCUELA_PRODUCT}/${req.params.id}`);
  if (!upstream.ok) {
    res.status(upstream.status === 404 ? 404 : 502).json({ error: 'Product not found' });
    return;
  }

  const p = (await upstream.json()) as EscuelaProduct;
  if (!ALLOWED_CATEGORY_IDS.has(p.category?.id)) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  res.json({ data: toProduct(p) });
}
