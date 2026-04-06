import type { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import bcrypt from 'bcryptjs';
import { Ticket } from '../models/Ticket';
import { User, AI_AGENT_EMAIL } from '../models/User';
import { Product } from '../models/Product';
import { getOrCreateSettings } from '../models/Setting';
import { runAiAgentPipeline } from '../services/aiAgentService';
import { generateStoreInsights } from '../services/aiService';
import type { TicketStatus, TicketPriority } from '../types/ticket.types';
import type { AgentRole } from '../types/auth.types';
import { attachReadUrls, getObjectUrl, createAvatarUpload } from '../services/storage';
import { sendAgentWelcomeEmail, sendAgentReplyEmail, sendInsightsReportEmail } from '../services/emailService';
import { Notification } from '../models/Notification';
import { notifyAssigned } from '../services/notificationService';

function getActingAgent(req: Request) {
  return req.agent ?? {
    _id: 'support-team',
    name: 'Support Team',
    email: 'support@agilate.com',
    role: 'agent',
  };
}

// GET /api/admin/stats
export async function getStats(req: Request, res: Response): Promise<void> {
  const [counts, unassigned] = await Promise.all([
    Ticket.aggregate<{ _id: TicketStatus; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Ticket.countDocuments({ assignedTo: null, status: { $in: ['new', 'in_progress'] } }),
  ]);

  const stats: Record<string, number> = { new: 0, in_progress: 0, resolved: 0 };
  for (const { _id, count } of counts) stats[_id] = count;
  stats.total = Object.values(stats).reduce((a, b) => a + b, 0);
  stats.unassigned = unassigned;

  res.json({ data: stats });
}

// GET /api/admin/tickets
export async function listAdminTickets(req: Request, res: Response): Promise<void> {
  const { status, priority, assignedTo, tag, page = '1', limit = '20' } = req.query;

  const filter: Record<string, unknown> = {};
  if (status === 'unresolved') filter.status = { $in: ['new', 'in_progress'] };
  else if (status)             filter.status = status;
  if (priority)                filter.aiPriority = priority;
  if (tag)        filter.aiTags     = tag;        // matches any ticket whose aiTags array contains this value
  if (assignedTo === 'unassigned') filter.assignedTo = null;
  else if (assignedTo) filter.assignedTo = assignedTo;

  const pageNum  = Math.max(1, parseInt(String(page), 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10)));
  const skip     = (pageNum - 1) * limitNum;

  const [tickets, total] = await Promise.all([
    Ticket.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('-replies -internalNotes')
      .populate('assignedTo', 'name email isAiAgent')
      .lean(),
    Ticket.countDocuments(filter),
  ]);

  res.json({
    data: tickets,
    meta: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
  });
}

// GET /api/admin/tickets/:ticketId
export async function getAdminTicket(req: Request, res: Response): Promise<void> {
  const { ticketId } = req.params;
  if (!isValidObjectId(ticketId)) { res.status(400).json({ error: 'Invalid ticket ID' }); return; }

  const ticket = await Ticket.findById(ticketId)
    .populate('assignedTo', 'name email');
  if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }

  res.json({ data: await attachReadUrls(ticket.toObject()) });
}

// PATCH /api/admin/tickets/:ticketId/priority
export async function updatePriority(req: Request, res: Response): Promise<void> {
  const { ticketId } = req.params;
  const { priority } = req.body as { priority?: TicketPriority };

  if (!isValidObjectId(ticketId)) { res.status(400).json({ error: 'Invalid ticket ID' }); return; }

  const valid: TicketPriority[] = ['low', 'medium', 'high', 'irrelevant'];
  if (!priority || !valid.includes(priority)) {
    res.status(400).json({ error: `priority must be one of: ${valid.join(', ')}` });
    return;
  }

  const ticket = await Ticket.findByIdAndUpdate(
    ticketId,
    { aiPriority: priority },
    { new: true },
  ).populate('assignedTo', 'name email isAiAgent');

  if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }
  res.json({ data: ticket });
}

// PATCH /api/admin/tickets/:ticketId/status
export async function updateStatus(req: Request, res: Response): Promise<void> {
  const { ticketId } = req.params;
  const { status } = req.body as { status?: TicketStatus };

  if (!isValidObjectId(ticketId)) { res.status(400).json({ error: 'Invalid ticket ID' }); return; }

  const valid: TicketStatus[] = ['new', 'in_progress', 'resolved'];
  if (!status || !valid.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
    return;
  }

  const ticket = await Ticket.findByIdAndUpdate(
    ticketId,
    { status },
    { new: true },
  ).populate('assignedTo', 'name email');

  if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }
  res.json({ data: ticket });
}

// PATCH /api/admin/tickets/:ticketId/assign
export async function assignTicket(req: Request, res: Response): Promise<void> {
  const { ticketId } = req.params;
  const { agentId } = req.body as { agentId?: string | null };

  if (!isValidObjectId(ticketId)) { res.status(400).json({ error: 'Invalid ticket ID' }); return; }

  if (agentId !== null && agentId !== undefined && !isValidObjectId(agentId)) {
    res.status(400).json({ error: 'Invalid agent ID' });
    return;
  }

  let assignedAgent = null;
  if (agentId) {
    assignedAgent = await User.findById(agentId);
    if (!assignedAgent) { res.status(404).json({ error: 'Agent not found' }); return; }
  }

  const ticket = await Ticket.findByIdAndUpdate(
    ticketId,
    { assignedTo: agentId ?? null },
    { new: true },
  ).populate('assignedTo', 'name email isAiAgent');

  if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }
  res.json({ data: ticket });

  // Notify the newly assigned agent (skip AI agent)
  if (assignedAgent && !assignedAgent.isAiAgent) {
    void notifyAssigned(assignedAgent._id, ticket._id, ticket.title).catch((err: unknown) => {
      console.error('[assignTicket] notify failed:', err);
    });
  }

  // Fire AI pipeline when manually assigned to the AI agent — force=true means always reply
  if (assignedAgent?.isAiAgent) {
    void runAiAgentPipeline(String(ticket._id), true);
  }
}


// POST /api/admin/tickets/:ticketId/notes
export async function addNote(req: Request, res: Response): Promise<void> {
  const { ticketId } = req.params;
  const { body } = req.body as { body?: string };

  if (!isValidObjectId(ticketId)) { res.status(400).json({ error: 'Invalid ticket ID' }); return; }
  if (!body?.trim()) { res.status(400).json({ error: '"body" is required' }); return; }

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }

  const agent = getActingAgent(req);

  ticket.internalNotes.push({
    body:       body.trim(),
    authorId:   agent._id,
    authorName: agent.name,
  });
  if (ticket.status !== 'in_progress') ticket.status = 'in_progress';
  await ticket.save();

  const note = ticket.internalNotes[ticket.internalNotes.length - 1];
  res.status(201).json({ data: note });
}

// POST /api/admin/tickets/:ticketId/reply
export async function agentReply(req: Request, res: Response): Promise<void> {
  const { ticketId } = req.params;
  const { body } = req.body as { body?: string };

  if (!isValidObjectId(ticketId)) { res.status(400).json({ error: 'Invalid ticket ID' }); return; }
  if (!body?.trim()) { res.status(400).json({ error: '"body" is required' }); return; }

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }
  const agent = getActingAgent(req);

  ticket.replies.push({
    body:        body.trim(),
    authorName:  agent.name,
    authorEmail: agent.email,
    isAgent:     true,
  });
  if (ticket.status !== 'in_progress') ticket.status = 'in_progress';
  // Auto-assign to the replying agent if ticket is currently unassigned
  if (!ticket.assignedTo && isValidObjectId(String(agent._id))) {
    ticket.assignedTo = agent._id as unknown as typeof ticket.assignedTo;
  }
  await ticket.save();
  await ticket.populate('assignedTo', 'name email isAiAgent');

  const reply = ticket.replies[ticket.replies.length - 1];
  res.status(201).json({ data: { reply, assignedTo: ticket.assignedTo } });

  void sendAgentReplyEmail(ticket.authorEmail, ticket.authorName, String(ticket._id), ticket.title, body.trim())
    .catch((err: unknown) => console.error('[agentReply] reply email failed:', err));
}

// GET /api/admin/agents
export async function listAgents(req: Request, res: Response): Promise<void> {
  const agents = await User.find().select('-passwordHash').sort({ isAiAgent: -1, name: 1 }).lean();
  const withAvatars = await Promise.all(
    agents.map(async (a) => ({
      ...a,
      avatarUrl: a.avatarKey ? await getObjectUrl(a.avatarKey) : undefined,
    })),
  );
  res.json({ data: withAvatars });
}

// POST /api/admin/agents  (admin only)
export async function createAgent(req: Request, res: Response): Promise<void> {
  const { name, email, role } = req.body as {
    name?: string; email?: string; role?: AgentRole;
  };

  if (!name?.trim())  { res.status(400).json({ error: '"name" is required' }); return; }
  if (!email?.trim()) { res.status(400).json({ error: '"email" is required' }); return; }

  const validRoles: AgentRole[] = ['agent', 'admin'];
  const resolvedRole: AgentRole = role && validRoles.includes(role) ? role : 'agent';

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) { res.status(409).json({ error: 'Email already in use' }); return; }

  const { randomBytes } = await import('crypto');
  const tempPassword = randomBytes(8).toString('hex'); // 16-char hex one-time code
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const agent = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    role: resolvedRole,
    mustChangePassword: true,
  });

  const { passwordHash: _ph, ...safe } = agent.toObject() as unknown as { passwordHash: string; [key: string]: unknown };
  res.status(201).json({ data: safe });

  // Fire-and-forget — email failure must not break the creation response
  void sendAgentWelcomeEmail(agent.email, agent.name, tempPassword).catch((err: Error) => {
    console.error(`Welcome email failed for ${agent.email}:`, err.message);
  });
}

// GET /api/admin/agents/:agentId/activity
export async function getAgentActivity(req: Request, res: Response): Promise<void> {
  const { agentId } = req.params;
  if (!isValidObjectId(agentId)) { res.status(400).json({ error: 'Invalid agent ID' }); return; }

  const agent = await User.findById(agentId).select('-passwordHash').lean();
  if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }

  const [assignedTickets, repliesData, notesCount] = await Promise.all([
    Ticket.find({ assignedTo: agentId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('title status aiPriority createdAt')
      .lean(),

    Ticket.aggregate([
      { $match: { 'replies.authorEmail': agent.email, 'replies.isAgent': true } },
      { $unwind: '$replies' },
      { $match: { 'replies.authorEmail': agent.email, 'replies.isAgent': true } },
      { $sort: { 'replies.createdAt': -1 } },
      { $limit: 10 },
      { $project: {
        _id: 0,
        ticketId: '$_id',
        ticketTitle: '$title',
        body: '$replies.body',
        createdAt: '$replies.createdAt',
      }},
    ]),

    Ticket.countDocuments({ 'internalNotes.authorId': agentId }),
  ]);

  const stats = {
    assigned: await Ticket.countDocuments({ assignedTo: agentId }),
    resolved: await Ticket.countDocuments({ assignedTo: agentId, status: 'resolved' }),
    replies:  repliesData.length,
    notes:    notesCount,
  };

  res.json({ data: { agent, stats, assignedTickets, recentReplies: repliesData } });
}

// POST /api/admin/agents/:agentId/resend-invite  (admin only)
export async function resendAgentInvite(req: Request, res: Response): Promise<void> {
  const { agentId } = req.params;
  if (!isValidObjectId(agentId)) { res.status(400).json({ error: 'Invalid agent ID' }); return; }

  const agent = await User.findById(agentId);
  if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }
  if (agent.isAiAgent) { res.status(400).json({ error: 'Cannot send invite to AI Agent' }); return; }

  const { randomBytes } = await import('crypto');
  const tempPassword = randomBytes(8).toString('hex'); // 16-char hex
  agent.passwordHash = await bcrypt.hash(tempPassword, 12);
  agent.mustChangePassword = true;
  await agent.save();

  res.json({ data: { sent: true } });

  void sendAgentWelcomeEmail(agent.email, agent.name, tempPassword).catch((err: Error) => {
    console.error(`Resend invite failed for ${agent.email}:`, err.message);
  });
}

// DELETE /api/admin/agents/:agentId  (admin only)
export async function deleteAgent(req: Request, res: Response): Promise<void> {
  const { agentId } = req.params;
  if (!isValidObjectId(agentId)) { res.status(400).json({ error: 'Invalid agent ID' }); return; }

  const agent = await User.findById(agentId);
  if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }
  if (agent.isAiAgent) { res.status(400).json({ error: 'Cannot delete the AI Agent' }); return; }
  if (String(agent._id) === req.agent?._id) { res.status(400).json({ error: 'Cannot delete your own account' }); return; }

  await agent.deleteOne();
  res.json({ data: { deleted: true } });
}

// GET /api/admin/products
export async function listAdminProducts(_req: Request, res: Response): Promise<void> {
  const products = await Product.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();

  const data = await Promise.all(
    products.map(async (p) => ({
      _id:      String(p._id),
      name:     p.name,
      category: p.category,
      sku:      p.sku,
      description: p.description,
      imageUrl: p.imageKey ? await getObjectUrl(p.imageKey) : null,
    })),
  );

  res.json({ data });
}

// GET /api/admin/tags
export async function listTags(req: Request, res: Response): Promise<void> {
  const tags = await Ticket.distinct('aiTags', { aiTags: { $exists: true, $ne: [] } });
  res.json({ data: (tags as string[]).filter(Boolean).sort() });
}

// GET /api/admin/settings
export async function getSettings(req: Request, res: Response): Promise<void> {
  const settings = await getOrCreateSettings();
  res.json({ data: { autoReplyEnabled: settings.autoReplyEnabled, activeTheme: settings.activeTheme ?? null } });
}

// PATCH /api/admin/settings
export async function updateSettings(req: Request, res: Response): Promise<void> {
  const { autoReplyEnabled, activeTheme } = req.body as { autoReplyEnabled?: boolean; activeTheme?: string | null };

  const settings = await getOrCreateSettings();
  if (typeof autoReplyEnabled === 'boolean') settings.autoReplyEnabled = autoReplyEnabled;
  if (activeTheme !== undefined) settings.activeTheme = activeTheme ?? null;
  await settings.save();

  res.json({ data: { autoReplyEnabled: settings.autoReplyEnabled, activeTheme: settings.activeTheme ?? null } });
}

// GET /api/admin/notifications  — returns unread + recent 50 for the acting agent
export async function listNotifications(req: Request, res: Response): Promise<void> {
  const agentId = req.agent?._id;
  if (!agentId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const notifications = await Notification.find({ agentId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const unreadCount = notifications.filter((n) => !n.read).length;
  res.json({ data: { notifications, unreadCount } });
}

// PATCH /api/admin/notifications/:notificationId/read
export async function markNotificationRead(req: Request, res: Response): Promise<void> {
  const agentId = req.agent?._id;
  const { notificationId } = req.params;

  if (!agentId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!isValidObjectId(notificationId)) { res.status(400).json({ error: 'Invalid ID' }); return; }

  await Notification.findOneAndUpdate({ _id: notificationId, agentId }, { read: true });
  res.json({ data: { ok: true } });
}

// PATCH /api/admin/notifications/read-all
export async function markAllNotificationsRead(req: Request, res: Response): Promise<void> {
  const agentId = req.agent?._id;
  if (!agentId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  await Notification.updateMany({ agentId, read: false }, { read: true });
  res.json({ data: { ok: true } });
}

// PATCH /api/admin/profile/password
export async function changePassword(req: Request, res: Response): Promise<void> {
  const agentId = req.agent?._id;
  if (!agentId) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!newPassword || newPassword.length < 8) { res.status(400).json({ error: '"newPassword" must be at least 8 characters' }); return; }

  const user = await User.findById(agentId);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  // Skip current-password check when the admin forced a password reset
  if (!user.mustChangePassword) {
    if (!currentPassword) { res.status(400).json({ error: '"currentPassword" is required' }); return; }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) { res.status(400).json({ error: 'Current password is incorrect' }); return; }
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.mustChangePassword = false;
  await user.save();

  res.json({ data: { ok: true } });
}

// POST /api/admin/profile/avatar/presign
export async function presignAvatarUpload(req: Request, res: Response): Promise<void> {
  const agentId = req.agent?._id;
  if (!agentId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const { contentType } = req.body as { contentType?: string };
  if (!contentType) { res.status(400).json({ error: '"contentType" is required' }); return; }
  try {
    const data = await createAvatarUpload(String(agentId), contentType);
    res.json({ data });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed to presign' });
  }
}

// ── In-memory cache for AI insights (30 min TTL) ──────────────────────────────
interface InsightsCache {
  data: Awaited<ReturnType<typeof generateStoreInsights>>;
  generatedAt: string;
  expiresAt: number;
}
let insightsCache: InsightsCache | null = null;
const INSIGHTS_CACHE_TTL_MS = 30 * 60 * 1000;

// GET /api/admin/ai-insights
export async function getAiInsights(req: Request, res: Response): Promise<void> {
  const force = req.query.refresh === 'true';
  // Serve from cache if still fresh
  if (!force && insightsCache && insightsCache.expiresAt > Date.now()) {
    res.json({ data: insightsCache.data, generatedAt: insightsCache.generatedAt, cached: true });
    return;
  }

  // Pull all tickets with AI + marketing data (lean, no body text)
  const tickets = await Ticket.find()
    .select('status aiPriority aiSummary aiTags mktSentiment mktArchetype mktArchetypeLabel mktRefundIntent mktChurnRisk mktLifetimeValueSignal mktProfiledAt aiTriagedAt')
    .populate('product', 'name category')
    .lean();

  const total      = tickets.length;
  const resolved   = tickets.filter((t) => t.status === 'resolved').length;
  const open       = total - resolved;
  const unanalyzed = tickets.filter((t) => !t.aiTriagedAt).length;

  function countBy<T>(arr: T[], key: keyof T): Record<string, number> {
    return arr.reduce((acc, item) => {
      const v = String(item[key] ?? 'unknown');
      acc[v] = (acc[v] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  const analyzed = tickets.filter((t) => t.aiTriagedAt);

  const priorityBreakdown  = countBy(analyzed, 'aiPriority' as keyof typeof analyzed[0]);
  const sentimentBreakdown = countBy(tickets.filter((t) => t.mktSentiment), 'mktSentiment' as keyof typeof tickets[0]);
  const archetypeBreakdown = countBy(tickets.filter((t) => t.mktArchetypeLabel), 'mktArchetypeLabel' as keyof typeof tickets[0]);
  const refundBreakdown    = countBy(tickets.filter((t) => t.mktRefundIntent), 'mktRefundIntent' as keyof typeof tickets[0]);
  const churnBreakdown     = countBy(tickets.filter((t) => t.mktChurnRisk), 'mktChurnRisk' as keyof typeof tickets[0]);
  const ltvBreakdown       = countBy(tickets.filter((t) => t.mktLifetimeValueSignal), 'mktLifetimeValueSignal' as keyof typeof tickets[0]);

  // Top tags
  const tagCount: Record<string, number> = {};
  for (const t of analyzed) {
    for (const tag of (t.aiTags ?? [])) { tagCount[tag] = (tagCount[tag] ?? 0) + 1; }
  }
  const topTags = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([tag, count]) => ({ tag, count }));

  // Top products by ticket count
  const productCount: Record<string, number> = {};
  for (const t of tickets) {
    const prod = t.product as { name?: string } | null;
    if (prod?.name) { productCount[prod.name] = (productCount[prod.name] ?? 0) + 1; }
  }
  const topProducts = Object.entries(productCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // Recent summaries (last 20 analyzed)
  const recentSummaries = analyzed
    .filter((t) => t.aiSummary)
    .sort((a, b) => new Date(b.aiTriagedAt as Date).getTime() - new Date(a.aiTriagedAt as Date).getTime())
    .slice(0, 20)
    .map((t) => t.aiSummary as string);

  try {
    const insights = await generateStoreInsights({
      totalTickets: total,
      openTickets: open,
      resolvedTickets: resolved,
      priorityBreakdown,
      sentimentBreakdown,
      archetypeBreakdown,
      refundIntentBreakdown: refundBreakdown,
      churnRiskBreakdown:    churnBreakdown,
      ltvBreakdown,
      topTags,
      topProducts,
      recentSummaries,
      unanalyzedCount: unanalyzed,
    });
    const generatedAt = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    insightsCache = { data: insights, generatedAt, expiresAt: Date.now() + INSIGHTS_CACHE_TTL_MS };
    res.json({ data: insights, generatedAt, cached: false });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to generate insights' });
  }
}

// POST /api/admin/ai-insights/email
export async function emailAiInsights(req: Request, res: Response): Promise<void> {
  if (!insightsCache) { res.status(400).json({ error: 'No insights generated yet — open AI Insights first' }); return; }
  const agent = req.agent;
  if (!agent) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    await sendInsightsReportEmail(agent.email, agent.name, insightsCache.data, insightsCache.generatedAt);
    res.json({ data: { sent: true } });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to send email' });
  }
}

// PATCH /api/admin/profile
export async function updateProfile(req: Request, res: Response): Promise<void> {
  const agentId = req.agent?._id;
  if (!agentId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const { avatarKey } = req.body as { avatarKey?: string };
  const user = await User.findById(agentId);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  if (avatarKey !== undefined) user.avatarKey = avatarKey;
  await user.save();
  const avatarUrl = user.avatarKey ? await getObjectUrl(user.avatarKey) : undefined;
  res.json({ data: { avatarUrl } });
}
