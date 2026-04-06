import { Types } from 'mongoose';
import { Notification } from '../models/Notification';
import { User } from '../models/User';

async function sendNotificationEmail(toEmail: string, subject: string, text: string): Promise<void> {
  const BASE_URL = (process.env.MAILGUN_BASE_URL ?? 'https://api.mailgun.net/v3').replace(/\/$/, '');
  const DOMAIN   = process.env.MAILGUN_DOMAIN ?? '';
  const API_KEY  = process.env.MAILGUN_API_KEY ?? '';
  const FROM     = process.env.MAILGUN_FROM_EMAIL ?? `Agilate Support <no-reply@${DOMAIN}>`;

  if (!API_KEY || !DOMAIN) {
    console.warn('[notificationService] Mailgun not configured — skipping email');
    return;
  }

  const body = new URLSearchParams({ from: FROM, to: toEmail, subject, text });
  const res = await fetch(`${BASE_URL}/${DOMAIN}/messages`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`api:${API_KEY}`).toString('base64')}` },
    body,
  });

  if (!res.ok) {
    const preview = (await res.text()).slice(0, 200);
    console.error(`[notificationService] Mailgun error (${res.status}): ${preview}`);
  }
}

export async function notifyAssigned(
  agentId: Types.ObjectId | string,
  ticketId: Types.ObjectId | string,
  ticketTitle: string,
): Promise<void> {
  const message = `You have been assigned to ticket: "${ticketTitle}"`;

  await Notification.create({ agentId, type: 'ticket_assigned', ticketId, ticketTitle, message });

  const agent = await User.findById(agentId).lean();
  if (agent && !agent.isAiAgent) {
    void sendNotificationEmail(
      agent.email,
      '[Agilate] New ticket assigned to you',
      [`Hi ${agent.name},`, '', message, '', 'Log in to the Agilate Support Workspace to respond.', '', '— Agilate'].join('\n'),
    ).catch((err: unknown) => console.error('[notificationService] Email failed:', err));
  }
}

export async function notifyAiEscalated(
  agentId: Types.ObjectId | string,
  ticketId: Types.ObjectId | string,
  ticketTitle: string,
): Promise<void> {
  const message = `AI Agent flagged ticket "${ticketTitle}" for human review and has reassigned it to you.`;

  await Notification.create({ agentId, type: 'ai_escalated', ticketId, ticketTitle, message });

  const agent = await User.findById(agentId).lean();
  if (agent && !agent.isAiAgent) {
    void sendNotificationEmail(
      agent.email,
      '[Agilate] AI Agent escalated a ticket to you',
      [
        `Hi ${agent.name},`,
        '',
        `The AI Agent was unable to fully resolve ticket "${ticketTitle}" and has determined it requires human expertise.`,
        '',
        'The ticket has been reassigned to you. Please review the conversation and take over.',
        '',
        '— Agilate Support System',
      ].join('\n'),
    ).catch((err: unknown) => console.error('[notificationService] Email failed:', err));
  }
}

export async function notifyCustomerReplied(
  agentId: Types.ObjectId | string,
  ticketId: Types.ObjectId | string,
  ticketTitle: string,
): Promise<void> {
  const message = `A customer replied on ticket: "${ticketTitle}"`;

  await Notification.create({ agentId, type: 'customer_replied', ticketId, ticketTitle, message });

  const agent = await User.findById(agentId).lean();
  if (agent && !agent.isAiAgent) {
    void sendNotificationEmail(
      agent.email,
      '[Agilate] Customer replied on your ticket',
      [`Hi ${agent.name},`, '', message, '', 'Log in to the Agilate Support Workspace to respond.', '', '— Agilate'].join('\n'),
    ).catch((err: unknown) => console.error('[notificationService] Email failed:', err));
  }
}
