// Must be first — loads .env before any other module reads process.env
import './env';

import * as logfire from '@pydantic/logfire-node';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db';
import { ensureAiAgent } from './models/User';
import productRoutes from './routes/product.routes';
import ticketRoutes from './routes/ticket.routes';
import uploadRoutes from './routes/upload.routes';
import authRoutes   from './routes/auth.routes';
import adminRoutes  from './routes/admin.routes';
import aiRoutes     from './routes/aiRoutes';
import { errorHandler } from './middlewares/errorHandler';

logfire.configure({
  token: process.env.LOGFIRE_TOKEN,
  serviceName: 'agilate',
});

const app = express();
const PORT = process.env.PORT || 5050;

let dbReady = false;

app.use(cors({
  origin: process.env.CLIENT_URL ?? '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(express.json());

// Logfire HTTP request tracing
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warning' : 'info';
    logfire[level](`${req.method} ${req.path} → ${res.statusCode}`, {
      method:      req.method,
      path:        req.path,
      status:      res.statusCode,
      duration_ms: duration,
    });
  });
  next();
});

app.get('/', (_req, res) => {
  res.json({ status: 'API IS ACTIVE', version: '1.0.0' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', db: dbReady ? 'connected' : 'connecting' });
});

// Guard: return 503 until MongoDB is ready
app.use((_req, res, next) => {
  if (!dbReady) {
    res.status(503).json({ error: 'Service starting — database not ready yet' });
    return;
  }
  next();
});

app.use('/api/auth',     authRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/ai',       aiRoutes);
app.use('/api/products', productRoutes);
app.use('/api/uploads',  uploadRoutes);
app.use('/api/tickets',  ticketRoutes);

app.use(errorHandler);

// Start the HTTP server immediately; connect DB in background
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

connectDB()
  .then(async () => {
    dbReady = true;
    await ensureAiAgent();
    console.log('MongoDB connected — ready to accept requests');
  })
  .catch((err: Error) => {
    console.error('MongoDB connection failed:', err.message);
    console.error('Fix MONGODB_URI in server/.env and restart.');
    process.exit(1);
  });
