export interface Product {
  _id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  sku: string;
  price?: number;
  imageUrl?: string;
  isActive?: boolean;
}
