export interface IProduct {
  slug: string;
  name: string;
  category: string;
  description: string;
  sku: string;
  price?: number;
  imageKey?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
