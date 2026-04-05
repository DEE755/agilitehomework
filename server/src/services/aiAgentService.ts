import { Ticket } from '../models/Ticket';
import { AI_AGENT_EMAIL } from '../models/User';
import { suggestReply } from './aiService';

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
      await Ticket.findByIdAndUpdate(ticketId, {
        $push: {
          replies: {
            body:        result.suggestedReply,
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
