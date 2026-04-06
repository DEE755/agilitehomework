import type { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { Ticket } from '../models/Ticket';
import type { CreateTicketBody, CreateReplyBody } from '../types/ticket.types';
import { attachReadUrls, validateTicketAttachments } from '../services/storage';
import { triageTicket } from '../services/aiService';
import { getOrCreateSettings } from '../models/Setting';
import { User, AI_AGENT_EMAIL } from '../models/User';
import { notifyCustomerReplied } from '../services/notificationService';
import { runAiAgentPipeline } from '../services/aiAgentService';
import { sendTicketConfirmationEmail } from '../services/emailService';

// GET /api/tickets
export async function listTickets(req: Request, res: Response): Promise<void> {
  const { status, priority, page = '1', limit = '20' } = req.query;

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;

  const pageNum = Math.max(1, parseInt(String(page), 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10)));
  const skip = (pageNum - 1) * limitNum;

  const [tickets, total] = await Promise.all([
    Ticket.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).select('-replies'),
    Ticket.countDocuments(filter),
  ]);

  res.json({
    data: tickets,
    meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
  });
}

// GET /api/tickets/:ticketId
export async function getTicket(req: Request, res: Response): Promise<void> {
  const { ticketId } = req.params;

  if (!isValidObjectId(ticketId)) {
    res.status(400).json({ error: 'Invalid ticket ID' });
    return;
  }

  const ticket = await Ticket.findById(ticketId);

  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  res.json({ data: await attachReadUrls(ticket.toObject()) });
}

// POST /api/tickets
export async function createTicket(req: Request, res: Response): Promise<void> {
  const { title, description, authorName, authorEmail, productId, productName, productCategory, productDescription, productPrice, productImageUrl, productSlug } = req.body as CreateTicketBody;

  let attachments;
  try {
    attachments = validateTicketAttachments(req.body.attachments);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid attachments' });
    return;
  }

  const ticketData: {
    title: string;
    description: string;
    authorName: string;
    authorEmail: string;
    attachments: typeof attachments;
    product?: { _id: string; name: string; category?: string; description?: string | null; price?: number | null; imageUrl?: string | null; slug?: string | null };
  } = { title, description, authorName, authorEmail, attachments };

  if (productId && productName) {
    ticketData.product = {
      _id:         productId,
      name:        productName,
      category:    productCategory ?? undefined,
      description: productDescription ?? null,
      price:       productPrice ?? null,
      imageUrl:    productImageUrl ?? null,
      slug:        productSlug ?? null,
    };
  }

  let ticket;
  try {
    ticket = await Ticket.create(ticketData);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create ticket' });
    return;
  }

  res.status(201).json({ data: ticket });

  void sendTicketConfirmationEmail(ticket.authorEmail, ticket.authorName, String(ticket._id), ticket.title)
    .catch((err: unknown) => console.error('[createTicket] confirmation email failed:', err));

  // Fire-and-forget AI triage (+ optional auto-reply) — runs after response is sent
  void (async () => {
    try {
      const triageResult = await triageTicket({
        title:           ticketData.title,
        description,
        productTitle:    productName,
        productCategory: productCategory,
      });

      const isIrrelevant = triageResult.priority === 'irrelevant';

      if (isIrrelevant) {
        const aiAgent = await User.findOne({ email: AI_AGENT_EMAIL, isAiAgent: true });
        await Ticket.findByIdAndUpdate(ticket._id, {
          $set: {
            aiSummary:           triageResult.summary,
            aiPriority:          triageResult.priority,
            aiSuggestedNextStep: triageResult.suggestedNextStep,
            aiTags:              triageResult.tags,
            aiTriagedAt:         new Date(),
            status:              'resolved',
            assignedTo:          aiAgent?._id ?? null,
            aiAutoAssigned:      true,
          },
        });
        return;
      }

      await Ticket.findByIdAndUpdate(ticket._id, {
        $set: {
          aiSummary:           triageResult.summary,
          aiPriority:          triageResult.priority,
          aiSuggestedNextStep: triageResult.suggestedNextStep,
          aiTags:              triageResult.tags,
          aiTriagedAt:         new Date(),
        },
      });

      // If auto-reply is enabled, check eligibility before assigning to AI agent
      const settings = await getOrCreateSettings();
      if (!settings.autoReplyEnabled) return;

      const aiAgent = await User.findOne({ email: AI_AGENT_EMAIL, isAiAgent: true });
      if (!aiAgent) return;

      const { suggestReply } = await import('../services/aiService');
      const replyResult = await suggestReply({
        subject:         ticketData.title,
        message:         description,
        productTitle:    productName,
        productCategory: productCategory,
        summary:         triageResult.summary,
      });

      // Only assign to AI agent if it can actually handle this ticket
      if (!replyResult.autoReplyEligible) return;

      await Ticket.findByIdAndUpdate(ticket._id, {
        $push: {
          replies: {
            body:        replyResult.suggestedReply,
            authorName:  'AI Agent',
            authorEmail: AI_AGENT_EMAIL,
            isAgent:     true,
          },
        },
        $set: {
          status:         'resolved',
          assignedTo:     aiAgent._id,
          aiAutoAssigned: true,
        },
      });
    } catch (err) {
      console.error(`Post-create AI pipeline failed for ticket ${String(ticket._id)}:`, (err as Error).message);
    }
  })();
}

// POST /api/tickets/:ticketId/replies
export async function addReply(req: Request, res: Response): Promise<void> {
  const { ticketId } = req.params;

  if (!isValidObjectId(ticketId)) {
    res.status(400).json({ error: 'Invalid ticket ID' });
    return;
  }

  const ticket = await Ticket.findById(ticketId);

  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  const { body, authorName, authorEmail } = req.body as CreateReplyBody;

  ticket.replies.push({ body, authorName, authorEmail });
  if (ticket.status !== 'in_progress') ticket.status = 'in_progress';
  await ticket.save();

  const reply = ticket.replies[ticket.replies.length - 1];
  res.status(201).json({ data: reply });

  // If the ticket is handled by the AI agent, re-run the pipeline with the new message.
  // Otherwise notify the assigned human agent as usual.
  const aiAgent = await User.findOne({ isAiAgent: true }).lean();
  const isAiAssigned = aiAgent && ticket.assignedTo &&
    String(ticket.assignedTo) === String(aiAgent._id);

  if (isAiAssigned) {
    void runAiAgentPipeline(String(ticket._id), true).catch(
      (err: unknown) => console.error('[addReply] AI pipeline failed:', err),
    );
  } else if (ticket.assignedTo) {
    void notifyCustomerReplied(ticket.assignedTo as import('mongoose').Types.ObjectId, ticket._id, ticket.title).catch(
      (err: unknown) => console.error('[addReply] notify failed:', err),
    );
  }
}

// PATCH /api/tickets/:ticketId/close
export async function closeTicket(req: Request, res: Response): Promise<void> {
  const { ticketId } = req.params;

  if (!isValidObjectId(ticketId)) {
    res.status(400).json({ error: 'Invalid ticket ID' });
    return;
  }

  const ticket = await Ticket.findById(ticketId);

  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  ticket.status = 'resolved';
  await ticket.save();

  res.json({ data: ticket });
}

// GET /api/tickets/lookup?ticketId=...&email=...
export async function lookupTicket(req: Request, res: Response): Promise<void> {
  const { ticketId, email } = req.query;

  if (!ticketId || typeof ticketId !== 'string' || !isValidObjectId(ticketId)) {
    res.status(400).json({ error: 'Invalid or missing ticketId' });
    return;
  }

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Missing email' });
    return;
  }

  const ticket = await Ticket.findOne({
    _id: ticketId,
    authorEmail: email.toLowerCase().trim(),
  }).populate('product', 'name category');

  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found or email does not match' });
    return;
  }

  const safeReplies = ticket.replies.map((r) => ({
    body: r.body,
    authorName: r.authorName,
    isAgent: r.isAgent,
    createdAt: (r as unknown as { createdAt?: Date }).createdAt,
  }));

  res.json({
    data: {
      _id: ticket._id,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      authorName: ticket.authorName,
      authorEmail: ticket.authorEmail,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      product: ticket.product,
      replies: safeReplies,
    },
  });
}
