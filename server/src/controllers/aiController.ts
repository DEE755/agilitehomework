import type { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { triageTicket, suggestReply, testConnection, customerAsk, analyzeCustomerProfile, generateRemarketingPitch, agentCoachChat, productFinderChat } from '../services/aiService';
import type { CoachMessage, CoachContext, FinderMessage } from '../services/aiService';
import { ProductFinderLead } from '../models/ProductFinderLead';
import { Ticket } from '../models/Ticket';
import { Product } from '../models/Product';
import { getOrCreateSettings } from '../models/Setting';

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
  const { subject, message, productTitle, productCategory, productDescription, summary, agentDraft, goal, conversationHistory } = req.body as {
    subject?: unknown;
    message?: unknown;
    productTitle?: unknown;
    productCategory?: unknown;
    productDescription?: unknown;
    summary?: unknown;
    agentDraft?: unknown;
    goal?: unknown;
    conversationHistory?: unknown;
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
    const history = Array.isArray(conversationHistory)
      ? (conversationHistory as { role?: unknown; body?: unknown }[])
          .filter((m) => (m.role === 'customer' || m.role === 'agent') && typeof m.body === 'string')
          .map((m) => ({ role: m.role as 'customer' | 'agent', body: m.body as string }))
      : undefined;

    const result = await suggestReply({
      subject:             subject.trim(),
      message:             message.trim(),
      productTitle:        typeof productTitle        === 'string' ? productTitle.trim()        : undefined,
      productCategory:     typeof productCategory     === 'string' ? productCategory.trim()     : undefined,
      productDescription:  typeof productDescription  === 'string' ? productDescription.trim()  : undefined,
      summary:             typeof summary             === 'string' ? summary.trim()             : undefined,
      agentDraft:          typeof agentDraft          === 'string' ? agentDraft.trim()          : undefined,
      goal:                typeof goal                === 'string' ? goal.trim()                : undefined,
      conversationHistory: history,
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

// POST /api/ai/customer-profile
export async function customerProfileHandler(req: Request, res: Response): Promise<void> {
  const { ticketId, subject, message, productTitle, conversationHistory } = req.body as {
    ticketId?: unknown; subject?: unknown; message?: unknown;
    productTitle?: unknown; conversationHistory?: unknown;
  };

  if (typeof subject !== 'string' || !subject.trim()) {
    res.status(400).json({ error: '"subject" is required' }); return;
  }
  if (typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: '"message" is required' }); return;
  }

  try {
    const result = await analyzeCustomerProfile({
      subject:             subject.trim(),
      message:             message.trim(),
      productTitle:        typeof productTitle        === 'string' ? productTitle.trim()        : undefined,
      conversationHistory: typeof conversationHistory === 'string' ? conversationHistory.trim() : undefined,
    });

    // Persist profile on ticket if ticketId provided
    if (typeof ticketId === 'string' && isValidObjectId(ticketId)) {
      await Ticket.findByIdAndUpdate(ticketId, {
        $set: {
          mktArchetype:           result.archetype,
          mktArchetypeLabel:      result.archetypeLabel,
          mktArchetypeReason:     result.archetypeReason,
          mktRefundIntent:        result.refundIntent,
          mktRefundIntentReason:  result.refundIntentReason,
          mktChurnRisk:           result.churnRisk,
          mktSentiment:           result.sentiment,
          mktLifetimeValueSignal: result.lifetimeValueSignal,
          mktRecommendedApproach: result.recommendedApproach,
          mktProfiledAt:          new Date(),
        },
      });
    }

    res.json({ data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Customer profile analysis failed';
    const status = msg.includes('not configured') ? 503 : 502;
    res.status(status).json({ error: msg });
  }
}

// POST /api/ai/remarket
export async function remarketHandler(req: Request, res: Response): Promise<void> {
  const { subject, message, productTitle, customerArchetype, sentiment, targetProductId } = req.body as {
    subject?: unknown; message?: unknown; productTitle?: unknown;
    customerArchetype?: unknown; sentiment?: unknown;
    targetProductId?: unknown;
  };

  if (typeof subject !== 'string' || !subject.trim()) {
    res.status(400).json({ error: '"subject" is required' }); return;
  }
  if (typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: '"message" is required' }); return;
  }

  try {
    // Use the same external catalog as the storefront and admin products panel
    const EXTERNAL_CATALOG = 'https://api.escuelajs.co/api/v1/products?limit=20';
    const CAT_NAMES: Record<number, string> = { 1: 'Clothes', 2: 'Electronics', 3: 'Furniture', 4: 'Shoes', 5: 'Miscellaneous' };
    const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').trim();

    type ExtP = { id: number; title: string; price: number; description: string; category: { id: number }; images: string[] };

    const [catalogRes, appSettings] = await Promise.all([
      fetch(EXTERNAL_CATALOG),
      getOrCreateSettings(),
    ]);
    if (!catalogRes.ok) throw new Error('Product catalog unavailable');

    const rawProducts = (await catalogRes.json()) as ExtP[];
    const extProducts = rawProducts
      .map((p) => ({
        id:          String(p.id),
        name:        stripHtml(p.title ?? ''),
        category:    CAT_NAMES[p.category?.id] ?? 'Miscellaneous',
        description: stripHtml(p.description ?? ''),
        imageUrl:    p.images?.[0] ?? null,
      }))
      .filter((p) => p.name);

    const catalog = extProducts.map((p) => ({
      name: p.name, category: p.category, description: p.description,
    }));

    // Manual mode: find product by its external ID
    let targetProductName: string | undefined;
    if (typeof targetProductId === 'string' && targetProductId) {
      const found = extProducts.find((p) => p.id === targetProductId);
      targetProductName = found?.name;
    }

    const result = await generateRemarketingPitch({
      subject:           subject.trim(),
      message:           message.trim(),
      productTitle:      typeof productTitle      === 'string' ? productTitle.trim() : undefined,
      customerArchetype: typeof customerArchetype === 'string' ? customerArchetype   : undefined,
      sentiment:         typeof sentiment         === 'string' ? sentiment           : undefined,
      catalog,
      targetProductName,
      force: appSettings.forceRecommendations,
    });

    // Find the picked product for its image URL
    const pickedProduct = result.productName
      ? extProducts.find((p) => p.name.toLowerCase() === result.productName.toLowerCase())
      : null;
    const productId  = pickedProduct?.id ?? '';
    const imageUrl   = pickedProduct?.imageUrl ?? null;

    res.json({ data: { ...result, productId, imageUrl, productSlug: null } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Remarketing generation failed';
    const status = msg.includes('not configured') ? 503 : 502;
    res.status(status).json({ error: msg });
  }
}

// POST /api/ai/coach
export async function agentCoachHandler(req: Request, res: Response): Promise<void> {
  const {
    subject, message, productTitle,
    archetype, archetypeLabel, refundIntent, churnRisk, sentiment, lifetimeValueSignal, recommendedApproach,
    intentionId, intentionLabel, intentionDescription,
    history,
  } = req.body as {
    subject?: unknown; message?: unknown; productTitle?: unknown;
    archetype?: unknown; archetypeLabel?: unknown; refundIntent?: unknown;
    churnRisk?: unknown; sentiment?: unknown; lifetimeValueSignal?: unknown;
    recommendedApproach?: unknown;
    intentionId?: unknown; intentionLabel?: unknown; intentionDescription?: unknown;
    history?: unknown;
  };

  if (typeof subject !== 'string' || !subject.trim()) {
    res.status(400).json({ error: '"subject" is required' }); return;
  }
  if (typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: '"message" is required' }); return;
  }
  if (typeof intentionId !== 'string' || !intentionId.trim()) {
    res.status(400).json({ error: '"intentionId" is required' }); return;
  }

  // Validate and sanitize history
  const safeHistory: CoachMessage[] = [];
  if (Array.isArray(history)) {
    for (const item of history as unknown[]) {
      if (
        item && typeof item === 'object' &&
        'role' in item && 'content' in item &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string'
      ) {
        safeHistory.push({ role: item.role as 'user' | 'assistant', content: item.content });
      }
    }
  }

  const ctx: CoachContext = {
    subject:              subject.trim(),
    message:              message.trim(),
    productTitle:         typeof productTitle         === 'string' ? productTitle.trim()         : undefined,
    archetype:            typeof archetype            === 'string' ? archetype                   : undefined,
    archetypeLabel:       typeof archetypeLabel       === 'string' ? archetypeLabel              : undefined,
    refundIntent:         typeof refundIntent         === 'string' ? refundIntent                : undefined,
    churnRisk:            typeof churnRisk            === 'string' ? churnRisk                   : undefined,
    sentiment:            typeof sentiment            === 'string' ? sentiment                   : undefined,
    lifetimeValueSignal:  typeof lifetimeValueSignal  === 'string' ? lifetimeValueSignal         : undefined,
    recommendedApproach:  typeof recommendedApproach  === 'string' ? recommendedApproach         : undefined,
    intentionId:          intentionId.trim(),
    intentionLabel:       typeof intentionLabel       === 'string' ? intentionLabel.trim()       : intentionId.trim(),
    intentionDescription: typeof intentionDescription === 'string' ? intentionDescription.trim() : '',
  };

  try {
    const reply = await agentCoachChat(ctx, safeHistory);
    res.json({ data: { reply } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Coach unavailable';
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

// POST /api/ai/finder  (public — no auth)
export async function productFinderHandler(req: Request, res: Response): Promise<void> {
  const { history, email } = req.body as {
    history?: unknown;
    email?: unknown;
  };

  const safeHistory: FinderMessage[] = Array.isArray(history)
    ? (history as { role?: unknown; content?: unknown }[])
        .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content as string }))
    : [];

  try {
    const products = await Product.find({ isActive: true })
      .select('slug name category description price')
      .lean();

    const catalog = products.map((p) => ({
      slug:        p.slug,
      name:        p.name,
      category:    p.category,
      description: p.description,
      price:       p.price ?? null,
    }));

    const result = await productFinderChat(safeHistory, catalog);

    // Fire-and-forget: save/update lead when AI has profile data or recommendations
    if (result.recommendations.length > 0 || result.profile.useCase) {
      void ProductFinderLead.create({
        email:            typeof email === 'string' && email.trim() ? email.trim() : undefined,
        profile:          result.profile,
        recommendedSlugs: result.recommendations,
        messageCount:     safeHistory.length + 1,
        rawHistory:       [...safeHistory, { role: 'assistant', content: result.message }],
      }).catch(() => { /* non-fatal */ });
    }

    res.json({ data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Product finder failed';
    const status = msg.includes('not configured') ? 503 : 502;
    res.status(status).json({ error: msg });
  }
}
