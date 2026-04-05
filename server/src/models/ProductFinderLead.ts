import { Schema, model, Document } from 'mongoose';

export interface IProductFinderLead {
  email?: string;
  profile: {
    useCase?: string;
    experienceLevel?: string;
    budget?: string;
    environment?: string;
    notes?: string;
  };
  recommendedSlugs: string[];
  messageCount: number;
  rawHistory: { role: 'user' | 'assistant'; content: string }[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductFinderLeadDocument extends IProductFinderLead, Document {}

const schema = new Schema<ProductFinderLeadDocument>(
  {
    email:            { type: String, default: null },
    profile: {
      useCase:        { type: String, default: null },
      experienceLevel:{ type: String, default: null },
      budget:         { type: String, default: null },
      environment:    { type: String, default: null },
      notes:          { type: String, default: null },
    },
    recommendedSlugs: [{ type: String }],
    messageCount:     { type: Number, default: 0 },
    rawHistory:       [{ role: String, content: String }],
  },
  { timestamps: true },
);

export const ProductFinderLead = model<ProductFinderLeadDocument>('ProductFinderLead', schema);
