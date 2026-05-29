import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search, X, Package, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProductSearchComboboxProps {
  products: any[];
  allVariants: any[];
  onSelect: (p: any) => void;
  /** اختياري — لو true يعرض كـ input بدل button (للاستخدام داخل dialog) */
  inputStyle?: boolean;
}

export function ProductSearchCombobox({
  products,
  allVariants,
  onSelect,
  inputStyle = false,
}: ProductSearchComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const inStockProducts = useMemo(() => products.filter((p: any) => {
    const variants = allVariants.filter((v: any) => v.productId === p.id);
    if (variants.length > 0) return variants.some((v: any) => (v.totalQuantity ?? 0) > 0);
    return (p.totalQuantity ?? 0) > 0;
  }), [products, allVariants]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return (q
      ? inStockProducts.filter((p: any) => p.name?.toLowerCase().includes(q))
      : inStockProducts
    ).slice(0, 20);
  }, [query, inStockProducts]);

  const getStock = (p: any) => {
    const variants = allVariants.filter((v: any) => v.productId === p.id);
    return variants.length > 0
      ? variants.reduce((s: number, v: any) => s + (v.totalQuantity ?? 0), 0)
      : (p.totalQuantity ?? 0);
  };

  // ── Portal mode (button style — لـ order-form) ──────────────────────────
  const calcPosition = () => {
    const anchor = btnRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropH = Math.min(320, window.innerHeight * 0.5);
    const showAbove = spaceBelow < dropH + 8 && spaceAbove > spaceBelow;
    setDropdownStyle({
      position: "fixed",
      zIndex: 9999,
      width: rect.width,
      left: rect.left,
      ...(showAbove
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  };

  useEffect(() => {
    if (!open || inputStyle) return;
    const update = () => calcPosition();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, inputStyle]);

  useEffect(() => {
    if (!open || inputStyle) return;
    setTimeout(() => searchRef.current?.focus(), 50);
  }, [open, inputStyle]);

  // أغلق لما يضغط برا
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (inputRef.current?.contains(target)) return;
      if (containerRef.current?.contains(target)) return;
      const portal = document.getElementById("product-combobox-portal");
      if (portal?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  const dropdownContent = (
    <div
      id={inputStyle ? undefined : "product-combobox-portal"}
      style={inputStyle ? undefined : dropdownStyle}
      className={
        inputStyle
          ? "absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto"
          : "bg-popover border border-border rounded-md shadow-2xl"
      }
    >
      {/* بحث — فقط في portal mode */}
      {!inputStyle && (
        <div className="p-2 border-b border-border/50">
          <div className="relative">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              className="w-full h-8 text-sm pr-8 pl-3 rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="ابحث بالاسم..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" onClick={() => setQuery("")}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* القائمة */}
      <div className="overflow-y-auto" style={{ maxHeight: inputStyle ? undefined : 220 }}>
        {filtered.length === 0 ? (
          <div className="px-3 py-5 text-center text-sm text-muted-foreground">
            {query ? "لا يوجد منتج بهذا الاسم" : "لا توجد منتجات متاحة في المخزون"}
          </div>
        ) : filtered.map((p: any) => {
          const stock = getStock(p);
          return (
            <button key={p.id} type="button"
              className="w-full text-right flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors text-sm border-b border-border/20 last:border-0"
              onClick={() => { onSelect(p); setQuery(""); setOpen(false); }}>
              <div className="flex items-center gap-2 min-w-0">
                {(p as any).image ? (
                  <img src={(p as any).image} alt={p.name} className="w-7 h-7 rounded object-cover border border-border shrink-0" />
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

      {/* عدد المنتجات — فقط في portal mode */}
      {!inputStyle && (
        <div className="px-3 py-1.5 border-t border-border/30 text-[10px] text-muted-foreground text-center">
          {filtered.length} منتج
        </div>
      )}
    </div>
  );

  // ── Input style (للاستخدام داخل dialog) ─────────────────────────────────
  if (inputStyle) {
    return (
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef as any}
            type="text"
            className="w-full h-9 text-sm pr-8 pl-3 rounded-md border border-input bg-card focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="ابحث عن منتج من المخزون..."
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
          {query && (
            <button type="button" onClick={() => setQuery("")}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {open && dropdownContent}
      </div>
    );
  }

  // ── Button / Portal style (للاستخدام في صفحة الطلب الجديد) ─────────────
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => { calcPosition(); setOpen(v => !v); }}
        className="w-full h-9 flex items-center justify-between gap-2 px-3 rounded-md border border-input bg-card text-sm hover:bg-muted/40 transition-colors"
      >
        <span className="text-muted-foreground">اختر منتج من المخزون...</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && createPortal(dropdownContent, document.body)}
    </>
  );
}
