import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/requireAuth';
import {
  getStats,
  listAdminTickets,
  getAdminTicket,
  updateStatus,
  updatePriority,
  assignTicket,
  addNote,
  agentReply,
  listAgents,
  createAgent,
  deleteAgent,
  listTags,
  getSettings,
  updateSettings,
} from '../controllers/admin.controller';

const router = Router();

// All admin routes require a valid JWT
router.use(requireAuth);

router.get('/stats',               getStats);
router.get('/tickets',             listAdminTickets);
router.get('/tickets/:ticketId',   getAdminTicket);
router.patch('/tickets/:ticketId/status',   updateStatus);
router.patch('/tickets/:ticketId/priority', updatePriority);
router.patch('/tickets/:ticketId/assign', assignTicket);
router.post('/tickets/:ticketId/notes',   addNote);
router.post('/tickets/:ticketId/reply',   agentReply);
router.get('/agents',              listAgents);
router.post('/agents',             requireRole('admin'), createAgent);
router.delete('/agents/:agentId',  requireRole('admin'), deleteAgent);
router.get('/tags',                listTags);
router.get('/settings',            getSettings);
router.patch('/settings',          updateSettings);

export default router;
