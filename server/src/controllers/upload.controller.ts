import type { Request, Response } from 'express';
import { createTicketImageUpload } from '../services/storage';

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
