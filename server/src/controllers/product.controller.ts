import type { Request, Response } from 'express';

const EXTERNAL_CATALOG = 'https://api.escuelajs.co/api/v1/products?limit=20';
const EXTERNAL_PRODUCT = 'https://api.escuelajs.co/api/v1/products';

// Canonical category names — normalise slug/name from Platzi API
const CATEGORY_SLUGS: Record<string, string> = {
  clothes:       'Clothes',
  electronics:   'Electronics',
  furniture:     'Furniture',
  shoes:         'Shoes',
  miscellaneous: 'Miscellaneous',
};

function resolveCategory(cat: { id: number; name: string; slug?: string }): string {
  const key = (cat.slug ?? cat.name ?? '').toLowerCase();
  return CATEGORY_SLUGS[key] ?? cat.name ?? 'Miscellaneous';
}

interface ExternalProduct {
  id: number;
  title: string;
  slug: string;
  price: number;
  description: string;
  category: { id: number; name: string; slug?: string };
  images: string[];
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}

// GET /api/products
export async function listProducts(_req: Request, res: Response): Promise<void> {
  const upstream = await fetch(EXTERNAL_CATALOG);
  if (!upstream.ok) {
    res.status(502).json({ error: 'Product catalog unavailable' });
    return;
  }

  const raw = (await upstream.json()) as ExternalProduct[];

  const data = raw
    .map((p) => ({
      _id:         String(p.id),
      slug:        p.slug,
      name:        stripHtml(p.title ?? ''),
      category:    resolveCategory(p.category),
      description: stripHtml(p.description ?? ''),
      sku:         `EXT-${p.id}`,
      price:       p.price ?? null,
      imageUrl:    p.images?.[0] ?? undefined,
    }))
    .filter((p) => p.name);

  res.json({ data });
}

// GET /api/products/:id
export async function getProduct(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const upstream = await fetch(`${EXTERNAL_PRODUCT}/${id}`);
  if (!upstream.ok) {
    res.status(upstream.status === 404 ? 404 : 502).json({ error: 'Product not found' });
    return;
  }

  const p = (await upstream.json()) as ExternalProduct;
  res.json({
    data: {
      _id:         String(p.id),
      slug:        p.slug,
      name:        stripHtml(p.title ?? ''),
      category:    resolveCategory(p.category),
      description: stripHtml(p.description ?? ''),
      sku:         `EXT-${p.id}`,
      price:       p.price ?? null,
      imageUrl:    p.images?.[0] ?? null,
    },
  });
}
