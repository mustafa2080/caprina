// ─── Excel Import Dialog ─────────────────────────────────────────────────────
type ExcelRow = {
  orderId?: number;
  customerName?: string;
  deliveryStatus?: string;
  deliveryNote?: string;
  partialQuantity?: number;
};

const STATUS_MAP: Record<string, string> = {
  "delivered": "delivered",
  "returned": "returned",
  "postponed": "postponed",
  "partial_received": "partial_received",
  "partial": "partial_received",
  "pending": "pending",
};

function normalizeStatus(val: string): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  // Check Arabic values
  const arabicMap: Record<string, string> = {};
