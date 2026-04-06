import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { AgentMessage } from '../models/AgentMessage';
import { User } from '../models/User';

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
    .select('name avatarUrl')
    .lean();
  const agentMap = new Map(agents.map((a) => [String(a._id), a]));

  const conversations = rows.map((r) => {
    const agent = agentMap.get(String(r._id));
    const last  = r.lastMessage;
    return {
      agentId:     String(r._id),
      agentName:   agent?.name ?? 'Unknown',
      agentAvatar: agent?.avatarUrl ?? null,
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

  const partner = await User.findById(partnerId).select('name avatarUrl').lean();

  return res.json({
    data: {
      agent: {
        _id:       String(partnerId),
        name:      partner?.name ?? 'Unknown',
        avatarUrl: partner?.avatarUrl ?? null,
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

  return res.status(201).json({
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
}
