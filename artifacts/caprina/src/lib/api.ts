const BASE = "/api";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (res.status === 204) return undefined as unknown as T;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

export interface Product {
  id: number;
  name: string;
  sku: string | null;
  totalQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  lowStockThreshold: number;
  unitPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: number;
  productId: number;
  productName?: string;
  color: string;
  size: string;
  sku: string | null;
  totalQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  lowStockThreshold: number;
  unitPrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShippingCompany {
  id: number;
  name: string;
  phone: string | null;
  website: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ImportResult {
  imported: number;
  failed: number;
  errors: string[];
  orders: any[];
}

export const productsApi = {
  list: () => apiFetch<Product[]>("/products"),
  create: (data: Partial<Product> & { name: string }) => apiFetch<Product>("/products", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Product>) => apiFetch<Product>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/products/${id}`, { method: "DELETE" }),
};

export const variantsApi = {
  listAll: () => apiFetch<ProductVariant[]>("/variants"),
  listByProduct: (productId: number) => apiFetch<ProductVariant[]>(`/products/${productId}/variants`),
  create: (productId: number, data: { color: string; size: string; sku?: string; totalQuantity: number; lowStockThreshold: number; unitPrice: number }) =>
    apiFetch<ProductVariant>(`/products/${productId}/variants`, { method: "POST", body: JSON.stringify(data) }),
  update: (productId: number, variantId: number, data: Partial<ProductVariant>) =>
    apiFetch<ProductVariant>(`/products/${productId}/variants/${variantId}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (productId: number, variantId: number) =>
    apiFetch<void>(`/products/${productId}/variants/${variantId}`, { method: "DELETE" }),
};

export const shippingApi = {
  list: () => apiFetch<ShippingCompany[]>("/shipping-companies"),
  create: (data: Partial<ShippingCompany>) => apiFetch<ShippingCompany>("/shipping-companies", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<ShippingCompany>) => apiFetch<ShippingCompany>(`/shipping-companies/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/shipping-companies/${id}`, { method: "DELETE" }),
};

export const importApi = {
  uploadExcel: async (file: File): Promise<ImportResult> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/orders/import`, { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },
};

export interface OrderStats {
  today: { orders: number; revenue: number };
  week: { orders: number; revenue: number };
  month: { orders: number; revenue: number };
  bestProduct: { name: string; quantity: number } | null;
}

export const ordersApi = {
  stats: () => apiFetch<OrderStats>("/orders/stats"),
  delete: (id: number) => apiFetch<void>(`/orders/${id}`, { method: "DELETE" }),
};
