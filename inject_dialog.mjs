import { readFileSync, writeFileSync } from 'fs';

const filePath = String.raw`C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\caprina\src\pages\order-detail.tsx`;
let content = readFileSync(filePath, 'utf8');

// ── 1. Update lucide imports ───────────────────────────────────────────────
const oldImport = `import { ArrowRight, AlertCircle, Pencil, Save, X, Printer, Phone, MapPin, Trash2, RotateCcw, TrendingUp, TrendingDown, AlertTriangle, Lock, MessageCircle, Package, Truck, CheckCircle2, Clock, Plus, Search } from "lucide-react";`;
const newImport = `import { ArrowRight, AlertCircle, Pencil, Save, X, Printer, Phone, MapPin, Trash2, RotateCcw, TrendingUp, TrendingDown, AlertTriangle, Lock, MessageCircle, Package, Truck, CheckCircle2, Clock, Plus, Search, FileEdit, DollarSign, ChevronDown, ChevronUp, Layers } from "lucide-react";`;
content = content.replace(oldImport, newImport);

// ── 2. The new EditInvoiceDialog component ─────────────────────────────────
const editInvoiceDialog = `
// ── Edit Invoice Dialog ───────────────────────────────────────────────────────
function EditInvoiceDialog({ open, onOpenChange, orders, shippingCompanies, products, allVariants, onSuccess }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  orders: any[]; shippingCompanies: any[]; products: any[]; allVariants: any[];
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateOrder = useUpdateOrder();
  const { canViewFinancials } = useAuth();
  const primaryOrder = orders[0];

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [shippingCompanyId, setShippingCompanyId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  type RowState = {
    id: number; selectedProduct: any; searchQuery: string; searchOpen: boolean;
    color: string; size: string; quantity: number; unitPrice: number;
    costPrice: number | null; notes: string; collapsed: boolean;
  };
  const [rows, setRows] = useState<RowState[]>([]);

  useEffect(() => {
    if (!open || orders.length === 0) return;
    const p = orders[0];
    setCustomerName(p.customerName ?? "");
    setPhone(p.phone ?? "");
    setCity(p.city ?? "");
    setAddress(p.address ?? "");
    setShippingCompanyId(p.shippingCompanyId ?? null);
    setRows(orders.map(o => ({
      id: o.id,
      selectedProduct: (products as any[]).find((pr: any) => pr.id === o.productId) ?? null,
      searchQuery: "", searchOpen: false,
      color: o.color ?? "", size: o.size ?? "",
      quantity: o.quantity ?? 1, unitPrice: o.unitPrice ?? 0,
      costPrice: o.costPrice ?? null, notes: o.notes ?? "",
      collapsed: false,
    })));
  }, [open, orders]);

  const patchRow = (idx: number, patch: Partial<RowState>) =>
    setRows(r => r.map((row, i) => i === idx ? { ...row, ...patch } : row));

  const selectProduct = (idx: number, p: any) => {
    patchRow(idx, { selectedProduct: p, searchQuery: "", searchOpen: false, color: "", size: "",
      unitPrice: p.unitPrice ?? rows[idx].unitPrice, costPrice: p.costPrice ?? rows[idx].costPrice });
  };

  const changeColor = (idx: number, color: string) => patchRow(idx, { color, size: "" });

  const changeSize = (idx: number, size: string) => {
    const row = rows[idx];
    const pvs = (allVariants as any[]).filter((v: any) => v.productId === row.selectedProduct?.id);
    const v = pvs.find((pv: any) => pv.color === row.color && pv.size === size);
    patchRow(idx, { size, ...(v?.unitPrice ? { unitPrice: v.unitPrice } : {}), ...(v?.costPrice ? { costPrice: v.costPrice } : {}) });
  };

  const totalRevenue = rows.reduce((s, r) => s + r.quantity * r.unitPrice, 0);
  const totalCost    = rows.reduce((s, r) => s + r.quantity * (r.costPrice ?? 0), 0);
  const totalProfit  = totalRevenue - totalCost;
  const totalMargin  = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

  const handleSubmit = async () => {
    if (!customerName.trim()) {
      toast({ title: "خطأ", description: "اسم العميل مطلوب.", variant: "destructive" }); return;
    }
    setIsSubmitting(true);
    try {
      await Promise.all(rows.map(row => {
        const pvs = (allVariants as any[]).filter((v: any) => v.productId === row.selectedProduct?.id);
        const variant = pvs.find((v: any) => v.color === row.color && v.size === row.size) ?? null;
        const origOrder = orders.find(o => o.id === row.id);
        return updateOrder.mutateAsync({
          id: row.id,
          data: {
            customerName: customerName.trim(),
            phone: phone.trim() || null,
            city: city.trim() || null,
            address: address.trim() || null,
            shippingCompanyId: shippingCompanyId ?? null,
            product: row.selectedProduct?.name ?? origOrder?.product ?? "",
            color: row.color || null, size: row.size || null,
            quantity: row.quantity, unitPrice: row.unitPrice,
            costPrice: row.costPrice ?? null,
            productId: row.selectedProduct?.id ?? null,
            variantId: variant?.id ?? null,
            notes: row.notes || null,
          } as any,
        });
      }));
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["invoice-orders"] });
      queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
      toast({ title: "تم الحفظ ✅", description: \`تم تعديل فاتورة \${primaryOrder?.invoiceNumber} بنجاح.\` });
      onSuccess(); onOpenChange(false);
    } catch {
      toast({ title: "خطأ", description: "فشل الحفظ، حاول مرة أخرى.", variant: "destructive" });
    } finally { setIsSubmitting(false); }
  };

  if (!primaryOrder) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl w-full max-h-[92vh] p-0 overflow-hidden flex flex-col"
        dir="rtl"
        onInteractOutside={e => e.preventDefault()}
        onPointerDownOutside={e => e.preventDefault()}
      >
        {/* sticky header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2">
            <FileEdit className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold">تعديل الفاتورة</span>
            <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{primaryOrder.invoiceNumber}</span>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-3">

            {/* ── main col ── */}
            <div className="md:col-span-2 p-5 space-y-5 border-l border-border">

              {/* بيانات العميل */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2 pb-2 border-b border-border">
                  <Phone className="w-3.5 h-3.5 text-primary" />بيانات العميل
                </h3>
                <div>
                  <label className="text-xs font-medium mb-1.5 block">اسم العميل *</label>
                  <input type="text" className="w-full h-9 text-sm px-3 rounded-md border border-input bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                    value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="اسم العميل" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block">رقم الهاتف</label>
                    <input type="text" className="w-full h-9 text-sm px-3 rounded-md border border-input bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                      value={phone} onChange={e => setPhone(e.target.value)} placeholder="05xxxxxxxx" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block">شركة الشحن</label>
                    <select className="w-full h-9 text-sm rounded-md border border-input bg-card px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                      value={shippingCompanyId ?? ""} onChange={e => setShippingCompanyId(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">بدون</option>
                      {(shippingCompanies as any[]).filter((c: any) => c.isActive).map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block">المحافظة</label>
                    <input type="text" className="w-full h-9 text-sm px-3 rounded-md border border-input bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                      value={city} onChange={e => setCity(e.target.value)} placeholder="القاهرة..." />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block">العنوان</label>
                    <input type="text" className="w-full h-9 text-sm px-3 rounded-md border border-input bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                      value={address} onChange={e => setAddress(e.target.value)} placeholder="الشارع..." />
                  </div>
                </div>
              </div>

              {/* المنتجات */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2 pb-2 border-b border-border">
                  <Package className="w-3.5 h-3.5 text-primary" />المنتجات
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{rows.length} منتج</span>
                </h3>
                {rows.map((row, idx) => {
                  const pvs    = (allVariants as any[]).filter((v: any) => v.productId === row.selectedProduct?.id);
                  const colors = [...new Set(pvs.map((v: any) => v.color))] as string[];
                  const hasVar = pvs.length > 0;
                  const sizes  = pvs.filter((v: any) => v.color === row.color).map((v: any) => v.size);
                  const rv     = pvs.find((v: any) => v.color === row.color && v.size === row.size);
                  const avail  = rv ? (rv.totalQuantity ?? 0) : null;
                  const rev    = row.quantity * row.unitPrice;
                  const cst    = row.quantity * (row.costPrice ?? 0);
                  const prf    = rev - cst;
                  const orig   = orders.find(o => o.id === row.id);

                  const filtered = (() => {
                    const q = row.searchQuery.toLowerCase().trim();
                    const inStock = (products as any[]).filter((p: any) => {
                      const vs = (allVariants as any[]).filter((v: any) => v.productId === p.id);
                      return vs.length > 0 ? vs.some((v: any) => (v.totalQuantity ?? 0) > 0) : (p.totalQuantity ?? 0) > 0;
                    });
                    return (q ? inStock.filter((p: any) => p.name?.toLowerCase().includes(q)) : inStock).slice(0, 20);
                  })();

                  return (
                    <div key={row.id} className="border border-border rounded-lg overflow-hidden">
                      {/* row header */}
                      <div className="flex items-center justify-between px-3 py-2.5 bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors select-none"
                        onClick={() => patchRow(idx, { collapsed: !row.collapsed })}>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary shrink-0">{idx + 1}</div>
                          <span className="text-xs font-bold truncate max-w-[150px]">{row.selectedProduct?.name ?? orig?.product ?? \`منتج \${idx + 1}\`}</span>
                          {row.color && row.size && (
                            <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">{row.color} {row.size} ×{row.quantity}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-primary">{formatCurrency(rev)}</span>
                          {row.collapsed ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />}
                        </div>
                      </div>

                      {!row.collapsed && (
                        <div className="px-3 pb-3 pt-2 space-y-3 bg-card">
                          {/* product search */}
                          <div>
                            <label className="text-xs font-medium mb-1.5 block flex items-center gap-1">
                              <Layers className="w-3 h-3" />اختر من المخزون
                            </label>
                            {row.selectedProduct ? (
                              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-md">
                                <div className="flex items-center gap-2">
                                  {row.selectedProduct.image
                                    ? <img src={row.selectedProduct.image} alt={row.selectedProduct.name} className="w-7 h-7 rounded object-cover border border-emerald-300 shrink-0" />
                                    : <Package className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                                  <span className="text-sm font-bold">{row.selectedProduct.name}</span>
                                </div>
                                <button type="button" onClick={() => patchRow(idx, { selectedProduct: null, color: "", size: "" })}
                                  className="text-muted-foreground hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                              </div>
                            ) : (
                              <div className="relative">
                                <div className="relative">
                                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                  <input type="text"
                                    className="w-full h-9 text-sm pr-8 pl-3 rounded-md border border-input bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                                    placeholder={\`ابحث... (حالياً: \${orig?.product ?? ""})\`}
                                    value={row.searchQuery}
                                    onChange={e => patchRow(idx, { searchQuery: e.target.value, searchOpen: true })}
                                    onFocus={() => patchRow(idx, { searchOpen: true })} />
                                  {row.searchQuery && (
                                    <button type="button" onClick={() => patchRow(idx, { searchQuery: "", searchOpen: false })}
                                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                      <X className="w-3.5 h-3.5" /></button>
                                  )}
                                </div>
                                {row.searchOpen && (
                                  <div className="mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-44 overflow-y-auto z-20 relative">
                                    {filtered.length === 0
                                      ? <div className="px-3 py-4 text-center text-sm text-muted-foreground">لا يوجد منتج</div>
                                      : filtered.map((p: any) => {
                                          const vs = (allVariants as any[]).filter((v: any) => v.productId === p.id);
                                          const stk = vs.length > 0 ? vs.reduce((s: number, v: any) => s + (v.totalQuantity ?? 0), 0) : (p.totalQuantity ?? 0);
                                          return (
                                            <button key={p.id} type="button"
                                              onMouseDown={e => { e.preventDefault(); selectProduct(idx, p); }}
                                              className="w-full text-right flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted/50 transition-colors text-sm border-b border-border/20 last:border-0">
                                              <div className="flex items-center gap-2 min-w-0">
                                                {p.image ? <img src={p.image} alt={p.name} className="w-6 h-6 rounded object-cover border border-border shrink-0" /> : <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                                                <span className="font-medium truncate">{p.name}</span>
                                              </div>
                                              <span className={\`text-[9px] font-bold shrink-0 \${stk > 0 ? "text-emerald-600" : "text-red-500"}\`}>{stk > 0 ? \`\${stk} متاح\` : "نفد"}</span>
                                            </button>
                                          );
                                        })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* color / size */}
                          {row.selectedProduct && hasVar && (
                            <div className="flex items-end gap-2 p-2 bg-muted/10 rounded-md border border-border/40">
                              <div className="flex-1">
                                <label className="text-[10px] text-muted-foreground mb-1 block">اللون</label>
                                <select value={row.color} onChange={e => changeColor(idx, e.target.value)}
                                  className="w-full h-9 text-sm rounded-md border border-input bg-card px-2 focus:outline-none focus:ring-1 focus:ring-ring">
                                  <option value="">اختر لون...</option>
                                  {colors.map((c: string) => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </div>
                              <div className="flex-1">
                                <label className="text-[10px] text-muted-foreground mb-1 block">المقاس</label>
                                <select value={row.size} disabled={!row.color} onChange={e => changeSize(idx, e.target.value)}
                                  className="w-full h-9 text-sm rounded-md border border-input bg-card px-2 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50">
                                  <option value="">اختر مقاس...</option>
                                  {sizes.map((s: string) => {
                                    const v = pvs.find((pv: any) => pv.color === row.color && pv.size === s);
                                    const a = v ? (v.totalQuantity ?? 0) : 0;
                                    return <option key={s} value={s} disabled={a === 0}>{s} {a === 0 ? "(نفد)" : \`(\${a})\`}</option>;
                                  })}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] text-muted-foreground mb-1 block">الكمية</label>
                                <div className="flex items-center gap-1">
                                  <button type="button" onClick={() => patchRow(idx, { quantity: Math.max(1, row.quantity - 1) })}
                                    className="w-7 h-9 flex items-center justify-center rounded border border-input bg-card hover:bg-muted text-sm font-bold">−</button>
                                  <span className="w-8 text-center text-sm font-bold">{row.quantity}</span>
                                  <button type="button" onClick={() => patchRow(idx, { quantity: avail !== null ? Math.min(avail, row.quantity + 1) : row.quantity + 1 })}
                                    className="w-7 h-9 flex items-center justify-center rounded border border-input bg-card hover:bg-muted text-sm font-bold">+</button>
                                </div>
                              </div>
                              {avail !== null && <span className={\`text-[9px] font-bold mb-2 shrink-0 \${avail <= 5 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}\`}>متاح:{avail}</span>}
                            </div>
                          )}

                          {/* qty no variants */}
                          {(!row.selectedProduct || !hasVar) && (
                            <div>
                              <label className="text-xs font-medium mb-1.5 block">الكمية *</label>
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => patchRow(idx, { quantity: Math.max(1, row.quantity - 1) })}
                                  className="w-9 h-9 flex items-center justify-center rounded border border-input bg-card hover:bg-muted text-sm font-bold">−</button>
                                <span className="w-10 text-center text-sm font-bold">{row.quantity}</span>
                                <button type="button" onClick={() => patchRow(idx, { quantity: row.quantity + 1 })}
                                  className="w-9 h-9 flex items-center justify-center rounded border border-input bg-card hover:bg-muted text-sm font-bold">+</button>
                              </div>
                            </div>
                          )}

                          {/* price / cost */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-medium mb-1.5 block">سعر البيع (ج.م) *</label>
                              <input type="number" min={0} className="w-full h-9 text-sm px-3 rounded-md border border-input bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                                value={row.unitPrice || ""} onChange={e => patchRow(idx, { unitPrice: Number(e.target.value) })} />
                            </div>
                            {canViewFinancials && (
                              <div>
                                <label className="text-xs font-medium mb-1.5 block flex items-center gap-1"><DollarSign className="w-3 h-3 text-emerald-600" />تكلفة الوحدة</label>
                                <input type="number" min={0} className="w-full h-9 text-sm px-3 rounded-md border border-input bg-card focus:outline-none focus:ring-1 focus:ring-ring"
                                  value={row.costPrice ?? ""} onChange={e => patchRow(idx, { costPrice: e.target.value ? Number(e.target.value) : null })} />
                              </div>
                            )}
                          </div>

                          {/* profit mini */}
                          {canViewFinancials && (row.costPrice ?? 0) > 0 && (
                            <div className="grid grid-cols-3 gap-2 p-2 bg-background/50 rounded border border-border text-center">
                              <div><p className="text-[9px] text-muted-foreground">إيرادات</p><p className="text-xs font-bold text-primary">{formatCurrency(rev)}</p></div>
                              <div><p className="text-[9px] text-muted-foreground">التكلفة</p><p className="text-xs font-bold text-amber-700 dark:text-amber-400">{formatCurrency(cst)}</p></div>
                              <div><p className="text-[9px] text-muted-foreground">الربح</p><p className={\`text-xs font-bold \${prf >= 0 ? "text-emerald-600" : "text-red-600"}\`}>{formatCurrency(prf)}</p></div>
                            </div>
                          )}

                          {/* notes */}
                          <div>
                            <label className="text-xs font-medium mb-1.5 block">ملاحظات</label>
                            <textarea rows={2} className="w-full text-sm px-3 py-2 rounded-md border border-input bg-card focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                              value={row.notes} onChange={e => patchRow(idx, { notes: e.target.value })} placeholder="ملاحظات اختيارية..." />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── sidebar ── */}
            <div className="p-4 space-y-4 bg-muted/10">
              <div className="bg-card border border-primary/30 rounded-lg p-4 space-y-3">
                <p className="text-sm font-bold text-primary">الملخص</p>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {rows.map((row, i) => {
                    const name = row.selectedProduct?.name ?? orders.find(o => o.id === row.id)?.product ?? \`منتج \${i + 1}\`;
                    return (
                      <div key={row.id} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                        <span className="text-muted-foreground truncate max-w-[100px]">{name}</span>
                        <span className="font-bold shrink-0">{formatCurrency(row.quantity * row.unitPrice)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-2 text-xs pt-1 border-t border-border">
                  <div className="flex justify-between"><span className="text-muted-foreground">عدد المنتجات</span><span>{rows.length}</span></div>
                  <div className="flex justify-between font-bold border-t border-border pt-2">
                    <span>إجمالي البيع</span>
                    <span className="text-base text-primary">{formatCurrency(totalRevenue)}</span>
                  </div>
                  {canViewFinancials && totalCost > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">التكلفة</span>
                        <span className="text-amber-700 dark:text-amber-400">-{formatCurrency(totalCost)}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-border pt-2">
                        <span>الربح الصافي</span>
                        <span className={\`text-base \${totalProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"}\`}>{formatCurrency(totalProfit)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">هامش الربح</span>
                        <span className={\`font-bold \${totalMargin >= 20 ? "text-emerald-600 dark:text-emerald-400" : totalMargin >= 10 ? "text-amber-700 dark:text-amber-400" : "text-red-600"}\`}>{totalMargin}%</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <button type="button" onClick={handleSubmit}
                disabled={isSubmitting || !customerName.trim()}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold text-sm h-10 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
                <Save className="w-4 h-4" />
                {isSubmitting ? "جاري الحفظ..." : \`حفظ الفاتورة (\${rows.length} منتجات)\`}
              </button>
              <button type="button" onClick={() => onOpenChange(false)}
                className="w-full flex items-center justify-center gap-2 border border-border text-sm h-9 rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4" />إلغاء
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

`;

// ── 3. Inject before InvoiceView ──────────────────────────────────────────
const marker = 'function InvoiceView(';
const idx = content.indexOf(marker);
if (idx === -1) { console.error('ERROR: marker not found'); process.exit(1); }
content = content.slice(0, idx) + editInvoiceDialog + content.slice(idx);

// ── 4. Add showEditInvoice state inside InvoiceView ────────────────────────
content = content.replace(
  `const [showDeleteId, setShowDeleteId] = useState<number | null>(null);`,
  `const [showDeleteId, setShowDeleteId] = useState<number | null>(null);
  const [showEditInvoice, setShowEditInvoice] = useState(false);`
);

// ── 5. Add "تعديل الفاتورة" button in InvoiceView header ──────────────────
content = content.replace(
  `            <div className="text-left">
              <p className="text-xs text-muted-foreground mb-1">إجمالي الفاتورة</p>
              <p className="text-xl font-black text-primary">{formatCurrency(invoiceTotal)}</p>
            </div>`,
  `            <div className="flex flex-col items-end gap-2">
              <p className="text-xs text-muted-foreground">إجمالي الفاتورة</p>
              <p className="text-xl font-black text-primary">{formatCurrency(invoiceTotal)}</p>
              {isAdmin && (
                <button onClick={() => setShowEditInvoice(true)}
                  className="flex items-center gap-1.5 text-xs font-bold text-primary border border-primary/40 hover:bg-primary/5 px-3 py-1.5 rounded-md transition-colors">
                  <FileEdit className="w-3.5 h-3.5" />تعديل الفاتورة
                </button>
              )}
            </div>`
);

// ── 6. Add EditInvoiceDialog usage inside InvoiceView ─────────────────────
content = content.replace(
  `      <EditOrderRowDialog
        open={!!editingOrder} onOpenChange={v => { if (!v) setEditingOrder(null); }}
        order={editingOrder} shippingCompanies={shippingCompanies}
        products={products} allVariants={allVariants} onSuccess={onRefresh}
      />`,
  `      <EditOrderRowDialog
        open={!!editingOrder} onOpenChange={v => { if (!v) setEditingOrder(null); }}
        order={editingOrder} shippingCompanies={shippingCompanies}
        products={products} allVariants={allVariants} onSuccess={onRefresh}
      />
      <EditInvoiceDialog
        open={showEditInvoice} onOpenChange={setShowEditInvoice}
        orders={orders} shippingCompanies={shippingCompanies}
        products={products} allVariants={allVariants} onSuccess={onRefresh}
      />`
);

writeFileSync(filePath, content, 'utf8');
console.log('Done! File updated successfully.');
