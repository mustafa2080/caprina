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

export interface ParsedImport {
  headers: string[];
  sample: any[][];
  totalRows: number;
  allRows: any[][];
}

export interface ColumnMapping {
  name: string;
  phone: string;
  address: string;
  product: string;
  color: string;
  size: string;
  quantity: string;
  price: string;
  notes: string;
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
  parse: async (file: File): Promise<ParsedImport> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/orders/import/parse`, { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },
  execute: async (payload: { headers: string[]; rows: any[][]; mapping: ColumnMapping }): Promise<ImportResult> => {
    const res = await fetch(`${BASE}/orders/import/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },
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

export type MovementType = "IN" | "OUT";
export type MovementReason = "sale" | "partial_sale" | "return" | "manual_in" | "manual_out" | "adjustment";

export interface InventoryMovement {
  id: number;
  productId: number | null;
  variantId: number | null;
  product: string;
  color: string | null;
  size: string | null;
  quantity: number;
  type: MovementType;
  reason: MovementReason;
  orderId: number | null;
  notes: string | null;
  createdAt: string;
}

export interface MovementFilters {
  type?: MovementType;
  reason?: MovementReason;
  productId?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface MovementTotals {
  totalIn: number;
  totalOut: number;
  balance: number;
}

export const movementsApi = {
  list: (filters?: MovementFilters) => {
    const params = new URLSearchParams();
    if (filters?.type) params.set("type", filters.type);
    if (filters?.reason) params.set("reason", filters.reason);
    if (filters?.productId) params.set("productId", String(filters.productId));
    if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters?.dateTo) params.set("dateTo", filters.dateTo);
    const qs = params.toString();
    return apiFetch<InventoryMovement[]>(`/inventory/movements${qs ? `?${qs}` : ""}`);
  },
  totals: (filters?: MovementFilters) => {
    const params = new URLSearchParams();
    if (filters?.type) params.set("type", filters.type);
    if (filters?.reason) params.set("reason", filters.reason);
    if (filters?.productId) params.set("productId", String(filters.productId));
    if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters?.dateTo) params.set("dateTo", filters.dateTo);
    const qs = params.toString();
    return apiFetch<MovementTotals>(`/inventory/movements/totals${qs ? `?${qs}` : ""}`);
  },
  create: (data: {
    product: string;
    color?: string | null;
    size?: string | null;
    quantity: number;
    type: MovementType;
    reason: MovementReason;
    productId?: number | null;
    variantId?: number | null;
    notes?: string | null;
  }) => apiFetch<InventoryMovement>("/inventory/movements", { method: "POST", body: JSON.stringify(data) }),
};
