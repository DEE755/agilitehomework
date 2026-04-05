import type { Request, Response } from 'express';

const EXTERNAL_CATALOG = 'https://api.escuelajs.co/api/v1/products?limit=20';

// Canonical category names keyed by the Platzi API category ID
const CATEGORY_NAMES: Record<number, string> = {
  1: 'Clothes',
  2: 'Electronics',
  3: 'Furniture',
  4: 'Shoes',
  5: 'Miscellaneous',
};

interface ExternalProduct {
  id: number;
  title: string;
  slug: string;
  price: number;
  description: string;
  category: { id: number; name: string };
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
      category:    CATEGORY_NAMES[p.category?.id] ?? 'Miscellaneous',
      description: stripHtml(p.description ?? ''),
      sku:         `EXT-${p.id}`,
      imageUrl:    p.images?.[0] ?? undefined,
    }))
    .filter((p) => p.name);

  res.json({ data });
}
