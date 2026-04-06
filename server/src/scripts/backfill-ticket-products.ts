/**
 * Backfill ticket product snapshots.
 *
 * If the product catalog is empty, the script auto-creates products from the
 * product names embedded in ticket titles ("[Product Name] description"),
 * deducing categories and slugs.  Existing products (by slug) are never
 * duplicated.
 *
 * Usage (from server/ directory):
 *   npm run backfill:ticket-products
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Product, type ProductDocument } from '../models/Product';
import { Ticket } from '../models/Ticket';

// ── Env ────────────────────────────────────────────────────────────────────
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) { dotenv.config({ path: envPath }); break; }
}

// ── Category deduction from product name keywords ──────────────────────────
const CATEGORY_RULES: { keywords: string[]; category: string }[] = [
  { keywords: ['cap', 'hat', 'beanie', 'bucket hat', 'snapback'],                     category: 'Headwear'    },
  { keywords: ['t-shirt', 'tee', 'tank', 'crew neck', 'polo', 'henley', 'long sleeve'], category: 'Tops'       },
  { keywords: ['hoodie', 'sweatshirt', 'pullover', 'zip-up', 'fleece'],               category: 'Outerwear'   },
  { keywords: ['jacket', 'coat', 'parka', 'windbreaker', 'vest', 'bomber'],           category: 'Outerwear'   },
  { keywords: ['shorts', 'chino', 'jogger', 'cargo', 'pants', 'trousers', 'jeans'],   category: 'Bottoms'     },
  { keywords: ['shoes', 'sneaker', 'boots', 'sandal', 'loafer', 'slip-on'],           category: 'Footwear'    },
  { keywords: ['backpack', 'bag', 'tote', 'duffel', 'crossbody', 'wallet', 'purse'],  category: 'Bags'        },
  { keywords: ['watch', 'ring', 'necklace', 'bracelet', 'earring', 'accessory'],      category: 'Accessories' },
  { keywords: ['controller', 'gaming', 'headset', 'keyboard', 'mouse', 'speaker',
               'earbuds', 'cable', 'charger', 'phone', 'tablet', 'laptop'],           category: 'Electronics' },
  { keywords: ['cup', 'bottle', 'mug', 'tumbler', 'flask', 'canteen'],               category: 'Drinkware'   },
  { keywords: ['socks', 'underwear', 'boxers', 'briefs', 'gloves', 'scarf'],          category: 'Accessories' },
];

function deduceCategory(name: string): string {
  const lower = name.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) return rule.category;
  }
  return 'Apparel'; // safe default
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
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 24);
}

/** Extract product name from "[Name] rest of title" */
function extractBracketName(title: string): string | null {
  const m = title.match(/^\[(.+?)\]/);
  return m ? m[1].trim() : null;
}

/** How similar is this product name to the query? */
function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function matchScore(product: ProductDocument, query: string): number {
  const nq = norm(query);
  const np = norm(product.name);
  if (np === nq) return 100;
  if (np.includes(nq) || nq.includes(np)) return 80;
  const qWords = new Set(nq.split(' ').filter((w) => w.length > 2));
  const shared = np.split(' ').filter((w) => w.length > 2 && qWords.has(w)).length;
  return shared * 20;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  await mongoose.connect(uri);
  console.log('✓ Connected to MongoDB');

  const tickets = await Ticket.find({}).lean();
  console.log(`✓ Loaded ${tickets.length} tickets`);

  // ── Step 1: collect all unique product names from ticket titles ──────────
  const namesFromTitles = new Set<string>();
  for (const t of tickets) {
    const n = extractBracketName(t.title);
    if (n) namesFromTitles.add(n);
  }
  console.log(`✓ Found ${namesFromTitles.size} unique product names in ticket titles`);

  // ── Step 2: ensure all those products exist in the catalog ───────────────
  let created = 0;
  for (const name of namesFromTitles) {
    const slug = toSlug(name);
    const existing = await Product.findOne({ slug }).lean();
    if (existing) continue;

    const category = deduceCategory(name);
    const sku = toSku(name);
    // Make sure SKU is unique by appending a suffix if needed
    const existingSku = await Product.findOne({ sku }).lean();
    const finalSku = existingSku ? `${sku}-${Date.now().toString().slice(-4)}` : sku;

    await Product.create({
      slug,
      name,
      category,
      sku: finalSku,
      description: `${name} — quality product from our catalog.`,
      price: null,
      isActive: true,
      sortOrder: 0,
    });
    console.log(`  + Created product: "${name}" [${category}]`);
    created++;
  }
  if (created > 0) console.log(`✓ Created ${created} missing products`);

  // ── Step 3: reload full catalog ──────────────────────────────────────────
  const products = await Product.find({ isActive: true }).lean<ProductDocument[]>();
  console.log(`✓ Catalog now has ${products.length} active products\n`);

  // ── Step 4: link tickets ─────────────────────────────────────────────────
  let updated = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const ticket of tickets) {
    const snap = ticket.product as Record<string, unknown> | null | undefined;

    // Already fully populated?
    if (snap && snap._id && snap.name && snap.category) {
      skipped++;
      continue;
    }

    let bestProduct: ProductDocument | null = null;
    let bestScore = 0;

    const bracketName = extractBracketName(ticket.title);
    if (bracketName) {
      for (const p of products) {
        const score = matchScore(p, bracketName);
        if (score > bestScore) { bestScore = score; bestProduct = p; }
      }
    }

    if (!bestProduct && snap && snap._id) {
      const byId = products.find((p) => String(p._id) === String(snap._id));
      if (byId) { bestProduct = byId; bestScore = 90; }
    }

    if (!bestProduct && snap && snap.name) {
      for (const p of products) {
        const score = matchScore(p, String(snap.name));
        if (score > bestScore) { bestScore = score; bestProduct = p; }
      }
    }

    if (!bestProduct || bestScore < 20) {
      console.log(`  ✗ No match  "${ticket.title.slice(0, 60)}"`);
      unmatched++;
      continue;
    }

    await Ticket.updateOne(
      { _id: ticket._id },
      {
        $set: {
          product: {
            _id:         String(bestProduct._id),
            name:        bestProduct.name,
            category:    bestProduct.category,
            description: bestProduct.description ?? null,
            price:       bestProduct.price ?? null,
            imageUrl:    null,
            slug:        bestProduct.slug ?? null,
          },
        },
      },
    );
    console.log(`  ✓ Linked  "${ticket.title.slice(0, 50)}" → ${bestProduct.name}`);
    updated++;
  }

  console.log(`\n─── Summary ─────────────────────────────────`);
  console.log(`  Products created: ${created}`);
  console.log(`  Tickets updated:  ${updated}`);
  console.log(`  Tickets skipped:  ${skipped} (already complete)`);
  console.log(`  Unmatched:        ${unmatched}`);
  console.log(`─────────────────────────────────────────────`);

  await mongoose.disconnect();
  console.log('✓ Done');
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
