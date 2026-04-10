import type { Request, Response } from 'express';

// DummyJSON — a maintained, read-only fake-store API (no public writes, won't be vandalized).
// We pull only the categories that best match the original Platzi catalog.
const DUMMYJSON_URL =
  'https://dummyjson.com/products?limit=194&select=id,title,description,price,category,thumbnail';
const DUMMYJSON_PRODUCT = 'https://dummyjson.com/products';

// Map DummyJSON category slugs → canonical display names (matching original 5 categories)
const CATEGORY_MAP: Record<string, string> = {
  'mens-shirts':    'Clothes',
  'womens-dresses': 'Clothes',
  tops:             'Clothes',
  smartphones:      'Electronics',
  laptops:          'Electronics',
  furniture:        'Furniture',
  'mens-shoes':     'Shoes',
  'womens-shoes':   'Shoes',
  beauty:           'Miscellaneous',
  fragrances:       'Miscellaneous',
};

const ALLOWED_CATEGORIES = new Set(Object.keys(CATEGORY_MAP));

interface DummyProduct {
  id: number;
  title: string;
  description: string;
  price: number;
  category: string;
  thumbnail: string;
}

interface DummyResponse {
  products: DummyProduct[];
}

function toProduct(p: DummyProduct) {
  return {
    _id:         String(p.id),
    slug:        p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    name:        p.title,
    category:    CATEGORY_MAP[p.category] ?? 'Miscellaneous',
    description: p.description,
    sku:         `DJ-${p.id}`,
    price:       p.price,
    imageUrl:    p.thumbnail,
  };
}

// GET /api/products
export async function listProducts(_req: Request, res: Response): Promise<void> {
  const upstream = await fetch(DUMMYJSON_URL);
  if (!upstream.ok) {
    res.status(502).json({ error: 'Product catalog unavailable' });
    return;
  }

  const { products } = (await upstream.json()) as DummyResponse;
  const data = products
    .filter((p) => ALLOWED_CATEGORIES.has(p.category))
    .map(toProduct);

  res.json({ data });
}

// GET /api/products/:id
export async function getProduct(req: Request, res: Response): Promise<void> {
  const upstream = await fetch(`${DUMMYJSON_PRODUCT}/${req.params.id}`);
  if (!upstream.ok) {
    res.status(upstream.status === 404 ? 404 : 502).json({ error: 'Product not found' });
    return;
  }

  const p = (await upstream.json()) as DummyProduct;
  if (!ALLOWED_CATEGORIES.has(p.category)) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  res.json({ data: toProduct(p) });
}
