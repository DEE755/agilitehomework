import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { AgentMessage } from '../models/AgentMessage';
import { User, AI_AGENT_EMAIL } from '../models/User';
import { Ticket } from '../models/Ticket';
import { aiAgentChatReply } from '../services/aiService';

// ── GET /admin/messages/unread-count ─────────────────────────────────────────
export async function getUnreadCount(req: Request, res: Response) {
  const myId = new Types.ObjectId(req.agent!._id);
  const count = await AgentMessage.countDocuments({ toId: myId, readAt: null });
  return res.json({ data: { count } });
}

// ── GET /admin/messages/conversations ────────────────────────────────────────
// Returns one entry per unique conversation partner (latest message + unread count).
export async function listConversations(req: Request, res: Response) {
  const myId = new Types.ObjectId(req.agent!._id);

  const rows = await AgentMessage.aggregate([
    { $match: { $or: [{ fromId: myId }, { toId: myId }] } },
    { $sort:  { createdAt: -1 } },
    {
      $group: {
        _id: {
          $cond: [{ $eq: ['$fromId', myId] }, '$toId', '$fromId'],
        },
        lastMessage: { $first: '$$ROOT' },
        unreadCount: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$toId', myId] }, { $eq: ['$readAt', null] }] },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { 'lastMessage.createdAt': -1 } },
  ]);

  // Populate agent details for each partner
  const agentIds = rows.map((r) => r._id);
  const agents = await User.find({ _id: { $in: agentIds } })
    .select('name avatarKey')
    .lean();
  const agentMap = new Map(agents.map((a) => [String(a._id), a]));

  const conversations = rows.map((r) => {
    const agent = agentMap.get(String(r._id));
    const last  = r.lastMessage;
    return {
      agentId:     String(r._id),
      agentName:   agent?.name ?? 'Unknown',
      agentAvatar: agent?.avatarKey ?? null,
      lastBody:    last.body,
      lastAt:      last.createdAt,
      unreadCount: r.unreadCount,
      isFromMe:    String(last.fromId) === String(myId),
    };
  });

  return res.json({ data: conversations });
}

// ── GET /admin/messages/conversations/:agentId ───────────────────────────────
// Returns full thread + marks incoming messages as read.
export async function getConversation(req: Request, res: Response) {
  const myId      = new Types.ObjectId(req.agent!._id);
  const partnerId = new Types.ObjectId(req.params.agentId);

  const messages = await AgentMessage.find({
    $or: [
      { fromId: myId,      toId: partnerId },
      { fromId: partnerId, toId: myId      },
    ],
  })
    .sort({ createdAt: 1 })
    .lean();

  // Mark unread incoming messages as read (fire-and-forget)
  void AgentMessage.updateMany(
    { fromId: partnerId, toId: myId, readAt: null },
    { $set: { readAt: new Date() } },
  ).exec().catch(() => null);

  const partner = await User.findById(partnerId).select('name avatarKey').lean();

  return res.json({
    data: {
      agent: {
        _id:       String(partnerId),
        name:      partner?.name ?? 'Unknown',
        avatarUrl: partner?.avatarKey ?? null,
      },
      messages: messages.map((m) => ({
        _id:         String(m._id),
        fromId:      String(m.fromId),
        toId:        String(m.toId),
        body:        m.body,
        ticketRefs:  m.ticketRefs.map((r) => ({ ...r, ticketId: String(r.ticketId) })),
        productRefs: m.productRefs.map((r) => ({ ...r, productId: String(r.productId) })),
        readAt:      m.readAt ?? null,
        createdAt:   m.createdAt,
      })),
    },
  });
}

// ── POST /admin/messages ─────────────────────────────────────────────────────
export async function sendMessage(req: Request, res: Response) {
  const myId = new Types.ObjectId(req.agent!._id);
  const { toId, body, ticketRefs = [], productRefs = [] } = req.body as {
    toId:        string;
    body:        string;
    ticketRefs:  { ticketId: string; title: string; status: string }[];
    productRefs: { productId: string; name: string; imageUrl?: string | null }[];
  };

  if (!toId || !body?.trim()) {
    return res.status(400).json({ error: 'toId and body are required' });
  }
  if (toId === String(myId)) {
    return res.status(400).json({ error: 'Cannot message yourself' });
  }

  const recipient = await User.findById(toId).lean();
  if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

  const msg = await AgentMessage.create({
    fromId: myId,
    toId:   new Types.ObjectId(toId),
    body:   body.trim(),
    ticketRefs:  ticketRefs.map((r) => ({
      ticketId: new Types.ObjectId(r.ticketId),
      title:    r.title,
      status:   r.status,
    })),
    productRefs: productRefs.map((r) => ({
      productId: new Types.ObjectId(r.productId),
      name:      r.name,
      imageUrl:  r.imageUrl ?? null,
    })),
  });

  res.status(201).json({
    data: {
      _id:         String(msg._id),
      fromId:      String(msg.fromId),
      toId:        String(msg.toId),
      body:        msg.body,
      ticketRefs:  msg.ticketRefs.map((r) => ({ ...r, ticketId: String(r.ticketId) })),
      productRefs: msg.productRefs.map((r) => ({ ...r, productId: String(r.productId) })),
      readAt:      null,
      createdAt:   msg.createdAt,
    },
  });

  // Fire-and-forget: AI agent auto-reply
  if (recipient.isAiAgent) {
    void (async () => {
      try {
        type TicketLean = {
          _id: unknown; title: string; status: string; aiPriority?: string | null;
          authorName?: string; assignedTo?: unknown; aiAutoAssigned?: boolean; aiEscalated?: boolean;
        };

        const aiAgentUser = await User.findOne({ isAiAgent: true }).select('_id').lean();
        const aiId = aiAgentUser ? new Types.ObjectId(String(aiAgentUser._id)) : null;

        const [allTickets, myTickets, historyMsgs] = await Promise.all([
          Ticket.find({}).select('title status aiPriority authorName assignedTo aiAutoAssigned aiEscalated')
            .sort({ createdAt: -1 }).lean() as unknown as TicketLean[],
          aiId
            ? Ticket.find({ assignedTo: aiId }).select('title status aiPriority authorName aiAutoAssigned aiEscalated')
                .sort({ createdAt: -1 }).lean() as unknown as TicketLean[]
            : Promise.resolve([] as TicketLean[]),
          AgentMessage.find({
            $or: [
              { fromId: myId,                       toId: new Types.ObjectId(toId) },
              { fromId: new Types.ObjectId(toId),   toId: myId                     },
            ],
          }).sort({ createdAt: -1 }).limit(10).lean(),
        ]);

        const total        = allTickets.length;
        const resolved     = allTickets.filter((t) => t.status === 'resolved').length;
        const open         = total - resolved;
        const highPriority = allTickets.filter((t) => t.status !== 'resolved' && t.aiPriority === 'high').length;

        const ctx = {
          senderName:  req.agent!.name,
          ticketStats: { total, open, resolved, highPriority },
          myTickets: myTickets.map((t) => ({
            title:        t.title,
            status:       t.status,
            priority:     t.aiPriority ?? null,
            author:       t.authorName ?? 'Unknown',
            autoAssigned: t.aiAutoAssigned ?? false,
            escalated:    t.aiEscalated ?? false,
          })),
          recentTickets: allTickets.slice(0, 20).map((t) => ({
            title:    t.title,
            status:   t.status,
            priority: t.aiPriority ?? null,
            author:   t.authorName ?? 'Unknown',
          })),
          conversationHistory: historyMsgs.slice().reverse().map((m) => ({
            role: String(m.fromId) === String(myId) ? 'user' as const : 'assistant' as const,
            body: m.body,
          })),
          currentMessage: body.trim(),
        };

        const reply = await aiAgentChatReply(ctx);
        await AgentMessage.create({
          fromId:      new Types.ObjectId(toId),
          toId:        myId,
          body:        reply,
          ticketRefs:  [],
          productRefs: [],
        });
      } catch {
        // best-effort — ignore failures
      }
    })();
  }
}
