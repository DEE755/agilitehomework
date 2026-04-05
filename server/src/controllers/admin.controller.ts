import type { Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import bcrypt from 'bcryptjs';
import { Ticket } from '../models/Ticket';
import { User, AI_AGENT_EMAIL } from '../models/User';
import { getOrCreateSettings } from '../models/Setting';
import { runAiAgentPipeline } from '../services/aiAgentService';
import type { TicketStatus, TicketPriority } from '../types/ticket.types';
import type { AgentRole } from '../types/auth.types';
import { attachReadUrls } from '../services/storage';
import { sendAgentWelcomeEmail } from '../services/emailService';

function getActingAgent(req: Request) {
  return req.agent ?? {
    _id: 'support-team',
    name: 'Support Team',
    email: 'support@agilite.com',
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
      .populate('assignedTo', 'name email isAiAgent'),
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

  const ticket = await Ticket.findById(ticketId).populate('assignedTo', 'name email');
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
  await ticket.save();

  const reply = ticket.replies[ticket.replies.length - 1];
  res.status(201).json({ data: reply });
}

// GET /api/admin/agents
export async function listAgents(req: Request, res: Response): Promise<void> {
  const agents = await User.find().select('-passwordHash').sort({ isAiAgent: -1, name: 1 }).lean();
  res.json({ data: agents });
}

// POST /api/admin/agents  (admin only)
export async function createAgent(req: Request, res: Response): Promise<void> {
  const { name, email, password, role } = req.body as {
    name?: string; email?: string; password?: string; role?: AgentRole;
  };

  if (!name?.trim())     { res.status(400).json({ error: '"name" is required' }); return; }
  if (!email?.trim())    { res.status(400).json({ error: '"email" is required' }); return; }
  if (!password)         { res.status(400).json({ error: '"password" is required' }); return; }
  if (password.length < 8) { res.status(400).json({ error: 'Password must be at least 8 characters' }); return; }

  const validRoles: AgentRole[] = ['agent', 'admin'];
  const resolvedRole: AgentRole = role && validRoles.includes(role) ? role : 'agent';

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) { res.status(409).json({ error: 'Email already in use' }); return; }

  const passwordHash = await bcrypt.hash(password, 12);
  const agent = await User.create({ name: name.trim(), email: email.toLowerCase().trim(), passwordHash, role: resolvedRole });

  const { passwordHash: _ph, ...safe } = agent.toObject() as typeof agent.toObject & { passwordHash: string };
  res.status(201).json({ data: safe });

  // Fire-and-forget — email failure must not break the creation response
  void sendAgentWelcomeEmail(agent.email, agent.name, password).catch((err: Error) => {
    console.error(`Welcome email failed for ${agent.email}:`, err.message);
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

// GET /api/admin/tags
export async function listTags(req: Request, res: Response): Promise<void> {
  const tags = await Ticket.distinct('aiTags', { aiTags: { $exists: true, $ne: [] } });
  res.json({ data: (tags as string[]).filter(Boolean).sort() });
}

// GET /api/admin/settings
export async function getSettings(req: Request, res: Response): Promise<void> {
  const settings = await getOrCreateSettings();
  res.json({ data: { autoReplyEnabled: settings.autoReplyEnabled } });
}

// PATCH /api/admin/settings
export async function updateSettings(req: Request, res: Response): Promise<void> {
  const { autoReplyEnabled } = req.body as { autoReplyEnabled?: boolean };

  const settings = await getOrCreateSettings();
  if (typeof autoReplyEnabled === 'boolean') {
    settings.autoReplyEnabled = autoReplyEnabled;
  }
  await settings.save();

  res.json({ data: { autoReplyEnabled: settings.autoReplyEnabled } });
}
