export function formatEgyptianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("002")) return `+${digits.slice(2)}`;
  if (digits.startsWith("20"))  return `+${digits}`;
  if (digits.startsWith("0"))   return `+20${digits.slice(1)}`;
  if (digits.length === 10)     return `+20${digits}`;
  return `+20${digits}`;
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

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(n);

export function buildWhatsAppMessage(order: WhatsAppOrderData): string {
  const orderNo = order.id.toString().padStart(4, "0");
  const statusNote =
    order.status === "pending"
      ? "أوردرك دلوقتي قيد التأكيد وهيتشحن قريباً! 🚀"
      : "أوردرك دلوقتي قيد الشحن وفي طريقه إليك! 📦";

  return (
    `أهلاً يا ${order.customerName} 👋\n\n` +
    `بنأكد عليك أوردرك رقم *#${orderNo}* من *CAPRINA* 🛍️\n\n` +
    `📌 المنتج: *${order.product}* × ${order.quantity}\n` +
    `💰 الإجمالي: *${formatCurrency(order.totalPrice)}*\n\n` +
    `${statusNote}\n\n` +
    `شكراً لثقتك في CAPRINA ❤️\n` +
    `_WIN OR DIE_`
  );
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const intlPhone = formatEgyptianPhone(phone).replace("+", "");
  return `https://wa.me/${intlPhone}?text=${encodeURIComponent(message)}`;
}

export function openWhatsApp(order: WhatsAppOrderData): boolean {
  if (!order.phone) return false;
  const msg = buildWhatsAppMessage(order);
  const link = buildWhatsAppLink(order.phone, msg);
  window.open(link, "_blank", "noopener,noreferrer");
  return true;
}
