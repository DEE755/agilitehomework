import type { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { triageTicket, suggestReply, testConnection, customerAsk } from '../services/aiService';
import { Ticket } from '../models/Ticket';

// POST /api/ai/triage-ticket
export async function triageTicketHandler(req: Request, res: Response): Promise<void> {
  const { ticketId, subject, message, productTitle, productCategory } = req.body as {
    ticketId?: unknown;
    subject?: unknown;
    message?: unknown;
    productTitle?: unknown;
    productCategory?: unknown;
  };

  if (typeof subject !== 'string' || !subject.trim()) {
    res.status(400).json({ error: '"subject" is required' });
    return;
  }
  if (typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: '"message" is required' });
    return;
  }

  try {
    const result = await triageTicket({
      title:           subject.trim(),
      description:     message.trim(),
      productTitle:    typeof productTitle    === 'string' ? productTitle.trim()    : undefined,
      productCategory: typeof productCategory === 'string' ? productCategory.trim() : undefined,
    });

    // Persist AI fields on the ticket document if a valid ticketId was provided
    if (typeof ticketId === 'string' && isValidObjectId(ticketId)) {
      await Ticket.findByIdAndUpdate(ticketId, {
        $set: {
          aiSummary:           result.summary,
          aiPriority:          result.priority,
          aiSuggestedNextStep: result.suggestedNextStep,
          aiTags:              result.tags,
          aiTriagedAt:         new Date(),
        },
      });
    }

    res.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI triage failed';
    const status = message.includes('not configured') ? 503 : 502;
    res.status(status).json({ error: message });
  }
}

// POST /api/ai/suggest-reply
export async function suggestReplyHandler(req: Request, res: Response): Promise<void> {
  const { subject, message, productTitle, productCategory, summary } = req.body as {
    subject?: unknown;
    message?: unknown;
    productTitle?: unknown;
    productCategory?: unknown;
    summary?: unknown;
  };

  if (typeof subject !== 'string' || !subject.trim()) {
    res.status(400).json({ error: '"subject" is required' });
    return;
  }
  if (typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: '"message" is required' });
    return;
  }

  try {
    const result = await suggestReply({
      subject:         subject.trim(),
      message:         message.trim(),
      productTitle:    typeof productTitle    === 'string' ? productTitle.trim()    : undefined,
      productCategory: typeof productCategory === 'string' ? productCategory.trim() : undefined,
      summary:         typeof summary         === 'string' ? summary.trim()         : undefined,
    });

    res.json({ data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI suggestion failed';
    const status = msg.includes('not configured') ? 503 : 502;
    res.status(status).json({ error: msg });
  }
}

// POST /api/ai/ask  (no auth — customer-facing)
export async function customerAskHandler(req: Request, res: Response): Promise<void> {
  const { question, productName, productCategory } = req.body as {
    question?: unknown;
    productName?: string;
    productCategory?: string;
  };
  if (typeof question !== 'string' || !question.trim()) {
    res.status(400).json({ error: '"question" is required' });
    return;
  }
  try {
    const product = productName ? { name: productName, category: productCategory } : undefined;
    const result = await customerAsk(question.trim(), product);
    res.json({ data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI unavailable';
    const status = msg.includes('not configured') ? 503 : 502;
    res.status(status).json({ error: msg });
  }
}

// POST /api/ai/test
export async function testHandler(_req: Request, res: Response): Promise<void> {
  try {
    const reply = await testConnection();
    res.json({ data: { reply } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI test failed';
    const status = msg.includes('not configured') ? 503 : 502;
    res.status(status).json({ error: msg });
  }
}
