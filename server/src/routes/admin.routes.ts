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
  resendAgentInvite,
  listTags,
  getSettings,
  updateSettings,
  getAgentActivity,
  listAdminProducts,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  changePassword,
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
router.delete('/agents/:agentId',              requireRole('admin'), deleteAgent);
router.post('/agents/:agentId/resend-invite',  requireRole('admin'), resendAgentInvite);
router.get('/agents/:agentId/activity', getAgentActivity);
router.get('/tags',                listTags);
router.get('/products',            listAdminProducts);
router.get('/settings',            getSettings);
router.patch('/settings',          updateSettings);
router.patch('/profile/password',                     changePassword);
router.get('/notifications',                          listNotifications);
router.patch('/notifications/read-all',               markAllNotificationsRead);
router.patch('/notifications/:notificationId/read',   markNotificationRead);

export default router;
