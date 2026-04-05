/**
 * AI service — routes LLM calls through the Pydantic AI Gateway (Bedrock Converse API).
 * Traced via Logfire.
 * All calls are made server-side only; no credentials reach the frontend.
 *
 * Required env vars:
 *   PYDANTIC_AI_GATEWAY_API_KEY   gateway API key
 *   PYDANTIC_GATEWAY_REGION       e.g. us
 *   PYDANTIC_ANTHROPIC_MODEL      e.g. claude-sonnet-4-6
 */

import * as logfire from '@pydantic/logfire-node';

export interface TriageResult {
  summary: string;
  priority: 'low' | 'medium' | 'high' | 'irrelevant';
  suggestedNextStep: string;
  tags: string[];
}

export interface SuggestReplyResult {
  summary:           string;
  priority:          'low' | 'medium' | 'high';
  tags:              string[];
  suggestedReply:    string;
  autoReplyEligible: boolean;
  confidence:        number;
  riskLevel:         'low' | 'medium' | 'high';
  reason:            string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function getAiConfig() {
  const apiKey = process.env.PYDANTIC_AI_GATEWAY_API_KEY ?? '';
  const region = process.env.PYDANTIC_GATEWAY_REGION ?? 'us';
  const model  = process.env.PYDANTIC_ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

  if (!apiKey) throw new Error('PYDANTIC_AI_GATEWAY_API_KEY is not configured');

  const url = `https://gateway-${region}.pydantic.dev/proxy/bedrock/model/${region}.anthropic.${model}/converse`;
  return { url, apiKey };
}

// ---------------------------------------------------------------------------
// Raw gateway call — Bedrock Converse API format
// ---------------------------------------------------------------------------

interface BedrockMessage {
  role: 'user' | 'assistant';
  content: Array<{ text: string }>;
}

async function chatCompletion(systemPrompt: string, userContent: string, timeoutMs = 30_000): Promise<string> {
  const { url, apiKey } = getAiConfig();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        system: [{ text: systemPrompt }],
        messages: [
          { role: 'user', content: [{ text: userContent }] },
        ] satisfies BedrockMessage[],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`AI gateway error ${res.status}: ${body.slice(0, 200)}`);
    }

    type BedrockResponse = {
      output: { message: { content: Array<{ text: string }> } };
    };
    const data = (await res.json()) as BedrockResponse;
    const text = data.output?.message?.content?.[0]?.text;
    if (!text) throw new Error('Empty response from AI gateway');
    // Extract JSON — strip markdown code fences if the model adds them
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in AI response');
    return match[0];
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Triage
// ---------------------------------------------------------------------------

const TRIAGE_SYSTEM_PROMPT = `You are an expert customer support triage agent for a premium tactical gear brand.
Analyse the support ticket and return a JSON object with exactly these fields:
{
  "summary": "One or two sentence plain-English summary of the customer's issue.",
  "priority": "low" | "medium" | "high" | "irrelevant",
  "suggestedNextStep": "One actionable sentence describing what the support agent should do next.",
  "tags": ["tag1", "tag2"]
}

Priority guidelines:
- high: safety concern, product defect, order lost, urgent operational need
- medium: functionality issue, shipping delay, sizing/fit question
- low: general inquiry, product information, minor cosmetic issue, friendly or casual messages (compliments, greetings, off-topic but benign messages — reply warmly and briefly)
- irrelevant: spam, gibberish, abusive or threatening language, test submissions ("asdf", "test 123"), solicitations, or hostile content

Use "irrelevant" only for clearly harmful or completely meaningless content. A casual "yo nice shirt!" or "love your products" is low priority and deserves a warm reply, not dismissal.
When priority is "irrelevant", set suggestedNextStep to "Auto-close this ticket." and tags to ["spam"] or ["abusive"] as appropriate.

Tags should be concise lowercase keywords (2-5 tags), e.g. ["shipping", "plate-carrier", "sizing"].
Respond with valid JSON only.`;

export async function triageTicket(input: {
  title: string;
  description: string;
  productTitle?: string;
  productCategory?: string;
}): Promise<TriageResult> {
  const context = [
    `Subject: ${input.title}`,
    input.productTitle ? `Product: ${input.productTitle}${input.productCategory ? ` (${input.productCategory})` : ''}` : null,
    `\nMessage:\n${input.description}`,
  ]
    .filter(Boolean)
    .join('\n');

  const content = await chatCompletion(TRIAGE_SYSTEM_PROMPT, context);

  type RawTriage = {
    summary?: unknown;
    priority?: unknown;
    suggestedNextStep?: unknown;
    tags?: unknown;
  };

  const parsed = JSON.parse(content) as RawTriage;

  const priority =
    parsed.priority === 'low' || parsed.priority === 'medium' || parsed.priority === 'high' || parsed.priority === 'irrelevant'
      ? parsed.priority
      : 'medium';

  return {
    summary:           typeof parsed.summary           === 'string' ? parsed.summary           : String(parsed.summary ?? ''),
    priority,
    suggestedNextStep: typeof parsed.suggestedNextStep === 'string' ? parsed.suggestedNextStep : String(parsed.suggestedNextStep ?? ''),
    tags:              Array.isArray(parsed.tags) ? (parsed.tags as unknown[]).map(String) : [],
  };
}

// ---------------------------------------------------------------------------
// Suggest Reply
// ---------------------------------------------------------------------------

const REPLY_SYSTEM_PROMPT = `You are an expert customer support AI for a premium tactical gear brand (Agilite).

Analyse the support ticket and return ONLY a JSON object with these exact fields:
{
  "summary": "1-2 sentence summary of the customer issue",
  "priority": "low" | "medium" | "high",
  "tags": ["tag1", "tag2"],
  "suggestedReply": "Full professional reply to send to the customer. Friendly but professional, specific, under 200 words. Sign off as Support Team.",
  "autoReplyEligible": true | false,
  "confidence": <number 0.0 to 1.0>,
  "riskLevel": "low" | "medium" | "high",
  "reason": "One sentence explaining the eligibility decision"
}

Priority: high = safety/defect/lost order, medium = shipping delay/functionality issue, low = general inquiry.

Auto-reply eligibility rules:
- ELIGIBLE (true): Simple informational requests, product specs, availability, general usage, care instructions, sizing questions with no dissatisfaction expressed. Also eligible: friendly or casual messages (compliments, greetings, off-topic but benign) — reply warmly and briefly.
- NOT ELIGIBLE (false): Damaged or defective items, missing parts, safety concerns, order problems, complaints, refund/return/exchange requests, any frustration or dissatisfaction expressed, ambiguous situations requiring human judgement.

When in doubt, set autoReplyEligible to false.
Respond with valid JSON only. No markdown, no code fences.`;

export async function suggestReply(input: {
  subject: string;
  message: string;
  productTitle?: string;
  productCategory?: string;
  summary?: string;
}): Promise<SuggestReplyResult> {
  const context = [
    `Subject: ${input.subject}`,
    input.productTitle ? `Product: ${input.productTitle}${input.productCategory ? ` (${input.productCategory})` : ''}` : null,
    input.summary ? `Issue summary: ${input.summary}` : null,
    `\nCustomer message:\n${input.message}`,
  ]
    .filter(Boolean)
    .join('\n');

  const content = await chatCompletion(REPLY_SYSTEM_PROMPT, context);

  type RawReply = {
    summary?: unknown; priority?: unknown; tags?: unknown;
    suggestedReply?: unknown; autoReplyEligible?: unknown;
    confidence?: unknown; riskLevel?: unknown; reason?: unknown;
  };
  const p = JSON.parse(content) as RawReply;

  const priority =
    p.priority === 'low' || p.priority === 'medium' || p.priority === 'high' ? p.priority : 'medium';
  const riskLevel =
    p.riskLevel === 'low' || p.riskLevel === 'medium' || p.riskLevel === 'high' ? p.riskLevel : 'medium';
  const confidence = typeof p.confidence === 'number'
    ? Math.min(1, Math.max(0, p.confidence))
    : 0.5;

  return {
    summary:           typeof p.summary        === 'string' ? p.summary        : '',
    priority,
    tags:              Array.isArray(p.tags) ? (p.tags as unknown[]).map(String) : [],
    suggestedReply:    typeof p.suggestedReply === 'string' ? p.suggestedReply : '',
    autoReplyEligible: p.autoReplyEligible === true,
    confidence,
    riskLevel,
    reason:            typeof p.reason         === 'string' ? p.reason         : '',
  };
}

// ---------------------------------------------------------------------------
// Customer self-service ask
// ---------------------------------------------------------------------------

const CUSTOMER_ASK_PROMPT = `You are a helpful support assistant for Agilite, a premium tactical gear brand.
A customer is asking a quick question before opening a support ticket. Help them concisely if you can.

Return a JSON object with exactly these fields:
{
  "answer": "2-4 sentence helpful answer. Friendly, professional, specific to tactical gear.",
  "shouldEscalate": true | false,
  "suggestedTitle": "A concise ticket title (max 80 chars) summarising the customer's issue, as if they wrote it themselves.",
  "suggestedDescription": "A clear 2-3 sentence ticket description written from the customer's perspective, expanding on their question with relevant context."
}

Set shouldEscalate to TRUE for:
- Damaged, defective, or missing items
- Order, shipping, or tracking issues
- Returns, refunds, or exchanges
- Safety concerns
- Anything requiring access to account or order data

Set shouldEscalate to FALSE for:
- Product specs, materials, or features
- Sizing and fit guidance
- Care and maintenance instructions
- General usage or compatibility questions

When in doubt, set shouldEscalate to true.
Respond with valid JSON only. No markdown, no code fences.`;

export interface CustomerAskResult {
  answer:               string;
  shouldEscalate:       boolean;
  suggestedTitle:       string;
  suggestedDescription: string;
}

export async function customerAsk(question: string, product?: { name: string; category?: string }): Promise<CustomerAskResult> {
  const context = product
    ? `Product: ${product.name}${product.category ? ` (${product.category})` : ''}\n\nQuestion: ${question}`
    : question;
  const content = await chatCompletion(CUSTOMER_ASK_PROMPT, context);
  const p = JSON.parse(content) as { answer?: unknown; shouldEscalate?: unknown; suggestedTitle?: unknown; suggestedDescription?: unknown };
  return {
    answer:               typeof p.answer               === 'string' ? p.answer               : '',
    shouldEscalate:       p.shouldEscalate !== false,
    suggestedTitle:       typeof p.suggestedTitle       === 'string' ? p.suggestedTitle       : question.slice(0, 80),
    suggestedDescription: typeof p.suggestedDescription === 'string' ? p.suggestedDescription : question,
  };
}

// ---------------------------------------------------------------------------
// Connection test
// ---------------------------------------------------------------------------

export async function testConnection(): Promise<string> {
  const { url, apiKey } = getAiConfig();

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      messages: [{ role: 'user', content: [{ text: 'Hello! Reply with a single short sentence.' }] }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`AI gateway error ${res.status}: ${body.slice(0, 200)}`);
  }

  type BedrockResponse = { output: { message: { content: Array<{ text: string }> } } };
  const data = (await res.json()) as BedrockResponse;
  const text = data.output?.message?.content?.[0]?.text;
  if (!text) throw new Error('Empty response from AI gateway');
  return text;
}
