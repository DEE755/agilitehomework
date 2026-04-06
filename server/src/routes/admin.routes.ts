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
  presignAvatarUpload,
  updateProfile,
  getAiInsights,
  emailAiInsights,
  listInsightsHistory,
  getInsightsSnapshot,
  compareInsights,
  aiRateAgent,
  updateAgentRating,
  presignAiAvatarUpload,
  updateAiAgentAvatar,
} from '../controllers/admin.controller';
import {
  getUnreadCount,
  listConversations,
  getConversation,
  sendMessage,
} from '../controllers/messages.controller';

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
router.get('/settings',            requireRole('admin'), getSettings);
router.get('/ai-insights',                    getAiInsights);
router.post('/ai-insights/email',             emailAiInsights);
router.get('/ai-insights/history',            listInsightsHistory);
router.get('/ai-insights/history/:snapshotId', getInsightsSnapshot);
router.post('/ai-insights/compare',           compareInsights);
router.post('/agents/:agentId/ai-rate',       requireRole('admin'), aiRateAgent);
router.patch('/agents/:agentId/rating',       requireRole('admin'), updateAgentRating);
router.patch('/settings',                               requireRole('admin'), updateSettings);
router.post('/settings/ai-avatar/presign',              requireRole('admin'), presignAiAvatarUpload);
router.patch('/settings/ai-avatar',                     requireRole('admin'), updateAiAgentAvatar);
router.patch('/profile/password',                     changePassword);
router.patch('/profile',                              updateProfile);
router.post('/profile/avatar/presign',                presignAvatarUpload);
router.get('/notifications',                          listNotifications);
router.patch('/notifications/read-all',               markAllNotificationsRead);
router.patch('/notifications/:notificationId/read',   markNotificationRead);

router.get('/messages/unread-count',                  getUnreadCount);
router.get('/messages/conversations',                 listConversations);
router.get('/messages/conversations/:agentId',        getConversation);
router.post('/messages',                              sendMessage);

export default router;
