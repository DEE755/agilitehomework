import { Router } from 'express';
import { login, getMe } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/requireAuth';

const router = Router();

router.post('/login', login);
router.get('/me', requireAuth, getMe);

export default router;
