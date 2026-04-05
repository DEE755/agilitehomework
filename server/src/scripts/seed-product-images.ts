/**
 * Downloads tactical gear images from Wikimedia Commons and uploads them to R2.
 * Then updates each product document with its imageKey.
 * Usage: npm run seed:product-images
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Product } from '../models/Product';

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

// ---------------------------------------------------------------------------
// Image sources — all Wikimedia Commons (CC-licensed / public domain)
// ---------------------------------------------------------------------------
// Public-domain images from DVIDS (Defense Visual Information Distribution Service).
// All photos are produced by US government personnel and are not subject to copyright.
// First 2 were already seeded from Wikimedia Commons on a previous run.
const PRODUCT_IMAGES: Array<{ slug: string; sourceUrl: string }> = [
  {
    slug: 'plate-carrier-mk2',
    sourceUrl: 'https://d1ldvf68ux039x.cloudfront.net/thumbs/photos/1710/3903836/1000w_q95.jpg',
  },
  {
    slug: 'assault-pack-45l',
    sourceUrl: 'https://d1ldvf68ux039x.cloudfront.net/thumbs/photos/1804/4337615/559w_q95.jpg',
  },
  {
    slug: 'cqb-belt-system',
    // MOLLE load-bearing webbing system (Natick Soldier Systems Center)
    sourceUrl: 'https://d1ldvf68ux039x.cloudfront.net/thumbs/photos/1804/4337615/559w_q95.jpg',
  },
  {
    slug: 'tac-gloves-pro',
    // US Army Military Police close combat training (Fort Benning)
    sourceUrl: 'https://d1ldvf68ux039x.cloudfront.net/thumbs/photos/2507/9158280/600w_q95.jpg',
  },
  {
    slug: 'combat-knee-pad-set',
    // Soldier kneeling during Saber Junction training, Germany
    sourceUrl: 'https://d1ldvf68ux039x.cloudfront.net/thumbs/photos/2008/6318545/1000w_q95.jpg',
  },
  {
    slug: 'comms-headset-adapter',
    // I Corps Soldiers testing head and ear protection (TCAPS)
    sourceUrl: 'https://d1ldvf68ux039x.cloudfront.net/thumbs/photos/1708/3665088/1000w_q95.jpg',
  },
  {
    slug: 'admin-chest-rig',
    // 3rd Special Forces Group riggers with full load-out (chest rig visible)
    sourceUrl: 'https://d1ldvf68ux039x.cloudfront.net/thumbs/photos/2602/9510735/1000w_q95.jpg',
  },
  {
    slug: 'hydration-bladder-3l',
    // Soldier with hydration pack during field training
    sourceUrl: 'https://d1ldvf68ux039x.cloudfront.net/thumbs/photos/1905/5328118/1000w_q95.jpg',
  },
];

function getS3Client(): { client: S3Client; bucket: string } {
  const rawEndpoint = process.env.S3_ENDPOINT?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();

  if (!rawEndpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('S3_ENDPOINT, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set');
  }

  const url = new URL(rawEndpoint);
  const bucket = process.env.S3_BUCKET?.trim() || url.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] || '';
  if (!bucket) throw new Error('Could not determine S3 bucket from S3_ENDPOINT or S3_BUCKET');

  url.pathname = '';
  const endpoint = url.toString().replace(/\/$/, '');

  const client = new S3Client({
    endpoint,
    region: process.env.S3_REGION?.trim() ?? 'auto',
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });

  return { client, bucket };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

const WIKI_UA = 'ProjectAgilite/1.0 (https://github.com/example/projectagilite; image-seeder; contact: support@example.com)';

/**
 * Use the MediaWiki API to resolve a 1024px thumbnail URL for a Commons file.
 * Thumbnails are served via a different CDN path and are less likely to be blocked.
 */
async function resolveWikiUrl(fileName: string): Promise<string> {
  const api =
    `https://commons.wikimedia.org/w/api.php?action=query` +
    `&titles=File:${encodeURIComponent(fileName)}` +
    `&prop=imageinfo&iiprop=url&iiurlwidth=1024` +
    `&format=json&redirects=1`;
  const res = await fetch(api, { headers: { 'User-Agent': WIKI_UA } });
  if (!res.ok) throw new Error(`MediaWiki API error ${res.status} for ${fileName}`);
  type WikiApiResponse = {
    query: {
      pages: Record<string, {
        imageinfo?: Array<{ url: string; thumburl?: string }>;
      }>;
    };
  };
  const data = (await res.json()) as WikiApiResponse;
  const pages = Object.values(data.query.pages);
  const info = pages[0]?.imageinfo?.[0];
  // Prefer thumburl (CDN-rendered, less restricted) over the original url
  const url = info?.thumburl ?? info?.url;
  if (!url) throw new Error(`No imageinfo URL returned for File:${fileName}`);
  return url;
}

async function downloadFromUrl(url: string, attempt = 1): Promise<Buffer> {
  console.log(`  Downloading ${url}${attempt > 1 ? ` (attempt ${attempt})` : ''}`);
  const res = await fetch(url, {
    headers: { 'User-Agent': WIKI_UA, 'Accept': 'image/*' },
  });
  if ((res.status === 429 || res.status === 503) && attempt < 4) {
    const wait = attempt * 4000;
    console.log(`  Throttled (${res.status}) — waiting ${wait / 1000}s…`);
    await sleep(wait);
    return downloadFromUrl(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function downloadWikiImage(fileName: string): Promise<Buffer> {
  const url = await resolveWikiUrl(fileName);
  return downloadFromUrl(url);
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI not set');

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const { client, bucket } = getS3Client();
  console.log(`Using R2 bucket: ${bucket}\n`);

  let uploaded = 0;
  let skipped = 0;

  for (const entry of PRODUCT_IMAGES) {
    const imageKey = `products/${entry.slug}.jpg`;

    // Check if already set on the product doc
    const product = await Product.findOne({ slug: entry.slug });
    if (!product) {
      console.log(`  ⚠  No product found for slug "${entry.slug}" — skipping`);
      skipped++;
      continue;
    }

    if ((product as unknown as Record<string, unknown>).imageKey === imageKey) {
      console.log(`  ✓  ${entry.slug} already has imageKey — skipping`);
      skipped++;
      continue;
    }

    try {
      const imageData = await downloadFromUrl(entry.sourceUrl);

      console.log(`  Uploading → ${imageKey} (${Math.round(imageData.length / 1024)} KB)`);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: imageKey,
          Body: imageData,
          ContentType: 'image/jpeg',
        }),
      );

      await Product.updateOne({ slug: entry.slug }, { $set: { imageKey } });
      console.log(`  ✓  ${entry.slug} done\n`);
      uploaded++;
    } catch (err) {
      console.error(`  ✗  ${entry.slug} failed:`, (err as Error).message, '\n');
    }

    // Be polite to Wikimedia's servers
    await sleep(2000);
  }

  console.log(`\nDone — ${uploaded} uploaded, ${skipped} skipped.`);
  await mongoose.disconnect();
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
