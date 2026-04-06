import { Schema, model, Document } from 'mongoose';

export interface InsightsSnapshotDocument extends Document {
  data:      Record<string, unknown>;   // StoreInsightsResult JSON
  metrics: {
    totalTickets:    number;
    openTickets:     number;
    resolvedTickets: number;
    humanAgentCount: number;
  };
  healthScore: number;   // denormalised for fast chart queries
  generatedAt: Date;
}

const insightsSnapshotSchema = new Schema<InsightsSnapshotDocument>({
  data: { type: Schema.Types.Mixed, required: true },
  metrics: {
    totalTickets:    { type: Number, default: 0 },
    openTickets:     { type: Number, default: 0 },
    resolvedTickets: { type: Number, default: 0 },
    humanAgentCount: { type: Number, default: 0 },
  },
  healthScore: { type: Number, required: true },
  generatedAt: { type: Date,   required: true, default: Date.now },
});

// Keep at most 100 snapshots (oldest deleted automatically via TTL or cleanup)
insightsSnapshotSchema.index({ generatedAt: -1 });

export const InsightsSnapshot = model<InsightsSnapshotDocument>(
  'InsightsSnapshot',
  insightsSnapshotSchema,
);
