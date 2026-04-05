import { Router } from 'express';
import {
  listTickets,
  getTicket,
  createTicket,
  addReply,
  closeTicket,
} from '../controllers/ticket.controller';
import { validate } from '../middlewares/validate';

const router = Router();

const createTicketSchema = {
  title: { type: 'string' as const, required: true, maxLength: 200 },
  description: { type: 'string' as const, required: true },
  authorName: { type: 'string' as const, required: true },
  authorEmail: { type: 'email' as const, required: true },
  productId: { type: 'string' as const, required: false },
  priority: { type: 'enum' as const, values: ['low', 'medium', 'high'], required: false },
};

const createReplySchema = {
  body: { type: 'string' as const, required: true },
  authorName: { type: 'string' as const, required: true },
  authorEmail: { type: 'email' as const, required: true },
};

router.get('/', listTickets);
router.get('/:ticketId', getTicket);
router.post('/', validate(createTicketSchema), createTicket);
router.post('/:ticketId/replies', validate(createReplySchema), addReply);
router.patch('/:ticketId/close', closeTicket);

export default router;
