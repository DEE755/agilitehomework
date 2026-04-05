const BASE_URL = (process.env.MAILGUN_BASE_URL ?? 'https://api.mailgun.net/v3').replace(/\/$/, '');
const DOMAIN   = process.env.MAILGUN_DOMAIN ?? '';
const API_KEY  = process.env.MAILGUN_API_KEY ?? '';
const FROM     = process.env.MAILGUN_FROM_EMAIL ?? `Agilite Support <no-reply@${DOMAIN}>`;

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

export async function sendAgentWelcomeEmail(
  toEmail: string,
  name: string,
  password: string,
): Promise<void> {
  const subject = 'Your Agilite Support Workspace account';
  const text = [
    `Hi ${name},`,
    '',
    'An account has been created for you on the Agilite Support Workspace.',
    '',
    `Email:    ${toEmail}`,
    `Password: ${password}`,
    '',
    'Please log in and change your password as soon as possible.',
    '',
    '— Agilite',
  ].join('\n');

  await sendMailgunMessage(toEmail, subject, text);
}
