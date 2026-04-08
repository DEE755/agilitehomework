import { Ticket } from '../models/Ticket';
import { Product } from '../models/Product';
import { User, AI_AGENT_EMAIL } from '../models/User';
import { suggestReply, generateRemarketingPitch } from './aiService';
import { notifyAiEscalated } from './notificationService';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

/**
 * Runs the AI agent pipeline for a ticket.
 * Called on initial assignment (force=true) and whenever the customer sends a follow-up reply.
 *
 * If the AI determines the conversation is beyond automated handling it:
 *  1. Reassigns the ticket to the human who originally assigned the AI (aiAssignedBy).
 *  2. Sends that agent an in-app + email notification.
 *  3. Sets aiEscalated = true so the UI can surface a badge.
 *  4. Leaves an internal note explaining the reason.
 */
export async function runAiAgentPipeline(ticketId: string, force = false): Promise<void> {
  try {
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return;

    // Build full conversation history so the AI has complete context
    const conversationHistory = ticket.replies.map((r) => ({
      role: r.isAgent ? 'agent' as const : 'customer' as const,
      body: r.body,
    }));

    const result = await suggestReply({
      subject:             ticket.title,
      message:             ticket.description,
      productTitle:        ticket.product?.name,
      productCategory:     ticket.product?.category,
      productDescription:  ticket.product?.description ?? undefined,
      summary:             ticket.aiSummary ?? undefined,
      conversationHistory: conversationHistory.length ? conversationHistory : undefined,
    });

    if (force || result.autoReplyEligible) {
      // Attempt a remarketing pitch alongside the reply
      let replyBody = result.suggestedReply;
      try {
        const products = await Product.find({ isActive: true })
          .select('_id slug name category description')
          .lean();

        const catalog = products.map((p) => ({
          name:        p.name,
          category:    p.category,
          description: p.description,
        }));

        const pitch = await generateRemarketingPitch({
          subject:           ticket.title,
          message:           ticket.description,
          productTitle:      ticket.product ? products.find((p) => String(p._id) === String(ticket.product))?.name : undefined,
          customerArchetype: ticket.mktArchetype ?? undefined,
          sentiment:         ticket.mktSentiment ?? undefined,
          catalog,
        });

        if (pitch.shouldPitch && pitch.appendedMessage) {
          const pickedProduct = products.find((p) => p.name.toLowerCase() === pitch.productName.toLowerCase());
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
        $set: { status: 'resolved', aiResolvedAt: new Date() },
      });

    } else {
      // AI determined this ticket needs human expertise — escalate

      const aiAssignedBy = ticket.get('aiAssignedBy') as import('mongoose').Types.ObjectId | null | undefined;
      const escalateTo   = aiAssignedBy ?? null;

      const updateFields: Record<string, unknown> = {
        aiEscalated: true,
        status:      'in_progress',
      };

      if (escalateTo) {
        // Reassign to the human who originally assigned the AI
        updateFields.assignedTo = escalateTo;
      } else {
        // No known assigner — unassign so the ticket appears in the queue
        updateFields.assignedTo = null;
      }

      await Ticket.findByIdAndUpdate(ticketId, {
        $set:  updateFields,
        $push: {
          internalNotes: {
            body: [
              'AI Agent determined this ticket requires human intervention.',
              `Reason: ${result.reason}`,
              escalateTo
                ? 'The ticket has been reassigned to the agent who originally delegated it to the AI.'
                : 'No original assignee on record — ticket has been returned to the unassigned queue.',
            ].join('\n'),
            authorId:   'ai-agent',
            authorName: 'AI Agent',
          },
        },
      });

      if (escalateTo) {
        // Verify the target agent still exists before notifying
        const targetAgent = await User.findById(escalateTo).lean();
        if (targetAgent && !targetAgent.isAiAgent) {
          void notifyAiEscalated(escalateTo, ticket._id, ticket.title).catch(
            (err: unknown) => console.error('[aiAgentPipeline] escalation notify failed:', err),
          );
        }
      }
    }
  } catch (err) {
    console.error(`AI agent pipeline failed for ticket ${ticketId}:`, (err as Error).message);
  }
}
