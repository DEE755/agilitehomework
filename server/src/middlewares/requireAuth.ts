import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload, AuthAgent, AgentRole } from '../types/auth.types';
import { User } from '../models/User';

// Augment Express Request globally
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      agent?: AuthAgent;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = auth.slice(7);
  try {
    const secret = process.env.JWT_SECRET ?? 'dev-secret';
    const payload = jwt.verify(token, secret) as JwtPayload;
    const user = await User.findById(payload.userId).lean();
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.agent = {
      _id:   String(user._id),
      name:  user.name,
      email: user.email,
      role:  user.role,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: AgentRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.agent || !roles.includes(req.agent.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
