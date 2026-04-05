/**
 * Assigns placeholder prices to all products that have no price set.
 * Prices are derived from category ranges to look realistic.
 * Usage: npm run seed:prices
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Product } from '../models/Product';

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) { dotenv.config({ path: envPath }); break; }
}

// Price ranges by category keywords (lowercase match)
const CATEGORY_RANGES: { keywords: string[]; min: number; max: number }[] = [
  { keywords: ['furniture', 'sofa', 'chair', 'table', 'desk', 'bed'],        min: 199,  max: 1299 },
  { keywords: ['electronics', 'electronic', 'tech', 'phone', 'laptop', 'tv'],min: 49,   max: 899  },
  { keywords: ['shoe', 'shoes', 'footwear', 'sneaker', 'boot'],               min: 39,   max: 199  },
  { keywords: ['clothing', 'clothes', 'apparel', 'shirt', 'jacket', 'coat'], min: 19,   max: 249  },
  { keywords: ['bag', 'handbag', 'luggage', 'backpack', 'purse'],             min: 29,   max: 349  },
  { keywords: ['accessories', 'accessory', 'sunglasses', 'perfume', 'watch'],min: 15,   max: 199  },
  { keywords: ['vehicle', 'scooter', 'bike', 'ride'],                        min: 79,   max: 499  },
];

const DEFAULT_RANGE = { min: 19, max: 299 };

function pickPrice(category: string): number {
  const cat = category.toLowerCase();
  const range = CATEGORY_RANGES.find((r) => r.keywords.some((k) => cat.includes(k))) ?? DEFAULT_RANGE;
  const raw = range.min + Math.random() * (range.max - range.min);
  // Round to .99
  return Math.floor(raw) + 0.99;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const products = await Product.find({ price: null });
  console.log(`Found ${products.length} products without a price`);

  let updated = 0;
  for (const p of products) {
    p.price = pickPrice(p.category ?? '');
    await p.save();
    updated++;
  }

  console.log(`Done: assigned prices to ${updated} products`);
  await mongoose.disconnect();
}

main().catch((err: Error) => { console.error(err.message); process.exit(1); });
