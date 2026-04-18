const BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("caprina_token");
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeader, ...options?.headers },
    ...options,
  });
  if (res.status === 204) return undefined as unknown as T;
  if (res.status === 401) {
    localStorage.removeItem("caprina_token");
    localStorage.removeItem("caprina_user");
    window.location.href = "/login";
    throw new Error("غير مصرح");
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

// ─── Auth API ──────────────────────────────────────────────────────────────
export interface LoginResponse {
  token: string;
  user: {
    id: number; username: string; displayName: string;
    role: "admin" | "employee" | "warehouse";
    permissions: string[]; isActive: boolean;
    createdAt: string; updatedAt: string;
  };
}

export const authApi = {
  login: (username: string, password: string) =>
    apiFetch<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  me: () => apiFetch<LoginResponse["user"]>("/auth/me"),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch<{ success: boolean }>("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),
};

// ─── Users API ─────────────────────────────────────────────────────────────
export interface AppUser {
  id: number; username: string; displayName: string;
  role: "admin" | "employee" | "warehouse";
  permissions: string[]; isActive: boolean;
  createdAt: string; updatedAt: string;
}

export const usersApi = {
  list: () => apiFetch<AppUser[]>("/users"),
  create: (data: { username: string; password: string; displayName: string; role: string; permissions?: string[] }) =>
    apiFetch<AppUser>("/users", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<{ displayName: string; role: string; permissions: string[]; isActive: boolean; password: string }>) =>
    apiFetch<AppUser>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/users/${id}`, { method: "DELETE" }),
};

// ─── Audit Logs API ────────────────────────────────────────────────────────
export interface AuditLogEntry {
  id: number; action: string; entityType: string;
  entityId: number | null; entityName: string | null;
  changesBefore: Record<string, unknown> | null;
  changesAfter: Record<string, unknown> | null;
  userId: number | null; userName: string | null;
  createdAt: string;
}

export const auditApi = {
  list: (params?: { entityType?: string; action?: string; search?: string; limit?: number; from?: string; to?: string }) => {
    const q = new URLSearchParams();
    if (params?.entityType) q.set("entityType", params.entityType);
    if (params?.action) q.set("action", params.action);
    if (params?.search) q.set("search", params.search);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.from) q.set("from", params.from);
    if (params?.to) q.set("to", params.to);
    return apiFetch<AuditLogEntry[]>(`/audit-logs?${q.toString()}`);
  },
};

export interface Product {
  id: number;
  name: string;
  sku: string | null;
  totalQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  lowStockThreshold: number;
  unitPrice: number;
  costPrice: number | null;
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
  costPrice: number | null;
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
  update: (id: number, data: Partial<Omit<Product, "totalQuantity">>) => apiFetch<Product>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/products/${id}`, { method: "DELETE" }),
  addStock: (id: number, quantity: number, notes?: string | null) =>
    apiFetch<Product>(`/products/${id}/add-stock`, { method: "POST", body: JSON.stringify({ quantity, notes }) }),
};

export const variantsApi = {
  listAll: () => apiFetch<ProductVariant[]>("/variants"),
  listByProduct: (productId: number) => apiFetch<ProductVariant[]>(`/products/${productId}/variants`),
  create: (productId: number, data: { color: string; size: string; sku?: string; totalQuantity?: number; lowStockThreshold: number; unitPrice: number; costPrice?: number | null }) =>
    apiFetch<ProductVariant>(`/products/${productId}/variants`, { method: "POST", body: JSON.stringify(data) }),
  update: (productId: number, variantId: number, data: Partial<Omit<ProductVariant, "totalQuantity">>) =>
    apiFetch<ProductVariant>(`/products/${productId}/variants/${variantId}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (productId: number, variantId: number) =>
    apiFetch<void>(`/products/${productId}/variants/${variantId}`, { method: "DELETE" }),
  addStock: (productId: number, variantId: number, quantity: number, notes?: string | null) =>
    apiFetch<ProductVariant>(`/products/${productId}/variants/${variantId}/add-stock`, { method: "POST", body: JSON.stringify({ quantity, notes }) }),
};

export const shippingApi = {
  list: () => apiFetch<ShippingCompany[]>("/shipping-companies"),
  create: (data: Partial<ShippingCompany>) => apiFetch<ShippingCompany>("/shipping-companies", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<ShippingCompany>) => apiFetch<ShippingCompany>(`/shipping-companies/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/shipping-companies/${id}`, { method: "DELETE" }),
};

const parseFile = async (file: File, endpoint: string): Promise<ParsedImport> => {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/${endpoint}`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

const executeImport = async (endpoint: string, payload: { headers: string[]; rows: any[][]; mapping: any }): Promise<ImportResult> => {
  const res = await fetch(`${BASE}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

export const importApi = {
  // Orders
  parse: (file: File) => parseFile(file, "orders/import/parse"),
  execute: (payload: { headers: string[]; rows: any[][]; mapping: ColumnMapping }) => executeImport("orders/import/execute", payload),
  uploadExcel: async (file: File): Promise<ImportResult> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/orders/import`, { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },
  // Products
  parseProducts: (file: File) => parseFile(file, "products/import/parse"),
  executeProducts: (payload: { headers: string[]; rows: any[][]; mapping: any }) => executeImport("products/import/execute", payload),
  // Returns
  parseReturns: (file: File) => parseFile(file, "returns/import/parse"),
  executeReturns: (payload: { headers: string[]; rows: any[][]; mapping: any }) => executeImport("returns/import/execute", payload),
};

export interface OrderStats {
  today: { orders: number; revenue: number };
  week: { orders: number; revenue: number };
  month: { orders: number; revenue: number };
  bestProduct: { name: string; quantity: number } | null;
}

export interface PeriodProfit {
  orders: number;
  revenue: number;
  cost: number;
  shippingCost: number;
  netProfit: number;
  returnRate: number;
  returnCount: number;
}

export interface ProductProfit {
  name: string;
  revenue: number;
  cost: number;
  profit: number;
  quantity: number;
  orderCount: number;
  returnCount: number;
  returnRate: number;
  margin: number;
}

export interface ProfitAnalytics {
  today: PeriodProfit;
  week: PeriodProfit;
  month: PeriodProfit;
  allTime: PeriodProfit;
  topProducts: ProductProfit[];
  losingProducts: ProductProfit[];
  inventoryValue: {
    byProduct: number;
    byVariant: number;
    total: number;
    totalUnits: number;
    lowStock: any[];
  };
}

export interface FinancialSummary {
  cashIn: number;
  costOfGoods: number;
  shippingSpend: number;
  grossProfit: number;
  grossMargin: number;
  netProfit: number;
  netMargin: number;
  returnLoss: number;
  returnRevLost: number;
  pendingRevenue: number;
  returnCount: number;
  returnRate: number;
  totalOrders: number;
  completedOrders: number;
  avgProfitPerOrder: number;
  avgOrderValue: number;
  avgCostPerOrder: number;
  inventoryAtCost: number;
  inventoryAtSell: number;
  potentialInventoryProfit: number;
}

export interface ProductPerformance {
  name: string;
  productId: number | null;
  totalOrders: number;
  completedOrders: number;
  totalSalesQty: number;
  totalRevenue: number;
  totalCost: number;
  totalShipping: number;
  returnCount: number;
  returnCostLoss: number;
  netProfit: number;
  avgSalePrice: number;
  margin: number;
  returnRate: number;
  roi: number;
}

export interface ProductPerformanceResponse {
  products: ProductPerformance[];
  byProfit: ProductPerformance[];
  byLoss: ProductPerformance[];
  byReturns: ProductPerformance[];
  summary: {
    totalProducts: number;
    profitableCount: number;
    losingCount: number;
    highReturnCount: number;
    totalNetProfit: number;
    totalRevenue: number;
  };
}

export type AlertType = "HIGH_RETURN" | "LOSING_PRODUCT" | "LOW_STOCK" | "LOW_MARGIN" | "STALE_STOCK" | "NO_COST_DATA";
export type AlertSeverity = "high" | "medium" | "low";

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  detail: string;
  productName?: string;
  value?: number;
}

export interface AlertsResponse {
  alerts: Alert[];
  counts: { total: number; high: number; medium: number; low: number };
}

export type StockCategory = "out" | "fast" | "medium" | "slow" | "stale";

export interface StockIntelligenceItem {
  name: string;
  productId: number | null;
  availableQty: number;
  reservedQty: number;
  soldQty: number;
  costPrice: number;
  unitPrice: number;
  last30DaysSales: number;
  velocityPerDay: number;
  daysUntilStockout: number | null;
  category: StockCategory;
  frozenCapital: number;
  potentialRevenue: number;
}

export interface StockIntelligenceResponse {
  items: StockIntelligenceItem[];
  summary: {
    totalProducts: number;
    fastMovers: number;
    slowMovers: number;
    outOfStock: number;
    totalFrozenCapital: number;
  };
}

// ─── Smart Insights Types ────────────────────────────────────────────────────
export interface AdSourceStat {
  source: string;
  orders: number;
  revenue: number;
  profit: number;
  returnRate: number;
  roi: number;
}

export interface SmartProduct {
  name: string;
  revenue: number;
  cost: number;
  profit: number;
  quantity: number;
  orderCount: number;
  returnCount: number;
  returnRate: number;
  margin: number;
}

export interface DeadStockItem {
  name: string;
  availableQty: number;
  frozenCapital: number;
  last30DaysSales: number;
  daysSinceLastSale: number | null;
}

export interface ReturnReasonItem {
  reason: string;
  label: string;
  count: number;
  pct: number;
}

export interface HighReturnProduct {
  name: string;
  returnRate: number;
  returnCount: number;
  orderCount: number;
}

export interface StockPredictorItem {
  name: string;
  availableQty: number;
  velocityPerDay: number;
  daysUntilStockout: number | null;
  frozenCapital: number;
}

export interface SmartInsights {
  adAttribution: {
    bestSource: AdSourceStat | null;
    breakdown: AdSourceStat[];
  };
  stars: SmartProduct[];
  deadStock: DeadStockItem[];
  returnInsights: {
    byReason: ReturnReasonItem[];
    highReturnProducts: HighReturnProduct[];
    totalReturnRate: number;
    totalReturns: number;
  };
  stockPredictor: StockPredictorItem[];
}

export const analyticsApi = {
  profit: () => apiFetch<ProfitAnalytics>("/analytics/profit"),
  financialSummary: () => apiFetch<FinancialSummary>("/analytics/financial-summary"),
  productPerformance: () => apiFetch<ProductPerformanceResponse>("/analytics/product-performance"),
  alerts: () => apiFetch<AlertsResponse>("/analytics/alerts"),
  stockIntelligence: () => apiFetch<StockIntelligenceResponse>("/analytics/stock-intelligence"),
  smartInsights: () => apiFetch<SmartInsights>("/analytics/smart-insights"),
};

export const ordersApi = {
  stats: () => apiFetch<OrderStats>("/orders/stats"),
  delete: (id: number) => apiFetch<void>(`/orders/${id}`, { method: "DELETE" }),
};

export type MovementType = "IN" | "OUT";
export type MovementReason = "sale" | "partial_sale" | "return" | "damaged" | "manual_in" | "manual_out" | "adjustment";

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

// ─── Shipping Manifests API ─────────────────────────────────────────────────
export type DeliveryStatus = "pending" | "delivered" | "postponed" | "partial_received" | "returned";

export interface ShippingManifestListItem {
  id: number;
  manifestNumber: string;
  shippingCompanyId: number;
  companyName: string;
  status: "open" | "closed";
  notes: string | null;
  invoicePrice: number | null;
  invoiceNotes: string | null;
  orderCount: number;
  createdAt: string;
  closedAt: string | null;
}

export interface ManifestStats {
  total: number;
  delivered: number;
  returned: number;
  pending: number;
  deliveryRate: number;
  totalRevenue: number;
  totalCost: number;
  totalShippingCost: number;
  returnLosses: number;
  netProfit: number;
  deliveredGross: number;
}

export interface ManifestCompanyStats extends ManifestStats {
  manifestCount: number;
}

export interface ManifestOrder extends Order {
  deliveryStatus: DeliveryStatus;
  deliveryNote: string | null;
  deliveredAt: string | null;
  manifestOrderId: number;
}

export interface ShippingManifestDetail extends ShippingManifestListItem {
  companyPhone: string | null;
  orders: ManifestOrder[];
  stats: ManifestStats;
}

export const manifestsApi = {
  list: (companyId?: number) =>
    apiFetch<ShippingManifestListItem[]>(`/shipping-manifests${companyId ? `?companyId=${companyId}` : ""}`),
  get: (id: number) =>
    apiFetch<ShippingManifestDetail>(`/shipping-manifests/${id}`),
  create: (data: { shippingCompanyId: number; orderIds: number[]; notes?: string }) =>
    apiFetch<ShippingManifestListItem>("/shipping-manifests", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: { status?: "open" | "closed"; notes?: string; invoicePrice?: number | null; invoiceNotes?: string | null }) =>
    apiFetch<ShippingManifestListItem>(`/shipping-manifests/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  updateOrderDelivery: (
    manifestId: number,
    orderId: number,
    data: { deliveryStatus: DeliveryStatus; deliveryNote?: string | null; partialQuantity?: number | null }
  ) =>
    apiFetch<{ success: boolean; deliveryStatus: DeliveryStatus; deliveryNote: string | null }>(
      `/shipping-manifests/${manifestId}/orders/${orderId}`,
      { method: "PATCH", body: JSON.stringify(data) }
    ),
  delete: (id: number) =>
    apiFetch<void>(`/shipping-manifests/${id}`, { method: "DELETE" }),
  companyStats: (companyId: number) =>
    apiFetch<ManifestCompanyStats>(`/shipping-companies/${companyId}/stats`),
};

// ─── Warehouses API ─────────────────────────────────────────────────────────
export interface Warehouse {
  id: number;
  name: string;
  address: string | null;
  notes: string | null;
  isDefault: boolean;
  totalUnits: number;
  skuCount: number;
  orderCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseStockItem {
  id: number;
  warehouseId: number;
  productId: number | null;
  variantId: number | null;
  quantity: number;
  productName: string | null;
  productSku: string | null;
  variantColor: string | null;
  variantSize: string | null;
  updatedAt: string;
}

export interface WarehouseDetail extends Warehouse {
  stock: WarehouseStockItem[];
}

export const warehousesApi = {
  list: () => apiFetch<Warehouse[]>("/warehouses"),
  get: (id: number) => apiFetch<WarehouseDetail>(`/warehouses/${id}`),
  create: (data: { name: string; address?: string | null; notes?: string | null; isDefault?: boolean }) =>
    apiFetch<Warehouse>("/warehouses", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<{ name: string; address: string | null; notes: string | null; isDefault: boolean }>) =>
    apiFetch<Warehouse>(`/warehouses/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/warehouses/${id}`, { method: "DELETE" }),
  updateStock: (warehouseId: number, stockId: number, quantity: number) =>
    apiFetch<WarehouseStockItem>(`/warehouses/${warehouseId}/stock/${stockId}`, { method: "PATCH", body: JSON.stringify({ quantity }) }),
  addStock: (warehouseId: number, data: { productId?: number | null; variantId?: number | null; quantity: number }) =>
    apiFetch<WarehouseStockItem>(`/warehouses/${warehouseId}/stock`, { method: "POST", body: JSON.stringify(data) }),
};

// ─── Team & Campaign Analytics API ──────────────────────────────────────────
export interface TeamMemberStats {
  userId: number;
  userName: string;
  displayName: string;
  total: number;
  delivered: number;
  returned: number;
  pending: number;
  profit: number;
  deliveryRate: number;
  returnRate: number;
}

export interface CampaignStats {
  adSource: string;
  adCampaign: string | null;
  total: number;
  delivered: number;
  returned: number;
  pending: number;
  revenue: number;
  cost: number;
  profit: number;
  deliveryRate: number;
  roi: number;
}

// ─── Employee Profiles & KPIs ────────────────────────────────────────────────
export interface EmployeeProfile {
  id: number;
  userId: number;
  username: string;
  displayName: string;
  role: string;
  isActive: boolean;
  jobTitle: string | null;
  department: string | null;
  monthlySalary: number | null;
  hireDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeKpi {
  id: number;
  userId: number;
  name: string;
  metric: string;
  targetValue: number;
  unit: string;
  direction: "higher_is_better" | "lower_is_better";
  weight: number;
  isActive: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluatedKpi extends EmployeeKpi {
  actualValue: number | null;
  score: number | null;
  achieved: boolean | null;
}

export interface EmployeeReport {
  userId: number;
  username: string;
  displayName: string;
  role: string;
  profile: EmployeeProfile | null;
  period: { month: string; from: string; to: string };
  orderStats: {
    total: number;
    delivered: number;
    returned: number;
    pending: number;
    deliveryRate: number;
    returnRate: number;
    totalRevenue: number;
    totalProfit: number;
  };
  kpis: EvaluatedKpi[];
  overallScore: number | null;
  rating: string;
  salary: number;
}

export const employeeApi = {
  listProfiles: () => apiFetch<EmployeeProfile[]>("/employee-profiles"),
  getProfile: (userId: number) => apiFetch<EmployeeProfile & { kpis: EmployeeKpi[] }>(`/employee-profiles/${userId}`),
  upsertProfile: (data: {
    userId: number;
    jobTitle?: string | null;
    department?: string | null;
    monthlySalary?: number | null;
    hireDate?: string | null;
    notes?: string | null;
  }) => apiFetch<EmployeeProfile>("/employee-profiles", { method: "POST", body: JSON.stringify(data) }),
  updateProfile: (userId: number, data: Partial<{
    jobTitle: string | null;
    department: string | null;
    monthlySalary: number | null;
    hireDate: string | null;
    notes: string | null;
  }>) => apiFetch<EmployeeProfile>(`/employee-profiles/${userId}`, { method: "PATCH", body: JSON.stringify(data) }),
  listKpis: (userId: number) => apiFetch<EmployeeKpi[]>(`/employee-kpis/${userId}`),
  createKpi: (data: {
    userId: number; name: string; metric: string;
    targetValue: number; unit: string;
    direction: "higher_is_better" | "lower_is_better";
    weight: number; isActive: boolean; description?: string | null;
  }) => apiFetch<EmployeeKpi>("/employee-kpis", { method: "POST", body: JSON.stringify(data) }),
  updateKpi: (kpiId: number, data: Partial<EmployeeKpi>) =>
    apiFetch<EmployeeKpi>(`/employee-kpis/${kpiId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteKpi: (kpiId: number) => apiFetch<void>(`/employee-kpis/${kpiId}`, { method: "DELETE" }),
  getReport: (userId: number, month?: string) =>
    apiFetch<EmployeeReport>(`/analytics/employee-report/${userId}${month ? `?month=${month}` : ""}`),
  listUsers: () => apiFetch<AppUser[]>("/users"),
};

export const teamAnalyticsApi = {
  teamPerformance: (dateFrom?: string, dateTo?: string) => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const qs = params.toString();
    return apiFetch<TeamMemberStats[]>(`/analytics/team-performance${qs ? `?${qs}` : ""}`);
  },
  campaigns: (dateFrom?: string, dateTo?: string) => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    const qs = params.toString();
    return apiFetch<CampaignStats[]>(`/analytics/campaigns${qs ? `?${qs}` : ""}`);
  },
};

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
