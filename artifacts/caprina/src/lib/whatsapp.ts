export interface WaTemplate {
  id: string;
  name: string;
  body: string;
  isDefault: boolean;
}

export interface WaSettings {
  businessPhone: string;
  templates: WaTemplate[];
}

export interface WhatsAppOrderData {
  id: number;
  customerName: string;
  product: string;
  quantity: number;
  totalPrice: number;
  status: string;
  phone?: string | null;
}

export function formatEgyptianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("002")) return `+${digits.slice(2)}`;
  if (digits.startsWith("20"))  return `+${digits}`;
  if (digits.startsWith("0"))   return `+20${digits.slice(1)}`;
  if (digits.length === 10)     return `+20${digits}`;
  return `+20${digits}`;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

export function applyTemplate(templateBody: string, order: WhatsAppOrderData): string {
  return templateBody
    .replace(/\{customerName\}/g, order.customerName)
    .replace(/\{orderNumber\}/g, order.id.toString().padStart(4, "0"))
    .replace(/\{product\}/g, order.product)
    .replace(/\{quantity\}/g, String(order.quantity))
    .replace(/\{amount\}/g, formatCurrency(order.totalPrice))
    .replace(/\{status\}/g, order.status);
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const intlPhone = formatEgyptianPhone(phone).replace("+", "");
  return `https://wa.me/${intlPhone}?text=${encodeURIComponent(message)}`;
}

export function openWhatsAppWithTemplate(order: WhatsAppOrderData, template: WaTemplate): boolean {
  if (!order.phone) return false;
  const message = applyTemplate(template.body, order);
  const link = buildWhatsAppLink(order.phone, message);
  window.open(link, "_blank", "noopener,noreferrer");
  return true;
}

// Legacy: open with default built-in message (fallback if templates not loaded)
export function openWhatsApp(order: WhatsAppOrderData): boolean {
  if (!order.phone) return false;
  const statusNote =
    order.status === "pending"
      ? "أوردرك دلوقتي قيد التأكيد وهيتشحن قريباً! 🚀"
      : "أوردرك دلوقتي قيد الشحن وفي طريقه إليك! 📦";
  const message =
    `أهلاً يا ${order.customerName} 👋\n\n` +
    `بنأكد عليك أوردرك رقم *#${order.id.toString().padStart(4, "0")}* من *CAPRINA* 🛍️\n\n` +
    `📌 المنتج: *${order.product}* × ${order.quantity}\n` +
    `💰 الإجمالي: *${formatCurrency(order.totalPrice)}*\n\n` +
    `${statusNote}\n\n` +
    `شكراً لثقتك في CAPRINA ❤️\n_WIN OR DIE_`;
  const link = buildWhatsAppLink(order.phone, message);
  window.open(link, "_blank", "noopener,noreferrer");
  return true;
}

export const TEMPLATE_VARIABLES = [
  { var: "{customerName}", label: "اسم العميل" },
  { var: "{orderNumber}", label: "رقم الأوردر" },
  { var: "{product}", label: "المنتج" },
  { var: "{quantity}", label: "الكمية" },
  { var: "{amount}", label: "المبلغ الإجمالي" },
  { var: "{status}", label: "حالة الأوردر" },
];
