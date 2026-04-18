export const RETURN_REASONS: { value: string; label: string }[] = [
  { value: "size_mismatch", label: "مقاس غير مناسب" },
  { value: "quality",       label: "جودة" },
  { value: "customer_refused", label: "رفض العميل" },
  { value: "other",         label: "سبب آخر" },
];

export const returnReasonLabel = (reason: string | null | undefined): string => {
  if (!reason) return "—";
  return RETURN_REASONS.find(r => r.value === reason)?.label ?? reason;
};

export const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  in_shipping: "قيد الشحن",
  received: "استلم ✓",
  delayed: "مؤجل",
  returned: "مرتجع",
  partial_received: "استلم جزئي",
};

export const STATUS_CLASSES: Record<string, string> = {
  pending:          "bg-amber-50   dark:bg-amber-900/30   text-amber-700   dark:text-amber-400   border-amber-300   dark:border-amber-800",
  in_shipping:      "bg-sky-50     dark:bg-sky-900/30     text-sky-700     dark:text-sky-400     border-sky-300     dark:border-sky-800",
  received:         "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800",
  delayed:          "bg-blue-50    dark:bg-blue-900/30    text-blue-700    dark:text-blue-400    border-blue-300    dark:border-blue-800",
  returned:         "bg-red-50     dark:bg-red-900/30     text-red-700     dark:text-red-400     border-red-300     dark:border-red-800",
  partial_received: "bg-purple-50  dark:bg-purple-900/30  text-purple-700  dark:text-purple-400  border-purple-300  dark:border-purple-800",
};
