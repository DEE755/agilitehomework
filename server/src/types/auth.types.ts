export type AgentRole = 'agent' | 'admin';

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: AgentRole;
  isAiAgent?: boolean;
  mustChangePassword?: boolean;
  avatarKey?: string;
  lastActiveAt?: Date;
  // AI performance rating
  aiRating?:             number;   // 1–5
  aiRatingExplanation?:  string;
  aiRatingStrengths?:    string[];
  aiRatingImprovements?: string[];
  aiRatedAt?:            Date;
  manualRating?:         number;   // 1–5, set by admin
}

export interface JwtPayload {
  userId: string;
  role: AgentRole;
}

export interface AuthAgent {
  _id: string;
  name: string;
  email: string;
  role: AgentRole;
}
