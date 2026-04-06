import type { StoreInsightsResult } from './aiService';

const BASE_URL = (process.env.MAILGUN_BASE_URL ?? 'https://api.mailgun.net/v3').replace(/\/$/, '');
const DOMAIN   = process.env.MAILGUN_DOMAIN ?? '';
const API_KEY  = process.env.MAILGUN_API_KEY ?? '';
const FROM     = process.env.MAILGUN_FROM_EMAIL ?? `Agilate Support <no-reply@${DOMAIN}>`;
const APP_URL  = process.env.APP_URL ?? 'http://localhost:3000';

class MailgunError extends Error {}

async function sendMailgunMessage(to: string, subject: string, text: string): Promise<void> {
  if (!API_KEY) throw new MailgunError('MAILGUN_API_KEY is not configured.');
  if (!DOMAIN)  throw new MailgunError('MAILGUN_DOMAIN is not configured.');

  const body = new URLSearchParams({ from: FROM, to, subject, text });

  const res = await fetch(`${BASE_URL}/${DOMAIN}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${API_KEY}`).toString('base64')}`,
    },
    body,
  });

  if (!res.ok) {
    const preview = (await res.text()).slice(0, 300).replace(/\n/g, ' ');
    throw new MailgunError(`Mailgun request failed (${res.status}): ${preview}`);
  }
}

export async function sendTicketConfirmationEmail(
  toEmail: string,
  customerName: string,
  ticketId: string,
  ticketTitle: string,
): Promise<void> {
  const subject = 'Your support request has been received';
  const text = [
    `Hi ${customerName},`,
    '',
    'Your support request has been received. Here are your reference details:',
    '',
    `Ticket ID: ${ticketId}`,
    `Subject:   ${ticketTitle}`,
    '',
    'You can track your request and view replies at any time:',
    `${APP_URL}/support/lookup?id=${ticketId}&email=${toEmail}`,
    '',
    "We'll be in touch soon.",
    '',
    '— Agilate Support',
  ].join('\n');

  await sendMailgunMessage(toEmail, subject, text);
}

export async function sendAgentReplyEmail(
  toEmail: string,
  customerName: string,
  ticketId: string,
  ticketTitle: string,
  replyBody: string,
): Promise<void> {
  const subject = `Re: ${ticketTitle}`;
  const text = [
    `Hi ${customerName},`,
    '',
    'Your support team has replied to your ticket.',
    '',
    `Subject: ${ticketTitle}`,
    '',
    'Reply:',
    replyBody,
    '',
    '---',
    'View the full conversation and reply at:',
    `${APP_URL}/support/lookup?id=${ticketId}&email=${toEmail}`,
    '',
    `Ticket ID: ${ticketId}`,
    '',
    '— Agilate Support',
  ].join('\n');

  await sendMailgunMessage(toEmail, subject, text);
}

export async function sendAgentWelcomeEmail(
  toEmail: string,
  name: string,
  password: string,
): Promise<void> {
  const subject = 'Your Agilate Support Workspace account';
  const text = [
    `Hi ${name},`,
    '',
    'An account has been created for you on the Agilate Support Workspace.',
    '',
    `Email:    ${toEmail}`,
    `Password: ${password}`,
    '',
    'Sign in here:',
    `${APP_URL}/admin/login`,
    '',
    'Please change your password after your first login.',
    '',
    '— Agilate',
  ].join('\n');

  await sendMailgunMessage(toEmail, subject, text);
}

export async function sendInsightsReportEmail(toEmail: string, toName: string, insights: StoreInsightsResult, generatedAt: string): Promise<void> {
  const URGENCY_ICON: Record<string, string> = { high: '🔴', medium: '🟡', low: '🟢' };
  const MAG_ICON: Record<string, string>     = { high: '🔴', medium: '🟡', low: '🟢' };

  const lines = [
    `AI Store Insights Report — ${generatedAt}`,
    `Generated for: ${toName} <${toEmail}>`,
    '',
    `═══════════════════════════════════════`,
    `STORE HEALTH SCORE: ${insights.storeHealthScore.toFixed(1)} / 10`,
    `═══════════════════════════════════════`,
    '',
    insights.executiveSummary,
    '',
    '─── PRIORITY ACTIONS ───────────────────',
    ...insights.priorityActions.map((a) => `${a.rank}. ${a.action}\n   Why: ${a.rationale}`),
    '',
    '─── TOP ISSUES ─────────────────────────',
    ...insights.topIssues.map((i) => `${URGENCY_ICON[i.urgency] ?? '◈'} ${i.issue}\n   → ${i.recommendation}`),
    '',
    '─── CUSTOMER INTELLIGENCE ──────────────',
    ...insights.customerIntel.map((c) => `• ${c.insight}\n  Action: ${c.action}`),
    '',
    '─── REVENUE RISKS ───────────────────────',
    ...insights.revenueRisks.map((r) => `${MAG_ICON[r.magnitude] ?? '◈'} ${r.risk}\n   Mitigation: ${r.mitigation}`),
    '',
    '─── OPPORTUNITIES ───────────────────────',
    ...insights.opportunities.map((o) => `✦ ${o.opportunity}\n  Impact: ${o.potentialImpact}`),
    '',
    '─────────────────────────────────────────',
    'Powered by Agilate AI · Support Workspace',
  ];

  await sendMailgunMessage(toEmail, `Store AI Insights Report — ${generatedAt}`, lines.join('\n'));
}
