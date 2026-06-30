export const RETURN_REASONS: { value: string; label: string }[] = [
  { value: "no_answer",      label: "العميل لا يرد" },
  { value: "unavailable",    label: "العميل مغلق أو غير متاح" },
  { value: "postponed",      label: "العميل طلب التأجيل" },
  { value: "no_knowledge",   label: "العميل ليس لديه علم بالشحنة" },
  { value: "cancel_request", label: "العميل طلب إلغاء الشحنة" },
  { value: "refused_paid",   label: "العميل رفض الاستلام بعد المعاينة ودفع مصاريف الشحن" },
  { value: "refused_unpaid", label: "العميل رفض الاستلام بعد المعاينة ولم يدفع مصاريف الشحن" },
  { value: "damaged",        label: "الشحنة تالفة" },
  { value: "unclear_address",label: "العنوان غير واضح" },
  { value: "out_of_coverage",label: "العنوان خارج نطاق التغطية" },
  { value: "time_mismatch",  label: "وقت العميل غير مناسب مع وقت المندوب" },
  { value: "other",          label: "سبب آخر" },
];

export const returnReasonLabel = (reason: string | null | undefined): string => {
  if (!reason) return "—";
  const found = RETURN_REASONS.find(r => r.value === reason);
  if (found) return found.label;
  // Legacy/alternate values seen historically in the database
  const LEGACY_LABELS: Record<string, string> = {
    quality: "جودة المنتج",
    customer_refused: "عميل غير جاد",
    customer_requested_return: "طلب العميل",
    delay: "تأخير",
    size_mismatch: "مقاس غير مناسب",
  };
  return LEGACY_LABELS[reason] ?? reason;
};

export const STATUS_LABELS: Record<string, string> = {
  pending:          "قيد الانتظار",
  warehouse_ready:  "قيد الشحن في المخزن",
  in_shipping:      "قيد الشحن",
  received:         "استلم ✓",
  delayed:          "مؤجل",
  returned:         "مرتجع",
  partial_received: "استلم جزئي",
};

export const STATUS_CLASSES: Record<string, string> = {
  pending:          "bg-amber-50   dark:bg-amber-900/30   text-amber-700   dark:text-amber-400   border-amber-300   dark:border-amber-800",
  warehouse_ready:  "bg-teal-50    dark:bg-teal-900/30    text-teal-700    dark:text-teal-400    border-teal-300    dark:border-teal-800",
  in_shipping:      "bg-sky-50     dark:bg-sky-900/30     text-sky-700     dark:text-sky-400     border-sky-300     dark:border-sky-800",
  received:         "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800",
  delayed:          "bg-blue-50    dark:bg-blue-900/30    text-blue-700    dark:text-blue-400    border-blue-300    dark:border-blue-800",
  returned:         "bg-red-50     dark:bg-red-900/30     text-red-700     dark:text-red-400     border-red-300     dark:border-red-800",
  partial_received: "bg-purple-50  dark:bg-purple-900/30  text-purple-700  dark:text-purple-400  border-purple-300  dark:border-purple-800",
};

export const getOrderStatusLabel = (status: string, returnReceived: number | boolean | null | undefined): string => {
  if (status === "partial_received") {
    const isReceived = returnReceived === 1 || returnReceived === true;
    return isReceived ? "استلام جزئي المرتجع في المخزن" : "استلام جزئي ما زال عند شركة الشحن";
  }
  return STATUS_LABELS[status] || status;
};

