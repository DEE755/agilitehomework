import express, { Router } from 'express';
import { presignTicketImageUpload, proxyTicketImageUpload } from '../controllers/upload.controller';

const router = Router();

router.post('/ticket-images', express.raw({ type: '*/*', limit: '11mb' }), proxyTicketImageUpload);
router.post('/ticket-images/presign', presignTicketImageUpload);

export default router;
