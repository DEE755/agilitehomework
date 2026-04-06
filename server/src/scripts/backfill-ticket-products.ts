/**
 * Backfill ticket product snapshots using the Platzi Fake Store API.
 *
 * For every ticket whose product snapshot is missing category or image:
 *   1. Extract the product name from the ticket title "[Name] …"
 *   2. Fuzzy-match it against the external API's product list (title, category, images[0])
 *   3. Write category + imageUrl back onto the ticket's embedded product snapshot
 *   4. Also patch the internal Product document if one exists for that slug
 *
 * Usage (from server/ directory):
 *   npm run backfill:ticket-products
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { Ticket } from '../models/Ticket';

// ── Env ─────────────────────────────────────────────────────────────────────
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) { dotenv.config({ path: envPath }); break; }
}

// ── External API types ───────────────────────────────────────────────────────
interface ApiProduct {
  id: number;
  title: string;
  slug: string;
  price: number;
  description: string;
  images: string[];
  category: {
    id: number;
    name: string;
    slug: string;
    image: string;
  };
}

// ── String helpers ───────────────────────────────────────────────────────────
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function toSku(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, '-').slice(0, 24);
}

/** Extract product name from "[Name] rest of title" */
function extractBracketName(title: string): string | null {
  const m = title.match(/^\[(.+?)\]/);
  return m ? m[1].trim() : null;
}

/** Fuzzy match score between a query string and an API product title */
function matchScore(apiTitle: string, query: string): number {
  const nq = norm(query);
  const nt = norm(apiTitle);
  if (nt === nq) return 100;
  if (nt.includes(nq) || nq.includes(nt)) return 80;
  const qWords = new Set(nq.split(' ').filter((w) => w.length > 2));
  const shared = nt.split(' ').filter((w) => w.length > 2 && qWords.has(w)).length;
  return shared * 20;
}

/** Pick the best matching API product for a given name, or null if score < 20 */
function findBestApiMatch(name: string, apiProducts: ApiProduct[]): ApiProduct | null {
  let best: ApiProduct | null = null;
  let bestScore = 0;
  for (const ap of apiProducts) {
    const score = matchScore(ap.title, name);
    if (score > bestScore) { bestScore = score; best = ap; }
  }
  return bestScore >= 20 ? best : null;
}

/** Clean up image URLs — the API sometimes wraps them in ["url"] strings */
function cleanImageUrl(raw: string): string {
  return raw.replace(/^\[?"?/, '').replace(/"?\]?$/, '').trim();
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  await mongoose.connect(uri);
  console.log('✓ Connected to MongoDB');

  // ── Fetch external product catalog ────────────────────────────────────────
  console.log('  Fetching https://api.escuelajs.co/api/v1/products …');
  const res = await fetch('https://api.escuelajs.co/api/v1/products?limit=200');
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const apiProducts: ApiProduct[] = await res.json() as ApiProduct[];
  console.log(`✓ Got ${apiProducts.length} products from external API`);

  // ── Load all tickets ──────────────────────────────────────────────────────
  const tickets = await Ticket.find({}).lean();
  console.log(`✓ Loaded ${tickets.length} tickets\n`);

  let updated = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const ticket of tickets) {
    const snap = ticket.product as Record<string, unknown> | null | undefined;

    // Skip if already fully populated with category + imageUrl
    if (snap && snap.category && snap.imageUrl) {
      skipped++;
      continue;
    }

    // Try to extract product name from bracket title, fall back to snap.name
    const bracketName = extractBracketName(ticket.title);
    const queryName = bracketName ?? (snap?.name as string | undefined);

    if (!queryName) {
      console.log(`  ✗ No name  "${ticket.title.slice(0, 60)}"`);
      unmatched++;
      continue;
    }

    const match = findBestApiMatch(queryName, apiProducts);

    if (!match) {
      console.log(`  ✗ No match  "${queryName}" (ticket: "${ticket.title.slice(0, 50)}")`);
      unmatched++;
      continue;
    }

    const imageUrl = match.images[0] ? cleanImageUrl(match.images[0]) : null;
    const category = match.category.name;
    const slug = snap?.slug as string | undefined ?? toSlug(match.title);

    // Build merged product snapshot
    const newSnap = {
      _id:         snap?._id ?? undefined,
      name:        (snap?.name as string | undefined) ?? match.title,
      category,
      description: (snap?.description as string | undefined) ?? match.description,
      price:       (snap?.price as number | undefined) ?? match.price,
      imageUrl,
      slug,
    };

    await Ticket.updateOne({ _id: ticket._id }, { $set: { product: newSnap } });

    console.log(`  ✓ Updated  "${queryName}" → category="${category}" image=${imageUrl ? '✓' : '✗'}`);
    updated++;

    // Also patch the internal Product document if it exists (by slug or name)
    const internalProduct = await Product.findOne({
      $or: [{ slug }, { name: newSnap.name }],
    });
    if (internalProduct) {
      const patch: Record<string, unknown> = {};
      if (!internalProduct.category || internalProduct.category === 'Apparel') {
        patch.category = category;
      }
      // Store the external URL directly as imageKey only if no R2 key set
      if (!internalProduct.imageKey && imageUrl) {
        patch.imageKey = imageUrl; // will be used as fallback if R2 key absent
      }
      if (internalProduct.price == null && match.price) {
        patch.price = match.price;
      }
      if (Object.keys(patch).length) {
        await Product.updateOne({ _id: internalProduct._id }, { $set: patch });
        console.log(`    ↳ Patched internal Product "${internalProduct.name}"`);
      }
    } else {
      // Create a minimal internal Product so the admin catalog is populated
      const sku = toSku(match.title);
      const existingSku = await Product.findOne({ sku }).lean();
      const finalSku = existingSku ? `${sku}-${Date.now().toString().slice(-4)}` : sku;
      await Product.create({
        slug,
        name:        match.title,
        category,
        sku:         finalSku,
        description: match.description,
        price:       match.price,
        imageKey:    imageUrl ?? null,
        isActive:    true,
        sortOrder:   0,
      });
      console.log(`    ↳ Created internal Product "${match.title}"`);
    }
  }

  console.log(`\n─── Summary ─────────────────────────────────`);
  console.log(`  Tickets updated:  ${updated}`);
  console.log(`  Tickets skipped:  ${skipped} (already complete)`);
  console.log(`  Unmatched:        ${unmatched}`);
  console.log(`─────────────────────────────────────────────`);

  await mongoose.disconnect();
  console.log('✓ Done');
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
