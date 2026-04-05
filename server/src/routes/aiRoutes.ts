import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import { triageTicketHandler, suggestReplyHandler, testHandler, customerAskHandler } from '../controllers/aiController';

const router = Router();

// Public — no auth required
router.post('/ask', customerAskHandler);

// All routes below require a logged-in agent
router.use(requireAuth);

router.post('/triage-ticket', triageTicketHandler);
router.post('/suggest-reply', suggestReplyHandler);
router.post('/test',          testHandler);

export default router;
