import crypto from 'crypto';
import path from 'path';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { IAttachment } from '../types/ticket.types';

const DEFAULT_REGION = 'auto';
const DEFAULT_UPLOAD_URL_TTL_SECONDS = 300;
const DEFAULT_READ_URL_TTL_SECONDS = 900;

export const MAX_TICKET_IMAGE_COUNT = 5;
export const MAX_TICKET_IMAGE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

interface StorageConfig {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
  uploadUrlTtlSeconds: number;
  readUrlTtlSeconds: number;
}

let cachedClient: S3Client | null = null;
let cachedConfig: StorageConfig | null = null;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function parseEndpointAndBucket(rawEndpoint: string, rawBucket?: string) {
  const url = new URL(rawEndpoint);
  const bucketFromPath = url.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] ?? '';

  url.pathname = '';
  url.search = '';
  url.hash = '';

  return {
    endpoint: trimTrailingSlash(url.toString()),
    bucket: rawBucket?.trim() || bucketFromPath,
  };
}

function getStorageConfig(): StorageConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const rawEndpoint = process.env.S3_ENDPOINT?.trim();
  const rawBucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();

  if (!rawEndpoint) {
    throw new Error('S3_ENDPOINT is not configured');
  }

  const { endpoint, bucket } = parseEndpointAndBucket(rawEndpoint, rawBucket);
  if (!bucket) {
    throw new Error('S3 bucket could not be determined from S3_ENDPOINT or S3_BUCKET');
  }

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('S3 credentials are not configured');
  }

  cachedConfig = {
    endpoint,
    bucket,
    region: process.env.S3_REGION?.trim() || DEFAULT_REGION,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL?.trim() || undefined,
    uploadUrlTtlSeconds: Number(process.env.S3_UPLOAD_URL_TTL_SECONDS) || DEFAULT_UPLOAD_URL_TTL_SECONDS,
    readUrlTtlSeconds: Number(process.env.S3_READ_URL_TTL_SECONDS) || DEFAULT_READ_URL_TTL_SECONDS,
  };

  return cachedConfig;
}

function getS3Client(): S3Client {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getStorageConfig();

  cachedClient = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    // Cloudflare R2 presigned PUT URLs work more reliably when the SDK only
    // signs checksums for operations that explicitly require them. The newer
    // AWS SDK default adds optional checksum params like
    // `x-amz-sdk-checksum-algorithm`, which R2 browser uploads may reject.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return cachedClient;
}

function sanitizeBaseName(fileName: string): string {
  const baseName = path.basename(fileName, path.extname(fileName)).toLowerCase();
  const sanitized = baseName.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return sanitized.slice(0, 60) || 'image';
}

function resolveExtension(fileName: string, mimeType: string): string {
  const currentExt = path.extname(fileName).toLowerCase();
  if (currentExt) {
    return currentExt;
  }

  switch (mimeType) {
    case 'image/gif':
      return '.gif';
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    default:
      return '';
  }
}

export function validateTicketAttachments(input: unknown): IAttachment[] {
  if (input === undefined) {
    return [];
  }

  if (!Array.isArray(input)) {
    throw new Error('"attachments" must be an array');
  }

  if (input.length > MAX_TICKET_IMAGE_COUNT) {
    throw new Error(`A ticket can include at most ${MAX_TICKET_IMAGE_COUNT} images`);
  }

  return input.map((value, index) => {
    if (!value || typeof value !== 'object') {
      throw new Error(`Attachment #${index + 1} is invalid`);
    }

    const attachment = value as Record<string, unknown>;
    const key = typeof attachment.key === 'string' ? attachment.key.trim() : '';
    const fileName = typeof attachment.fileName === 'string' ? attachment.fileName.trim() : '';
    const mimeType = typeof attachment.mimeType === 'string' ? attachment.mimeType.trim().toLowerCase() : '';
    const size = typeof attachment.size === 'number' ? attachment.size : Number(attachment.size);

    if (!key.startsWith('tickets/images/')) {
      throw new Error(`Attachment #${index + 1} has an invalid storage key`);
    }
    if (!fileName) {
      throw new Error(`Attachment #${index + 1} is missing "fileName"`);
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      throw new Error(`Attachment #${index + 1} has an unsupported image type`);
    }
    if (!Number.isFinite(size) || size <= 0 || size > MAX_TICKET_IMAGE_BYTES) {
      throw new Error(`Attachment #${index + 1} exceeds the maximum image size`);
    }

    return {
      key,
      fileName,
      mimeType,
      size,
    };
  });
}

export async function createTicketImageUpload(input: {
  fileName: string;
  contentType: string;
  size: number;
}) {
  const fileName = input.fileName.trim();
  const contentType = input.contentType.trim().toLowerCase();
  const size = input.size;

  if (!fileName) {
    throw new Error('"fileName" is required');
  }
  if (!ALLOWED_IMAGE_MIME_TYPES.has(contentType)) {
    throw new Error('Only GIF, JPG, PNG, and WEBP images are allowed');
  }
  if (!Number.isFinite(size) || size <= 0 || size > MAX_TICKET_IMAGE_BYTES) {
    throw new Error(`Images must be smaller than ${Math.round(MAX_TICKET_IMAGE_BYTES / (1024 * 1024))} MB`);
  }

  const config = getStorageConfig();
  const key = [
    'tickets',
    'images',
    new Date().toISOString().slice(0, 10),
    `${crypto.randomUUID()}-${sanitizeBaseName(fileName)}${resolveExtension(fileName, contentType)}`,
  ].join('/');

  const client = getS3Client();
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: config.uploadUrlTtlSeconds },
  );

  return {
    uploadUrl,
    expiresIn: config.uploadUrlTtlSeconds,
    attachment: {
      key,
      fileName,
      mimeType: contentType,
      size,
    } satisfies IAttachment,
  };
}

export async function createAvatarUpload(agentId: string, contentType: string) {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(contentType)) {
    throw new Error('Only GIF, JPG, PNG, and WEBP images are allowed');
  }
  const ext = contentType === 'image/gif' ? '.gif' : contentType === 'image/png' ? '.png' : contentType === 'image/webp' ? '.webp' : '.jpg';
  const key = `avatars/${agentId}${ext}`;
  const config = getStorageConfig();
  const uploadUrl = await getSignedUrl(
    getS3Client(),
    new PutObjectCommand({ Bucket: config.bucket, Key: key, ContentType: contentType }),
    { expiresIn: config.uploadUrlTtlSeconds },
  );
  return { uploadUrl, key, expiresIn: config.uploadUrlTtlSeconds };
}

export async function uploadTicketImageBuffer(input: {
  buffer: Buffer;
  fileName: string;
  contentType: string;
}): Promise<IAttachment> {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(input.contentType)) {
    throw new Error('Only GIF, JPG, PNG, and WEBP images are allowed');
  }
  if (input.buffer.length === 0 || input.buffer.length > MAX_TICKET_IMAGE_BYTES) {
    throw new Error(`Images must be smaller than ${Math.round(MAX_TICKET_IMAGE_BYTES / (1024 * 1024))} MB`);
  }
  const config = getStorageConfig();
  const key = [
    'tickets', 'images',
    new Date().toISOString().slice(0, 10),
    `${crypto.randomUUID()}-${sanitizeBaseName(input.fileName)}${resolveExtension(input.fileName, input.contentType)}`,
  ].join('/');
  await getS3Client().send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: input.buffer,
    ContentType: input.contentType,
  }));
  return { key, fileName: input.fileName, mimeType: input.contentType, size: input.buffer.length };
}

export async function uploadAvatarBuffer(input: {
  agentId: string;
  buffer: Buffer;
  contentType: string;
}): Promise<string> {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(input.contentType)) {
    throw new Error('Only GIF, JPG, PNG, and WEBP images are allowed');
  }
  const ext = resolveExtension('avatar', input.contentType) || '.jpg';
  const key = `avatars/${input.agentId}${ext}`;
  const config = getStorageConfig();
  await getS3Client().send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: input.buffer,
    ContentType: input.contentType,
  }));
  return key;
}

async function getAttachmentReadUrl(key: string): Promise<string> {
  const config = getStorageConfig();

  if (config.publicBaseUrl) {
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    return `${trimTrailingSlash(config.publicBaseUrl)}/${encodedKey}`;
  }

  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
    { expiresIn: config.readUrlTtlSeconds },
  );
}

/**
 * Resolves any R2 object key to a URL.
 * Uses S3_PUBLIC_BASE_URL if set (recommended for product catalog images),
 * otherwise falls back to a 15-minute signed URL.
 * Returns undefined if storage is not configured.
 */
export async function getObjectUrl(key: string): Promise<string | undefined> {
  // Direct URLs stored as avatarKey (e.g. AI agent DiceBear avatar) — return as-is
  if (key.startsWith('http://') || key.startsWith('https://')) return key;
  try {
    const config = getStorageConfig();
    if (config.publicBaseUrl) {
      const encodedKey = key.split('/').map(encodeURIComponent).join('/');
      return `${trimTrailingSlash(config.publicBaseUrl)}/${encodedKey}`;
    }
    return await getSignedUrl(
      getS3Client(),
      new GetObjectCommand({ Bucket: config.bucket, Key: key }),
      { expiresIn: config.readUrlTtlSeconds },
    );
  } catch {
    return undefined;
  }
}

export async function attachReadUrls<T extends { attachments?: IAttachment[] }>(entity: T) {
  if (!entity.attachments || entity.attachments.length === 0) {
    return {
      ...entity,
      attachments: [],
    } as T & { attachments: Array<IAttachment & { url?: string }> };
  }

  try {
    const attachments = await Promise.all(
      entity.attachments.map(async (attachment) => ({
        ...attachment,
        url: await getAttachmentReadUrl(attachment.key),
      })),
    );

    return {
      ...entity,
      attachments,
    };
  } catch {
    return {
      ...entity,
      attachments: entity.attachments.map((attachment) => ({ ...attachment })),
    };
  }
}
