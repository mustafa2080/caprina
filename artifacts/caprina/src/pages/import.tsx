import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { importApi, type ImportResult } from "@/lib/api";
import { getListOrdersQueryKey, getGetOrdersSummaryQueryKey, getGetRecentOrdersQueryKey } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Download, Info } from "lucide-react";
export default function Import() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError("يرجى رفع ملف Excel (.xlsx, .xls) أو CSV.");
      return;
    }
    setError(null);
    setResult(null);
    setIsUploading(true);
    try {
      const res = await importApi.uploadExcel(file);
      setResult(res);
      if (res.imported > 0) {
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOrdersSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRecentOrdersQueryKey() });
      }
    } catch (e: any) {
      setError(e.message || "فشل استيراد الملف.");
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const downloadTemplate = () => {
    const rows = [
      "اسم العميل,رقم الهاتف,العنوان,المنتج,الكمية,سعر الوحدة,ملاحظات",
      "أحمد محمد,0501234567,الرياض - حي النزهة,كريم الجسم,2,149.99,توصيل سريع",
    ].join("\n");
    const blob = new Blob(["\uFEFF" + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "CAPRINA_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold">استيراد الطلبات</h1>
        <p className="text-muted-foreground text-sm mt-0.5">ارفع ملف Excel لإضافة طلبات متعددة دفعة واحدة</p>
      </div>

      {/* Template download */}
      <Card className="border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Info className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold">تحميل نموذج Excel</p>
            <p className="text-xs text-muted-foreground mt-0.5">حمّل النموذج الجاهز واملأه بالطلبات، ثم ارفعه هنا.</p>
          </div>
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 border-border h-8 text-xs shrink-0">
            <Download className="w-3.5 h-3.5" />تحميل النموذج
          </Button>
        </div>
      </Card>

      {/* Column guide */}
      <Card className="border-border bg-card p-4">
        <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">أعمدة الملف المطلوبة</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { col: "اسم العميل", req: true, note: "مطلوب" },
            { col: "المنتج", req: true, note: "مطلوب" },
            { col: "الكمية", req: true, note: "مطلوب — رقم صحيح" },
            { col: "سعر الوحدة", req: true, note: "مطلوب — رقم" },
            { col: "رقم الهاتف", req: false, note: "اختياري" },
            { col: "العنوان", req: false, note: "اختياري" },
            { col: "ملاحظات", req: false, note: "اختياري" },
          ].map(({ col, req, note }) => (
            <div key={col} className="flex items-center gap-2 text-xs">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${req ? "bg-primary" : "bg-muted-foreground"}`}></span>
              <span className="font-mono font-bold">{col}</span>
              <span className="text-muted-foreground">— {note}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all ${isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-muted/10"} ${isUploading ? "pointer-events-none opacity-70" : ""}`}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
        {isUploading ? (
          <div className="space-y-3">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-bold text-primary">جاري الاستيراد...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto">
              {isDragging ? <FileSpreadsheet className="w-7 h-7 text-primary" /> : <Upload className="w-7 h-7 text-muted-foreground" />}
            </div>
            <div>
              <p className="font-bold text-sm">{isDragging ? "أفلت الملف هنا" : "اسحب الملف هنا أو انقر للاختيار"}</p>
              <p className="text-xs text-muted-foreground mt-1">يدعم: .xlsx, .xls, .csv</p>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <Card className="border-red-800 bg-red-900/20 p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card className={`border p-5 ${result.imported > 0 ? "border-emerald-800 bg-emerald-900/10" : "border-amber-800 bg-amber-900/10"}`}>
          <div className="flex items-start gap-3 mb-4">
            <CheckCircle2 className={`w-6 h-6 shrink-0 mt-0.5 ${result.imported > 0 ? "text-emerald-400" : "text-amber-400"}`} />
            <div>
              <p className="font-bold text-base">نتيجة الاستيراد</p>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="text-emerald-400 font-bold">✓ تم استيراد: {result.imported} طلب</span>
                {result.failed > 0 && <span className="text-red-400 font-bold">✗ فشل: {result.failed} صف</span>}
              </div>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-3 p-3 bg-background/50 rounded border border-border">
              <p className="text-xs font-bold text-muted-foreground mb-2">تفاصيل الأخطاء:</p>
              <ul className="space-y-1">
                {result.errors.map((err, i) => (
                  <li key={i} className="text-xs text-red-400 flex items-start gap-2">
                    <span className="shrink-0">•</span>{err}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.imported > 0 && (
            <div className="mt-4">
              <a href="/orders" className="text-xs text-primary hover:underline font-semibold">← عرض الطلبات المستوردة</a>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
