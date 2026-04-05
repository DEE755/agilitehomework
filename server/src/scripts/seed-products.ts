/**
 * Seeds the products collection with the default catalog.
 * Usage: npm run seed:products
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Product } from '../models/Product';
import defaultProducts from '../data/defaultProducts';

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // Deactivate everything first, then activate only the canonical catalog
  await Product.updateMany({}, { $set: { isActive: false } });

  const operations = defaultProducts.map((product) => ({
    updateOne: {
      filter: { slug: product.slug },
      update: { $set: product },
      upsert: true,
    },
  }));

  const result = await Product.bulkWrite(operations);
  console.log(
    `Seed complete: ${result.upsertedCount} inserted, ${result.modifiedCount} updated, ${defaultProducts.length} total defaults.`,
  );

  await mongoose.disconnect();
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
