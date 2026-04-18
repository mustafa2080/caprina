import { useState, useRef, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle,
  ArrowRight, ArrowLeft, Settings2, Eye, Loader2,
  RotateCcw, ChevronDown, Info, Link2,
} from "lucide-react";
import { importApi, type ParsedImport, type ColumnMapping, type ImportResult } from "@/lib/api";
import { getListOrdersQueryKey, getGetOrdersSummaryQueryKey, getGetRecentOrdersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAPPING_KEY = "caprina_excel_mapping_v2";

const FIELD_DEFS = [
  { key: "name",     label: "اسم العميل",    required: true,  hint: "customer, name, اسم, عميل" },
  { key: "phone",    label: "رقم الهاتف",    required: false, hint: "phone, mobile, هاتف, رقم" },
  { key: "address",  label: "العنوان",        required: false, hint: "address, عنوان, المدينة" },
  { key: "product",  label: "المنتج",         required: true,  hint: "product, item, منتج, صنف" },
  { key: "color",    label: "اللون",          required: false, hint: "color, colour, لون" },
  { key: "size",     label: "المقاس",         required: false, hint: "size, مقاس, قياس" },
  { key: "quantity", label: "الكمية",         required: true,  hint: "qty, quantity, كمية, عدد" },
  { key: "price",    label: "سعر الوحدة",    required: false, hint: "price, unit_price, سعر" },
  { key: "notes",    label: "ملاحظات",        required: false, hint: "notes, remarks, ملاحظات" },
] as const;

type FieldKey = typeof FIELD_DEFS[number]["key"];

const EMPTY_MAPPING: ColumnMapping = {
  name: "", phone: "", address: "", product: "",
  color: "", size: "", quantity: "", price: "", notes: "",
};

// ─── Auto-detect mapping from headers ─────────────────────────────────────────
function autoDetectMapping(headers: string[]): ColumnMapping {
  const norm = (s: string) => s.toLowerCase().replace(/[_\s-]/g, "");

  const PATTERNS: Record<FieldKey, string[]> = {
    name:     ["اسمالعميل","اسم","customerName","name","customer","عميل"],
    phone:    ["رقمالهاتف","هاتف","phone","mobile","tel","جوال","موبايل","رقم"],
    address:  ["العنوان","عنوان","address","addr","city","مدينة","منطقة"],
    product:  ["المنتج","منتج","product","item","سلعة","صنف"],
    color:    ["اللون","لون","color","colour","لوان"],
    size:     ["المقاس","مقاس","size","قياس","مجال"],
    quantity: ["الكمية","كمية","quantity","qty","عدد","كم"],
    price:    ["سعرالوحدة","السعر","سعر","price","unitprice","unit_price","ثمن"],
    notes:    ["ملاحظات","notes","remarks","ملاحظة","comment"],
  };

  const result = { ...EMPTY_MAPPING };
  const used = new Set<string>();

  for (const [field, patterns] of Object.entries(PATTERNS) as [FieldKey, string[]][]) {
    for (const pattern of patterns) {
      const match = headers.find(h => norm(h) === pattern && !used.has(h));
      if (match) { result[field] = match; used.add(match); break; }
    }
    if (!result[field]) {
      // partial match fallback
      for (const pattern of patterns) {
        const match = headers.find(h => norm(h).includes(pattern) && !used.has(h));
        if (match) { result[field] = match; used.add(match); break; }
      }
    }
  }

  return result;
}

// ─── Save / load mapping ──────────────────────────────────────────────────────
function loadSavedMapping(): ColumnMapping | null {
  try {
    const raw = localStorage.getItem(MAPPING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveMapping(m: ColumnMapping) {
  localStorage.setItem(MAPPING_KEY, JSON.stringify(m));
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function Steps({ current }: { current: number }) {
  const steps = ["رفع الملف", "ضبط الأعمدة", "معاينة", "النتيجة"];
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={i} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 text-[11px] font-bold transition-all ${
              active ? "text-primary" : done ? "text-emerald-400" : "text-muted-foreground"
            }`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border
                ${active ? "bg-primary text-black border-primary" : done ? "bg-emerald-500 text-black border-emerald-500" : "border-border text-muted-foreground"}`}>
                {done ? "✓" : idx}
              </div>
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < steps.length - 1 && <div className={`w-8 h-px ${done ? "bg-emerald-500" : "bg-border"}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Helper: cell value display ───────────────────────────────────────────────
function cellDisplay(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Import() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [hasSavedMapping, setHasSavedMapping] = useState(false);

  useEffect(() => {
    setHasSavedMapping(!!loadSavedMapping());
  }, []);

  const reset = () => {
    setStep(1); setParsed(null); setMapping(EMPTY_MAPPING);
    setResult(null); setError(null); setFileName("");
  };

  // ── Step 1: Parse ────────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError("يرجى رفع ملف Excel (.xlsx, .xls) أو CSV."); return;
    }
    setError(null); setIsLoading(true); setFileName(file.name);

    try {
      const data = await importApi.parse(file);
      if (!data.headers.length) { setError("لم يتم العثور على أعمدة في الملف."); setIsLoading(false); return; }
      setParsed(data);

      // Build mapping: try saved first, then auto-detect
      const saved = loadSavedMapping();
      const auto = autoDetectMapping(data.headers);
      if (saved) {
        // Keep saved values only if the column still exists in new file
        const validSaved: ColumnMapping = { ...EMPTY_MAPPING };
        (Object.keys(saved) as FieldKey[]).forEach(k => {
          if (saved[k] && data.headers.includes(saved[k])) validSaved[k] = saved[k];
          else validSaved[k] = auto[k]; // fallback to auto
        });
        setMapping(validSaved);
      } else {
        setMapping(auto);
      }

      setStep(2);
    } catch (e: any) {
      setError(e.message || "فشل قراءة الملف.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Step 3: Execute ──────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!parsed) return;
    setIsLoading(true); setError(null);

    // Save mapping for future use
    saveMapping(mapping);
    setHasSavedMapping(true);

    try {
      const res = await importApi.execute({
        headers: parsed.headers,
        rows: parsed.allRows,
        mapping,
      });
      setResult(res);
      setStep(4);
      if (res.imported > 0) {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRecentOrdersQueryKey() });
      }
    } catch (e: any) {
      setError(e.message || "فشل الاستيراد.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Derived: preview with mapped columns ─────────────────────────────────────
  const getPreviewRow = (row: any[]): Record<string, any> => {
    const result: Record<string, any> = {};
    const headers = parsed?.headers ?? [];
    FIELD_DEFS.forEach(f => {
      const col = mapping[f.key as FieldKey];
      const idx = col ? headers.indexOf(col) : -1;
      result[f.key] = idx >= 0 ? row[idx] : "";
    });
    return result;
  };

  const requiredFields: FieldKey[] = ["name", "product", "quantity"];
  const missingRequired = requiredFields.filter(k => !mapping[k]);

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">استيراد الطلبات</h1>
          <p className="text-muted-foreground text-sm mt-0.5">استورد أي ملف Excel بسهولة بدون تعديل مسبق</p>
        </div>
        {step > 1 && (
          <Button variant="outline" size="sm" onClick={reset} className="gap-1.5 border-border text-xs">
            <RotateCcw className="w-3 h-3" />ملف جديد
          </Button>
        )}
      </div>

      <Steps current={step} />

      {/* ── Step 1: Upload ── */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Info card */}
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-start gap-3">
              <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold">يقبل النظام أي تنسيق Excel أو CSV</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ارفع ملفك وسنساعدك على ربط أعمدته بالحقول المطلوبة. لا حاجة لتعديل الملف مسبقاً.
                </p>
                {hasSavedMapping && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
                    <Link2 className="w-3 h-3" />
                    لديك إعداد محفوظ سيُطبَّق تلقائياً
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Drop zone */}
          <div
            className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200
              ${isDragging ? "border-primary bg-primary/10 scale-[1.01]" : "border-border hover:border-primary/50 hover:bg-muted/10"}
              ${isLoading ? "pointer-events-none opacity-70" : ""}`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            {isLoading ? (
              <div className="space-y-3">
                <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
                <p className="text-sm font-bold text-primary">جاري قراءة الملف...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                  {isDragging ? <FileSpreadsheet className="w-8 h-8 text-primary" /> : <Upload className="w-8 h-8 text-muted-foreground" />}
                </div>
                <div>
                  <p className="font-bold">{isDragging ? "أفلت الملف هنا" : "اسحب الملف هنا أو انقر للاختيار"}</p>
                  <p className="text-xs text-muted-foreground mt-1.5">يدعم: .xlsx, .xls, .csv — حتى 15MB</p>
                </div>
                <Button variant="outline" size="sm" className="border-border text-xs pointer-events-none">
                  اختيار ملف
                </Button>
              </div>
            )}
          </div>

          {error && <ErrorCard message={error} />}
        </div>
      )}

      {/* ── Step 2: Column Mapping ── */}
      {step === 2 && parsed && (
        <div className="space-y-4">
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-bold text-sm flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-primary" />
                    ربط الأعمدة
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    الملف: <span className="font-mono text-foreground">{fileName}</span> &nbsp;|&nbsp;
                    <span className="text-emerald-400">{parsed.totalRows} صف</span> &nbsp;|&nbsp;
                    {parsed.headers.length} عمود
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="text-xs gap-1 text-muted-foreground"
                  onClick={() => { setMapping(autoDetectMapping(parsed.headers)); }}>
                  <RotateCcw className="w-3 h-3" />اكتشاف تلقائي
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FIELD_DEFS.map(field => (
                  <div key={field.key}>
                    <Label className="text-xs mb-1.5 flex items-center gap-1.5">
                      {field.label}
                      {field.required
                        ? <Badge variant="outline" className="text-[8px] border-primary/40 text-primary px-1 py-0">مطلوب</Badge>
                        : <Badge variant="outline" className="text-[8px] border-border text-muted-foreground px-1 py-0">اختياري</Badge>
                      }
                    </Label>
                    <Select
                      value={mapping[field.key as FieldKey] || "__none__"}
                      onValueChange={v => setMapping(m => ({ ...m, [field.key]: v === "__none__" ? "" : v }))}
                    >
                      <SelectTrigger className="h-9 text-xs bg-background border-border">
                        <SelectValue placeholder="— غير مربوط —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— غير مربوط —</SelectItem>
                        {parsed.headers.filter(h => h && h.trim()).map(h => (
                          <SelectItem key={h} value={h}>
                            <div className="flex items-center gap-2">
                              <span>{h}</span>
                              {parsed.sample[0] && parsed.headers.indexOf(h) >= 0 && (
                                <span className="text-muted-foreground text-[10px] font-mono truncate max-w-[100px]">
                                  {cellDisplay(parsed.sample[0][parsed.headers.indexOf(h)])}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{field.hint}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Raw headers reference */}
          <Card className="border-border">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground mb-2 font-bold uppercase tracking-wider">أعمدة الملف المتاحة</p>
              <div className="flex flex-wrap gap-1.5">
                {parsed.headers.map((h, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] font-mono border-border">{h}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {missingRequired.length > 0 && (
            <ErrorCard message={`الحقول المطلوبة غير مربوطة: ${missingRequired.map(k => FIELD_DEFS.find(f => f.key === k)?.label).join("، ")}`} />
          )}

          {error && <ErrorCard message={error} />}

          <div className="flex justify-between">
            <Button variant="outline" size="sm" className="border-border gap-1" onClick={() => setStep(1)}>
              <ArrowRight className="w-3.5 h-3.5" />رجوع
            </Button>
            <Button size="sm" className="gap-1 font-bold" onClick={() => setStep(3)} disabled={missingRequired.length > 0}>
              معاينة<ArrowLeft className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview ── */}
      {step === 3 && parsed && (
        <div className="space-y-4">
          <Card className="border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-primary" />
                <p className="font-bold text-sm">معاينة أول 5 صفوف</p>
                <Badge variant="outline" className="text-[9px] border-border text-muted-foreground">
                  {parsed.totalRows} صف إجمالي
                </Badge>
              </div>

              <div className="overflow-x-auto rounded border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      {FIELD_DEFS.filter(f => mapping[f.key as FieldKey]).map(f => (
                        <TableHead key={f.key} className="text-right text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {f.label}
                            {f.required && <span className="text-primary">*</span>}
                          </div>
                          <div className="text-[9px] text-muted-foreground font-normal font-mono">
                            ← {mapping[f.key as FieldKey]}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.sample.map((row, ri) => {
                      const mapped = getPreviewRow(row);
                      return (
                        <TableRow key={ri} className="border-border hover:bg-muted/10">
                          {FIELD_DEFS.filter(f => mapping[f.key as FieldKey]).map(f => (
                            <TableCell key={f.key} className={`text-xs ${f.required && !mapped[f.key] ? "text-red-400" : ""}`}>
                              {cellDisplay(mapped[f.key])}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                سيتم استيراد <span className="font-bold text-foreground">{parsed.totalRows}</span> صف كاملاً بعد التأكيد.
                سيُحفظ إعداد الأعمدة لاستخدامه تلقائياً في المرات القادمة.
              </p>
            </CardContent>
          </Card>

          {error && <ErrorCard message={error} />}

          <div className="flex justify-between">
            <Button variant="outline" size="sm" className="border-border gap-1" onClick={() => setStep(2)}>
              <ArrowRight className="w-3.5 h-3.5" />تعديل الأعمدة
            </Button>
            <Button size="sm" className="gap-1.5 font-bold min-w-[140px]" onClick={handleImport} disabled={isLoading}>
              {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />جاري الاستيراد...</> : <>تأكيد الاستيراد<ArrowLeft className="w-3.5 h-3.5" /></>}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Result ── */}
      {step === 4 && result && (
        <div className="space-y-4">
          {/* Summary card */}
          <Card className={`border ${result.imported > 0 ? "border-emerald-800 bg-emerald-900/10" : "border-amber-800 bg-amber-900/10"}`}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${result.imported > 0 ? "bg-emerald-500/20" : "bg-amber-500/20"}`}>
                  <CheckCircle2 className={`w-6 h-6 ${result.imported > 0 ? "text-emerald-400" : "text-amber-400"}`} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-base mb-2">نتيجة الاستيراد</p>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>تم استيراد: <span className="font-bold text-emerald-400">{result.imported}</span> طلب</span>
                    </div>
                    {result.failed > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span>فشل: <span className="font-bold text-red-400">{result.failed}</span> صف</span>
                      </div>
                    )}
                  </div>
                  {result.imported > 0 && (
                    <a href="/orders" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline font-semibold">
                      عرض الطلبات المستوردة <ArrowLeft className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Errors */}
          {result.errors.length > 0 && (
            <Card className="border-red-900/50 bg-red-900/10">
              <CardContent className="p-4">
                <p className="text-xs font-bold text-red-400 mb-3 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  تفاصيل الصفوف الفاشلة ({result.errors.length})
                </p>
                <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <li key={i} className="text-xs text-red-300 flex items-start gap-2 bg-red-900/20 rounded p-1.5">
                      <AlertCircle className="w-3 h-3 shrink-0 mt-0.5 text-red-500" />
                      {err}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-center">
            <Button variant="outline" size="sm" className="border-border gap-1.5" onClick={reset}>
              <RotateCcw className="w-3.5 h-3.5" />استيراد ملف جديد
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Error card ───────────────────────────────────────────────────────────────
function ErrorCard({ message }: { message: string }) {
  return (
    <Card className="border-red-800 bg-red-900/20">
      <CardContent className="p-3 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        <p className="text-sm text-red-400">{message}</p>
      </CardContent>
    </Card>
  );
}
