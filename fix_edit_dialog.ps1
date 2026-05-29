$f = 'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\order-detail.tsx'
$c = Get-Content $f -Raw -Encoding UTF8

$newFunc = @'
function EditOrderRowDialog({ open, onOpenChange, order: o, shippingCompanies, products, allVariants, onSuccess }: {
  open: boolean; onOpenChange: (v: boolean) => void; order: any;
  shippingCompanies: any[]; products: any[]; allVariants: any[]; onSuccess: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateOrder = useUpdateOrder();
  const { canViewFinancials } = useAuth();

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [variantRows, setVariantRows] = useState<{ color: string; size: string; quantity: number }[]>([{ color: "", size: "", quantity: 1 }]);
  const [unitPrice, setUnitPrice] = useState(0);
  const [costPrice, setCostPrice] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const inStock = (products as any[]).filter((p: any) => {
      const variants = (allVariants as any[]).filter((v: any) => v.productId === p.id);
      return variants.length > 0
        ? variants.some((v: any) => (v.totalQuantity ?? 0) > 0)
        : (p.totalQuantity ?? 0) > 0;
    });
    return (q ? inStock.filter((p: any) => p.name?.toLowerCase().includes(q)) : inStock).slice(0, 20);
  }, [searchQuery, products, allVariants]);

  const productVariants = useMemo(
    () => (allVariants as any[]).filter((v: any) => v.productId === selectedProduct?.id),
    [allVariants, selectedProduct]
  );
  const availableColors = useMemo(() => [...new Set(productVariants.map((v: any) => v.color))] as string[], [productVariants]);
  const hasVariants = productVariants.length > 0;

  useEffect(() => {
    if (o && open) {
      const existingProduct = o.productId
        ? (products as any[]).find((p: any) => p.id === o.productId) ?? null
        : null;
      setSelectedProduct(existingProduct);
      setSearchQuery(""); setSearchOpen(false);
      setUnitPrice(o.unitPrice ?? 0);
      setCostPrice(o.costPrice ?? null);
      setNotes(o.notes ?? "");
      setVariantRows([{ color: o.color ?? "", size: o.size ?? "", quantity: o.quantity ?? 1 }]);
    }
  }, [o, open]);

  const handleSelectProduct = (p: any) => {
    setSelectedProduct(p);
    setVariantRows([{ color: "", size: "", quantity: variantRows[0]?.quantity ?? 1 }]);
    setSearchQuery(""); setSearchOpen(false);
    if (p.unitPrice) setUnitPrice(p.unitPrice);
    if (p.costPrice) setCostPrice(p.costPrice);
  };

  const updateRow = (i: number, key: string, val: any) => {
    setVariantRows(rows => {
      const next = rows.map((r, idx) => idx === i ? { ...r, [key]: val, ...(key === "color" ? { size: "" } : {}) } : r);
      if (key === "size") {
        const row = next[i];
        const v = productVariants.find((pv: any) => pv.color === row.color && pv.size === val);
        if (v?.unitPrice) setUnitPrice(v.unitPrice);
        if (v?.costPrice) setCostPrice(v.costPrice);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    try {
      const row = variantRows[0];
      const variant = hasVariants && row.color && row.size
        ? productVariants.find((v: any) => v.color === row.color && v.size === row.size)
        : null;
      await updateOrder.mutateAsync({
        id: o.id,
        data: {
          product: selectedProduct?.name ?? o.product,
          color: variant?.color ?? (row.color || null),
          size: variant?.size ?? (row.size || null),
          quantity: row.quantity,
          unitPrice,
          costPrice: costPrice ?? null,
          productId: selectedProduct?.id ?? null,
          variantId: variant?.id ?? null,
          notes: notes || null,
        } as any,
      });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["invoice-orders"] });
      toast({ title: "تم الحفظ", description: "تم تعديل المنتج بنجاح." });
      onSuccess(); onOpenChange(false);
    } catch {
      toast({ title: "خطأ", description: "فشل الحفظ.", variant: "destructive" });
    }
  };

  const row = variantRows[0];
  const sizesForColor = productVariants.filter((v: any) => v.color === row.color).map((v: any) => v.size);
  const rowVariant = productVariants.find((v: any) => v.color === row.color && v.size === row.size);
  const avail = rowVariant ? (rowVariant.totalQuantity ?? 0) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        dir="rtl"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Pencil className="w-4 h-4 text-primary" />تعديل المنتج
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <label className="text-xs font-medium mb-1.5 block">اختر من المخزون</label>
            {selectedProduct ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-md">
                <div className="flex items-center gap-2">
                  {selectedProduct.image ? (
                    <img src={selectedProduct.image} alt={selectedProduct.name} className="w-8 h-8 rounded object-cover border border-emerald-300 shrink-0" />
                  ) : (
                    <Package className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  )}
                  <span className="text-sm font-bold">{selectedProduct.name}</span>
                </div>
                <button type="button" onClick={() => { setSelectedProduct(null); setVariantRows([{ color: "", size: "", quantity: row.quantity }]); }}
                  className="text-muted-foreground hover:text-red-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    className="w-full h-9 text-sm pr-8 pl-3 rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder={`ابحث عن منتج... (حالياً: ${o?.product ?? ""})`}
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                    onFocus={() => setSearchOpen(true)}
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery("")}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {searchOpen && (
                  <div className="mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto z-10 relative">
                    {filteredProducts.length === 0 ? (
                      <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                        {searchQuery ? "لا يوجد منتج بهذا الاسم" : "لا توجد منتجات في المخزون"}
                      </div>
                    ) : filteredProducts.map((p: any) => {
                      const variants = (allVariants as any[]).filter((v: any) => v.productId === p.id);
                      const stock = variants.length > 0
                        ? variants.reduce((s: number, v: any) => s + (v.totalQuantity ?? 0), 0)
                        : (p.totalQuantity ?? 0);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); handleSelectProduct(p); }}
                          className="w-full text-right flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors text-sm border-b border-border/20 last:border-0"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {p.image ? (
                              <img src={p.image} alt={p.name} className="w-7 h-7 rounded object-cover border border-border shrink-0" />
                            ) : (
                              <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span className="font-medium truncate">{p.name}</span>
                          </div>
                          <Badge variant="outline" className={`text-[9px] font-bold shrink-0 ${stock > 0 ? "border-emerald-400 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400" : "border-red-400 text-red-600"}`}>
                            {stock > 0 ? `${stock} متاح` : "نفد"}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedProduct && hasVariants && (
            <div className="flex items-end gap-2 p-2 bg-muted/10 rounded-md border border-border/40">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground mb-1 block">اللون</label>
                <select value={row.color} onChange={e => updateRow(0, "color", e.target.value)}
                  className="w-full h-9 text-sm rounded-md border border-input bg-card px-2 focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="">اختر لون...</option>
                  {availableColors.map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground mb-1 block">المقاس</label>
                <select value={row.size} disabled={!row.color} onChange={e => updateRow(0, "size", e.target.value)}
                  className="w-full h-9 text-sm rounded-md border border-input bg-card px-2 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50">
                  <option value="">اختر مقاس...</option>
                  {sizesForColor.map((s: string) => {
                    const v = productVariants.find((pv: any) => pv.color === row.color && pv.size === s);
                    const a = v ? (v.totalQuantity ?? 0) : 0;
                    return <option key={s} value={s} disabled={a === 0}>{s} {a === 0 ? "(نفد)" : `(${a})`}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">الكمية</label>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => updateRow(0, "quantity", Math.max(1, row.quantity - 1))}
                    className="w-7 h-9 flex items-center justify-center rounded border border-input bg-card hover:bg-muted text-sm font-bold">-</button>
                  <span className="w-8 text-center text-sm font-bold">{row.quantity}</span>
                  <button type="button" onClick={() => updateRow(0, "quantity", avail !== null ? Math.min(avail, row.quantity + 1) : row.quantity + 1)}
                    className="w-7 h-9 flex items-center justify-center rounded border border-input bg-card hover:bg-muted text-sm font-bold">+</button>
                </div>
              </div>
              {avail !== null && (
                <span className={`text-[9px] font-bold mb-2 shrink-0 ${avail <= 5 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>متاح:{avail}</span>
              )}
            </div>
          )}

          {(!selectedProduct || !hasVariants) && (
            <div>
              <label className="text-xs font-medium mb-1.5 block">الكمية *</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => updateRow(0, "quantity", Math.max(1, row.quantity - 1))}
                  className="w-9 h-9 flex items-center justify-center rounded border border-input bg-card hover:bg-muted text-sm font-bold">-</button>
                <span className="w-10 text-center text-sm font-bold">{row.quantity}</span>
                <button type="button" onClick={() => updateRow(0, "quantity", row.quantity + 1)}
                  className="w-9 h-9 flex items-center justify-center rounded border border-input bg-card hover:bg-muted text-sm font-bold">+</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1.5 block">سعر البيع (ج.م) *</label>
              <Input type="number" min={0} value={unitPrice || ""} onChange={e => setUnitPrice(Number(e.target.value))} className="h-9 text-sm" />
            </div>
            {canViewFinancials && (
              <div>
                <label className="text-xs font-medium mb-1.5 block">تكلفة الوحدة (ج.م)</label>
                <Input type="number" min={0} value={costPrice ?? ""} onChange={e => setCostPrice(e.target.value ? Number(e.target.value) : null)} className="h-9 text-sm" />
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium mb-1.5 block">ملاحظات</label>
            <Textarea className="min-h-[50px] text-sm resize-none" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="flex gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="flex-1">الغاء</Button>
          <Button size="sm" onClick={handleSubmit}
            disabled={updateOrder.isPending || unitPrice <= 0}
            className="flex-1 gap-1">
            <Save className="w-3 h-3" />{updateOrder.isPending ? "جاري الحفظ..." : "حفظ التعديل"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
'@

$oldStart = $c.IndexOf("function EditOrderRowDialog")
$invoiceViewIdx = $c.IndexOf("`nfunction InvoiceView")
$commentIdx = $c.LastIndexOf("//", $oldStart)
$lineStart = $c.LastIndexOf("`n", $commentIdx) + 1

Write-Host "lineStart=$lineStart invoiceViewIdx=$invoiceViewIdx"

$before = $c.Substring(0, $lineStart)
$after = $c.Substring($invoiceViewIdx)
$newContent = $before + "// -- Edit Single Order Row Dialog`n" + $newFunc + $after

[System.IO.File]::WriteAllText($f, $newContent, [System.Text.Encoding]::UTF8)
Write-Host "Done!"
