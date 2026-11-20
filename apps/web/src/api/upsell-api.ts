import { apiGet, apiPost } from './client';

export interface UpsellProduct {
  id: string;
  tenantId: string;
  propertyId: string;
  name: string;
  category: string;
  price: number;
  taxInclusive: boolean;
  status: string;
  createdAt?: string;
}

export interface UpsellSaleReport {
  from: string;
  to: string;
  totalSales: number;
  totalRevenue: number;
  byProduct: Array<{ productId: string; name: string; quantity: number; revenue: number }>;
}

export async function listUpsellProducts(): Promise<UpsellProduct[]> {
  const response = await apiGet<{ data: UpsellProduct[] }>('/v1/upsell/products');
  return response.data;
}

export async function createUpsellProduct(input: {
  name: string;
  category: string;
  price: number;
  taxInclusive: boolean;
}): Promise<UpsellProduct> {
  const response = await apiPost<{ data: UpsellProduct }>('/v1/upsell/products', input);
  return response.data;
}

export async function sellUpsell(input: {
  productId: string;
  reservationId: string;
  quantity: number;
}): Promise<{ id: string }> {
  const response = await apiPost<{ data: { id: string } }>('/v1/upsell/sell', input);
  return response.data;
}

export async function getUpsellSalesReport(params: {
  from: string;
  to: string;
}): Promise<UpsellSaleReport> {
  const response = await apiGet<{ data: UpsellSaleReport }>('/v1/upsell/sales', params);
  return response.data;
}
