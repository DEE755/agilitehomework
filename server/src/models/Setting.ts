import { Schema, model, Document } from 'mongoose';

export interface SettingDocument extends Document {
  autoReplyEnabled: boolean;
  activeTheme: string | null;
}

const settingSchema = new Schema<SettingDocument>(
  {
    autoReplyEnabled: { type: Boolean, default: false },
    activeTheme:      { type: String,  default: null },
  },
  { timestamps: true },
);

export const Setting = model<SettingDocument>('Setting', settingSchema);

/** Returns the single settings document, creating it with defaults if missing. */
export async function getOrCreateSettings(): Promise<SettingDocument> {
  const existing = await Setting.findOne();
  if (existing) return existing;
  return Setting.create({});
}
