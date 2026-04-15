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
  create: (data: Partial<Product>) => apiFetch<Product>("/products", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Product>) => apiFetch<Product>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/products/${id}`, { method: "DELETE" }),
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
