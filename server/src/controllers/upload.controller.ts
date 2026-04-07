import type { Request, Response } from 'express';
import { createTicketImageUpload, uploadTicketImageBuffer } from '../services/storage';

// POST /api/uploads/ticket-images/presign
export async function presignTicketImageUpload(req: Request, res: Response): Promise<void> {
  const { fileName, contentType, size } = req.body as {
    fileName?: unknown;
    contentType?: unknown;
    size?: unknown;
  };

  if (typeof fileName !== 'string' || typeof contentType !== 'string') {
    res.status(400).json({ error: '"fileName" and "contentType" are required' });
    return;
  }

  const numericSize = typeof size === 'number' ? size : Number(size);
  if (!Number.isFinite(numericSize)) {
    res.status(400).json({ error: '"size" must be a number' });
    return;
  }

  try {
    const data = await createTicketImageUpload({
      fileName,
      contentType,
      size: numericSize,
    });

    res.status(201).json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Image upload is unavailable';
    const status =
      message.includes('Only ')
      || message.includes('Images must')
      || message.includes('"fileName"')
        ? 400
        : 503;

    res.status(status).json({ error: message });
  }
}

// POST /api/uploads/ticket-images  (proxy — browser sends file here, server puts to R2)
export async function proxyTicketImageUpload(req: Request, res: Response): Promise<void> {
  const rawName = req.headers['x-file-name'];
  const fileName = typeof rawName === 'string' ? decodeURIComponent(rawName) : 'image';
  const contentType = (typeof req.headers['content-type'] === 'string'
    ? req.headers['content-type']
    : ''
  ).split(';')[0].trim();
  const buffer = req.body instanceof Buffer ? req.body : Buffer.alloc(0);

  try {
    const attachment = await uploadTicketImageBuffer({ buffer, fileName, contentType });
    res.status(201).json({ data: { attachment } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    res.status(400).json({ error: message });
  }
}
