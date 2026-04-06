import { Schema, model, Document } from 'mongoose';
import type { IUser, AgentRole } from '../types/auth.types';

export interface UserDocument extends Omit<IUser, '_id'>, Document {}

export const AI_AGENT_EMAIL     = 'ai-agent@agilate.internal';
const AI_AGENT_EMAIL_OLD        = 'ai-agent@agilite.internal';
export const AI_AGENT_AVATAR_URL = 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=agilate-ai&backgroundColor=6366f1';

const userSchema = new Schema<UserDocument>(
  {
    name:         { type: String, required: true, trim: true },
    email:        { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, required: true },
    role:         {
      type: String,
      enum: ['agent', 'admin'] satisfies AgentRole[],
      default: 'agent',
    },
    isAiAgent:          { type: Boolean, default: false },
    mustChangePassword: { type: Boolean, default: false },
    avatarKey:          { type: String, default: null },
    lastActiveAt:       { type: Date,    default: null },
    aiRating:             { type: Number, min: 1, max: 5, default: null },
    aiRatingExplanation:  { type: String, default: null },
    aiRatingStrengths:    { type: [String], default: [] },
    aiRatingImprovements: { type: [String], default: [] },
    aiRatedAt:            { type: Date,    default: null },
    manualRating:         { type: Number, min: 1, max: 5, default: null },
  },
  { timestamps: true },
);

export const User = model<UserDocument>('User', userSchema);

/** Ensures the AI agent user exists in the DB. Called once on startup. */
export async function ensureAiAgent(): Promise<UserDocument> {
  // Migrate old email if still present
  await User.updateOne(
    { email: AI_AGENT_EMAIL_OLD },
    { $set: { email: AI_AGENT_EMAIL, avatarKey: AI_AGENT_AVATAR_URL } },
  );
  const existing = await User.findOne({ email: AI_AGENT_EMAIL });
  if (existing) {
    // Ensure avatar is set
    if (!existing.avatarKey) {
      existing.avatarKey = AI_AGENT_AVATAR_URL;
      await existing.save();
    }
    return existing;
  }
  return User.create({
    name:         'Agilate AI',
    email:        AI_AGENT_EMAIL,
    passwordHash: '__ai_agent_no_login__',
    role:         'agent',
    isAiAgent:    true,
    avatarKey:    AI_AGENT_AVATAR_URL,
  });
}
