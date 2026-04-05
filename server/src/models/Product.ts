import { Schema, model, Document } from 'mongoose';
import type { IProduct } from '../types/product.types';

export interface ProductDocument extends IProduct, Document {}

const productSchema = new Schema<ProductDocument>(
  {
    slug:        { type: String, required: true, trim: true, unique: true },
    name:        { type: String, required: true, trim: true },
    category:    { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    sku:         { type: String, required: true, trim: true, uppercase: true, unique: true },
    price:       { type: Number, default: null },
    imageKey:    { type: String, default: null },
    sortOrder:   { type: Number, default: 0 },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Product = model<ProductDocument>('Product', productSchema);
