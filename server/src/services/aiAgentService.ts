import { Ticket } from '../models/Ticket';
import { Product } from '../models/Product';
import { AI_AGENT_EMAIL } from '../models/User';
import { suggestReply, generateRemarketingPitch } from './aiService';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

/**
 * Runs the AI agent pipeline for a ticket.
 * @param force - When true (manual admin assignment), AI always replies regardless of eligibility.
 *                When false (auto-assignment), AI only replies if it assessed the ticket as eligible.
 */
export async function runAiAgentPipeline(ticketId: string, force = false): Promise<void> {
  try {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return;

    const result = await suggestReply({
      subject: ticket.title,
      message: ticket.description,
      summary: ticket.aiSummary ?? undefined,
    });

    if (force || result.autoReplyEligible) {
      // Attempt a remarketing pitch alongside the reply
      let replyBody = result.suggestedReply;
      try {
        const products = await Product.find({ isActive: true })
          .select('_id slug name category description')
          .lean();

        const catalog = products.map((p) => ({
          id:          String(p._id),
          name:        p.name,
          category:    p.category,
          description: p.description,
        }));

        const pitch = await generateRemarketingPitch({
          subject:           ticket.title,
          message:           ticket.description,
          productTitle:      ticket.product ? products.find((p) => String(p._id) === String(ticket.product))?.name : undefined,
          customerArchetype: ticket.mktArchetype ?? undefined,
          refundIntent:      ticket.mktRefundIntent ?? undefined,
          sentiment:         ticket.mktSentiment ?? undefined,
          catalog,
        });

        if (pitch.shouldPitch && pitch.appendedMessage) {
          const pickedProduct = products.find((p) => String(p._id) === pitch.productId);
          const productLink = pickedProduct?.slug
            ? `\n\nView product: ${APP_URL}/products?product=${pickedProduct.slug}`
            : '';
          replyBody += `\n\n${pitch.appendedMessage}${productLink}`;
        }
      } catch {
        // Remarketing failure is non-fatal — send the reply without it
      }

      await Ticket.findByIdAndUpdate(ticketId, {
        $push: {
          replies: {
            body:        replyBody,
            authorName:  'AI Agent',
            authorEmail: AI_AGENT_EMAIL,
            isAgent:     true,
          },
        },
        $set: { status: 'resolved' },
      });
    } else {
      // Not eligible — leave a note for the human agent, stay assigned
      await Ticket.findByIdAndUpdate(ticketId, {
        $push: {
          internalNotes: {
            body:       `AI Agent assessed this ticket as requiring human review.\nReason: ${result.reason}`,
            authorId:   'ai-agent',
            authorName: 'AI Agent',
          },
        },
      });
    }
  } catch (err) {
    console.error(`AI agent pipeline failed for ticket ${ticketId}:`, (err as Error).message);
  }
}
