import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

// POST /api/auth/login
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email?: unknown; password?: unknown };

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const secret = process.env.JWT_SECRET ?? 'dev-secret';
  const token = jwt.sign(
    { userId: String(user._id), role: user.role },
    secret,
    { expiresIn: '7d' },
  );

  res.json({
    token,
    agent: { _id: String(user._id), name: user.name, email: user.email, role: user.role },
  });
}

// GET /api/auth/me
export async function getMe(req: Request, res: Response): Promise<void> {
  res.json({ data: req.agent });
}
