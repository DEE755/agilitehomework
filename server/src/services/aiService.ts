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

// Multi-turn raw chat — returns plain text, no JSON extraction
async function chatRaw(
  systemPrompt: string,
  messages: BedrockMessage[],
  timeoutMs = 45_000,
): Promise<string> {
  const { url, apiKey } = getAiConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ system: [{ text: systemPrompt }], messages }),
      signal: controller.signal,
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
  } finally {
    clearTimeout(timer);
  }
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
// Customer Profile Analysis
// ---------------------------------------------------------------------------

const CUSTOMER_PROFILE_PROMPT = `You are an expert customer success and sales analyst for a premium tactical gear brand (Agilite).

Analyse the support ticket including subject, message, and any agent/customer conversation history to deeply profile the customer.

Return ONLY a JSON object with exactly these fields:
{
  "archetype": "early_adopter" | "loyal_advocate" | "price_sensitive" | "casual_buyer" | "frustrated_veteran",
  "archetypeLabel": "Human-readable label, e.g. 'Early Adopter'",
  "archetypeReason": "One concise sentence justifying the classification based on tone, language, or context.",
  "refundIntent": "low" | "medium" | "high",
  "refundIntentReason": "One sentence explaining refund/escalation likelihood.",
  "churnRisk": "low" | "medium" | "high",
  "sentiment": "positive" | "neutral" | "frustrated" | "hostile",
  "lifetimeValueSignal": "high" | "medium" | "low",
  "recommendedApproach": "One actionable sentence: the best way to handle this customer to maximise satisfaction and retention."
}

Archetype definitions:
- early_adopter: enthusiastic, mentions trying new products, excited about the brand, tolerates minor issues gracefully
- loyal_advocate: references past purchases, brand loyalty, long-term relationship signals, recommends to others
- price_sensitive: mentions price, asks for discounts or better deals, compares to competitors
- casual_buyer: generic tone, no strong brand attachment, one-time purchase feel
- frustrated_veteran: experienced customer who feels let down, entitled or demanding tone, past purchase references framed as disappointment

Refund intent signals:
- high: explicitly mentions refund/return/exchange, extreme frustration, product failed completely
- medium: dissatisfied, unhappy, exploring resolution options but not explicitly demanding a refund
- low: issue-focused, cooperative tone, looking for a fix or information rather than money back

Churn risk:
- high: ready to leave, compares negatively to competitors, says "last time" or "never again"
- medium: frustrated but still engaged with the brand
- low: issue is minor or customer seems loyal despite the problem

Sentiment: analyse the overall emotional tone.

Lifetime value signal:
- high: mentions multiple purchases, large orders, professional/military use, team purchases
- medium: regular consumer purchase, moderate engagement
- low: single low-value item, no loyalty signals

Respond with valid JSON only. No markdown, no code fences.`;

export interface CustomerProfileResult {
  archetype: 'early_adopter' | 'loyal_advocate' | 'price_sensitive' | 'casual_buyer' | 'frustrated_veteran';
  archetypeLabel: string;
  archetypeReason: string;
  refundIntent: 'low' | 'medium' | 'high';
  refundIntentReason: string;
  churnRisk: 'low' | 'medium' | 'high';
  sentiment: 'positive' | 'neutral' | 'frustrated' | 'hostile';
  lifetimeValueSignal: 'high' | 'medium' | 'low';
  recommendedApproach: string;
}

export async function analyzeCustomerProfile(input: {
  subject: string;
  message: string;
  productTitle?: string;
  conversationHistory?: string;
}): Promise<CustomerProfileResult> {
  const context = [
    `Subject: ${input.subject}`,
    input.productTitle ? `Product: ${input.productTitle}` : null,
    `\nCustomer message:\n${input.message}`,
    input.conversationHistory ? `\nConversation history:\n${input.conversationHistory}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const content = await chatCompletion(CUSTOMER_PROFILE_PROMPT, context);

  type Raw = {
    archetype?: unknown; archetypeLabel?: unknown; archetypeReason?: unknown;
    refundIntent?: unknown; refundIntentReason?: unknown; churnRisk?: unknown;
    sentiment?: unknown; lifetimeValueSignal?: unknown; recommendedApproach?: unknown;
  };
  const p = JSON.parse(content) as Raw;

  const archetypes = ['early_adopter', 'loyal_advocate', 'price_sensitive', 'casual_buyer', 'frustrated_veteran'] as const;
  const risks      = ['low', 'medium', 'high'] as const;
  const sentiments = ['positive', 'neutral', 'frustrated', 'hostile'] as const;

  return {
    archetype:            archetypes.includes(p.archetype as typeof archetypes[number]) ? (p.archetype as CustomerProfileResult['archetype']) : 'casual_buyer',
    archetypeLabel:       typeof p.archetypeLabel    === 'string' ? p.archetypeLabel    : String(p.archetypeLabel ?? ''),
    archetypeReason:      typeof p.archetypeReason   === 'string' ? p.archetypeReason   : '',
    refundIntent:         risks.includes(p.refundIntent as typeof risks[number])         ? (p.refundIntent as CustomerProfileResult['refundIntent'])         : 'medium',
    refundIntentReason:   typeof p.refundIntentReason === 'string' ? p.refundIntentReason : '',
    churnRisk:            risks.includes(p.churnRisk as typeof risks[number])            ? (p.churnRisk as CustomerProfileResult['churnRisk'])            : 'medium',
    sentiment:            sentiments.includes(p.sentiment as typeof sentiments[number])  ? (p.sentiment as CustomerProfileResult['sentiment'])            : 'neutral',
    lifetimeValueSignal:  risks.includes(p.lifetimeValueSignal as typeof risks[number])  ? (p.lifetimeValueSignal as CustomerProfileResult['lifetimeValueSignal']) : 'medium',
    recommendedApproach:  typeof p.recommendedApproach === 'string' ? p.recommendedApproach : '',
  };
}

// ---------------------------------------------------------------------------
// Remarketing Pitch Generator
// ---------------------------------------------------------------------------

const REMARKET_SYSTEM_PROMPT = `You are an expert product recommender for Agilite, a premium tactical gear brand.
Your goal is to suggest ONE product to cross-sell or upsell to a customer based on their support ticket context and customer profile, and generate a warm, non-pushy pitch.

You will receive: the customer's issue, their profile archetype, and a catalog of available products.

Rules:
- Pick a product that is COMPLEMENTARY or RELATED to the issue/product in the ticket — never recommend the same product
- Do NOT pitch to hostile customers or customers with HIGH refund intent — if you receive such a profile, still return a result but set pitchLine and appendedMessage to empty strings and set shouldPitch: false
- Be genuine and helpful, never salesy or pushy
- The appendedMessage is a soft add-on paragraph to append AFTER a support reply — keep it brief, warm, and natural (2-3 sentences max)

Return ONLY a JSON object:
{
  "shouldPitch": true | false,
  "productId": "...",
  "productName": "...",
  "matchReason": "One sentence: why this product is a great fit for this customer's situation.",
  "pitchLine": "One engaging sentence introducing the product. Friendly and authentic. Empty string if shouldPitch is false.",
  "appendedMessage": "2-3 sentence add-on paragraph to softly append to the support reply. Empty string if shouldPitch is false."
}

Respond with valid JSON only. No markdown, no code fences.`;

export interface RemarketingPitchResult {
  shouldPitch: boolean;
  productId: string;
  productName: string;
  matchReason: string;
  pitchLine: string;
  appendedMessage: string;
}

export interface CatalogProduct {
  id: string;
  name: string;
  category: string;
  description: string;
}

export async function generateRemarketingPitch(input: {
  subject: string;
  message: string;
  productTitle?: string;
  customerArchetype?: string;
  refundIntent?: string;
  sentiment?: string;
  catalog: CatalogProduct[];
  targetProductId?: string;  // if provided, use this product; skip AI catalog selection
  targetProductName?: string;
}): Promise<RemarketingPitchResult> {
  let catalogSection: string;
  let targetNote = '';

  if (input.targetProductId && input.targetProductName) {
    // Manual mode: only pitch for the specified product
    const target = input.catalog.find((p) => p.id === input.targetProductId);
    catalogSection = `Recommended product (manually selected by agent):\n- ID: ${input.targetProductId}\n  Name: ${input.targetProductName}\n  Category: ${target?.category ?? ''}\n  Description: ${target?.description ?? ''}`;
    targetNote = `\nIMPORTANT: The agent has manually selected the product above. Generate the pitch for ONLY that product. Set productId to "${input.targetProductId}" and productName to "${input.targetProductName}".`;
  } else {
    catalogSection = `Available product catalog (choose the BEST fit):\n${
      input.catalog.map((p) => `- ID: ${p.id}\n  Name: ${p.name}\n  Category: ${p.category}\n  Description: ${p.description.slice(0, 120)}`).join('\n')
    }`;
  }

  const context = [
    `Ticket subject: ${input.subject}`,
    input.productTitle ? `Customer's product: ${input.productTitle}` : null,
    `Customer message: ${input.message.slice(0, 600)}`,
    input.customerArchetype ? `Customer archetype: ${input.customerArchetype}` : null,
    input.refundIntent    ? `Refund intent: ${input.refundIntent}` : null,
    input.sentiment       ? `Sentiment: ${input.sentiment}` : null,
    `\n${catalogSection}`,
    targetNote || null,
  ]
    .filter(Boolean)
    .join('\n');

  const content = await chatCompletion(REMARKET_SYSTEM_PROMPT, context);

  type Raw = {
    shouldPitch?: unknown; productId?: unknown; productName?: unknown;
    matchReason?: unknown; pitchLine?: unknown; appendedMessage?: unknown;
  };
  const p = JSON.parse(content) as Raw;

  return {
    shouldPitch:       p.shouldPitch !== false,
    productId:         typeof p.productId    === 'string' ? p.productId    : '',
    productName:       typeof p.productName  === 'string' ? p.productName  : '',
    matchReason:       typeof p.matchReason  === 'string' ? p.matchReason  : '',
    pitchLine:         typeof p.pitchLine    === 'string' ? p.pitchLine    : '',
    appendedMessage:   typeof p.appendedMessage === 'string' ? p.appendedMessage : '',
  };
}

// ---------------------------------------------------------------------------
// Agent Coach — multi-turn commercial coaching chat
// ---------------------------------------------------------------------------

export interface CoachMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CoachContext {
  subject: string;
  message: string;
  productTitle?: string;
  // Customer Intelligence (Marketing Tools)
  archetype?: string;
  archetypeLabel?: string;
  archetypeReason?: string;
  refundIntent?: string;
  refundIntentReason?: string;
  churnRisk?: string;
  sentiment?: string;
  lifetimeValueSignal?: string;
  recommendedApproach?: string;
  // AI Insights (Triage)
  aiSummary?: string;
  aiPriority?: string;
  aiSuggestedNextStep?: string;
  aiTags?: string[];
  // Session
  intentionId: string;
  intentionLabel: string;
  intentionDescription: string;
}

function buildCoachSystemPrompt(ctx: CoachContext): string {
  const hasAiInsights = !!(ctx.aiSummary || ctx.aiPriority);
  const hasCustomerProfile = !!(ctx.archetypeLabel || ctx.refundIntent);

  const aiInsightsSection = hasAiInsights
    ? [
        ctx.aiPriority          ? `- Priority: ${ctx.aiPriority}` : null,
        ctx.aiSummary           ? `- Summary: ${ctx.aiSummary}` : null,
        ctx.aiSuggestedNextStep ? `- Suggested next step: ${ctx.aiSuggestedNextStep}` : null,
        ctx.aiTags?.length      ? `- Tags: ${ctx.aiTags.join(', ')}` : null,
      ].filter(Boolean).join('\n')
    : '- Not yet run. If asked, advise the agent to click "AI Insights" on the ticket to generate triage data.';

  const profileSection = hasCustomerProfile
    ? [
        ctx.archetypeLabel     ? `- Archetype: ${ctx.archetypeLabel}${ctx.archetypeReason ? ` — ${ctx.archetypeReason}` : ''}` : null,
        ctx.refundIntent       ? `- Refund intent: ${ctx.refundIntent}${ctx.refundIntentReason ? ` — ${ctx.refundIntentReason}` : ''}` : null,
        ctx.churnRisk          ? `- Churn risk: ${ctx.churnRisk}` : null,
        ctx.sentiment          ? `- Sentiment: ${ctx.sentiment}` : null,
        ctx.lifetimeValueSignal ? `- Lifetime value signal: ${ctx.lifetimeValueSignal}` : null,
        ctx.recommendedApproach ? `- Recommended approach: ${ctx.recommendedApproach}` : null,
      ].filter(Boolean).join('\n')
    : '- Not yet run. If asked, advise the agent to click "Customer Intelligence" in the Marketing Tools panel to profile this customer.';

  const missingToolsNote = (!hasAiInsights || !hasCustomerProfile)
    ? `\nNote — missing data: ${[
        !hasAiInsights ? '"AI Insights" (triage/priority)' : null,
        !hasCustomerProfile ? '"Customer Intelligence" (customer profile)' : null,
      ].filter(Boolean).join(' and ')} ${!hasAiInsights && !hasCustomerProfile ? 'have' : 'has'} not been run yet. Proactively mention this when relevant and tell the agent where to find the button.`
    : '';

  return `You are an expert customer success coach and commercial strategist coaching a support agent in real time for Agilite, a premium tactical gear brand.

Your role: give sharp, actionable, field-ready guidance. Think like a senior sales manager briefing a rep before a difficult call — direct, tactical, no fluff. Keep responses focused (150–250 words unless the agent asks for more detail).

When suggesting exact phrases the agent can use with the customer, format them on their own line like this:
→ "Exact suggested wording here."

You are also aware of the following tools available on the ticket page that the agent can run at any time:
- "AI Insights" button: runs automated triage — generates a priority level, issue summary, suggested next step, and tags.
- "Customer Intelligence" button (in the Marketing Tools section): profiles the customer — archetype, refund intent, churn risk, sentiment, lifetime value, and recommended approach.
If you believe running one of these would significantly improve your guidance, proactively tell the agent to run it.${missingToolsNote}

Ticket context:
- Subject: ${ctx.subject}
- Customer message: ${ctx.message.slice(0, 500)}${ctx.message.length > 500 ? '…' : ''}
${ctx.productTitle ? `- Product: ${ctx.productTitle}` : ''}

AI Insights (triage):
${aiInsightsSection}

Customer Intelligence profile:
${profileSection}

Agent's objective for this interaction: ${ctx.intentionLabel}
${ctx.intentionDescription}

On the first message, deliver a crisp tactical briefing structured as:
1. What this customer really needs (emotionally and practically)
2. The key risk or opportunity in this ticket
3. Your recommended opening move
4. One thing to avoid

If key data (AI Insights or Customer Intelligence) is missing, mention it briefly as step 0 before the briefing. Then invite follow-up questions. Stay in coach mode throughout — always advise, never act as the customer or the agent directly.`;
}

export async function agentCoachChat(
  ctx: CoachContext,
  history: CoachMessage[],
): Promise<string> {
  const systemPrompt = buildCoachSystemPrompt(ctx);

  // Convert to Bedrock format
  const messages: BedrockMessage[] = history.map((m) => ({
    role: m.role,
    content: [{ text: m.content }],
  }));

  // Bedrock requires the conversation to start with 'user'
  if (messages.length === 0 || messages[0].role !== 'user') {
    messages.unshift({
      role: 'user',
      content: [{ text: 'Give me your opening briefing for this ticket.' }],
    });
  }

  return chatRaw(systemPrompt, messages);
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
