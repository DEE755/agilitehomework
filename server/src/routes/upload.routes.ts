import { Router } from 'express';
import { presignTicketImageUpload } from '../controllers/upload.controller';

const router = Router();

router.post('/ticket-images/presign', presignTicketImageUpload);

export default router;
