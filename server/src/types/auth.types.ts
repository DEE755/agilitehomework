export type AgentRole = 'agent' | 'admin';

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: AgentRole;
  isAiAgent?: boolean;
  mustChangePassword?: boolean;
  avatarKey?: string;
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
