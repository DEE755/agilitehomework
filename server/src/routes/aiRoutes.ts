import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth';
import {
  triageTicketHandler,
  suggestReplyHandler,
  testHandler,
  customerAskHandler,
  customerProfileHandler,
  remarketHandler,
  agentCoachHandler,
  productFinderHandler,
} from '../controllers/aiController';

const router = Router();

// Public — no auth required
router.post('/ask',    customerAskHandler);
router.post('/finder', productFinderHandler);

// All routes below require a logged-in agent
router.use(requireAuth);

router.post('/triage-ticket',    triageTicketHandler);
router.post('/suggest-reply',    suggestReplyHandler);
router.post('/customer-profile', customerProfileHandler);
router.post('/remarket',         remarketHandler);
router.post('/coach',            agentCoachHandler);
router.post('/test',             testHandler);

export default router;
