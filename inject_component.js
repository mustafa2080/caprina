const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const tsxFile = path.join(projectRoot, 'artifacts', 'caprina', 'src', 'pages', 'shipping-manifest.tsx');

const componentCode = `
// ─── Excel Import Dialog ─────────────────────────────────────────────────────
type ExcelRow = {
  orderId?: number;
  customerName?: string;
  deliveryStatus?: string;
  deliveryNote?: string;
  partialQuantity?: number;
};

const STATUS_MAP: Record<string, string> = {
  "مسلم": "delivered", "مسلَّم": "delivered", "مسلم ✓": "delivered", "delivered": "delivered", "تسليم": "delivered", "تم التسليم": "delivered",
  "مرتجع": "returned", "returned": "returned", "ارجاع": "returned", "إرجاع": "returned", "رجع": "returned",
  "مؤجل": "postponed", "postponed": "postponed", "تأجيل": "postponed", "مؤجله": "postponed",
  "جزئي": "partial_received", "partial": "partial_received", "partial_received": "partial_received", "استلم جزئي": "partial_received", "جزء": "partial_received",
  "انتظار": "pending", "pending": "pending", "قيد الانتظار": "pending", "في الانتظار": "pending",
};

function normalizeStatus(val: string): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  const lower = trimmed.toLowerCase();
  for (const [key, mapped] of Object.entries(STATUS_MAP)) {
    if (lower === key.toLowerCase()) return mapped;
  }
  return null;
}

function ExcelImportDialog({
  manifest,
  onClose,
  onImported,
}: {
  manifest: ShippingManifestDetail;
  onClose: () => void;
  onImported: () => void;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErrors([]);
    setRows([]);

    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

      if (raw.length < 2) {
        setErrors(["الملف فارغ أو لا يحتوي على بيانات"]);
        return;
      }

      const header = raw[0].map((h: any) => String(h).trim().toLowerCase());
      const colIdx = {
        id: header.findIndex((h: string) => h.includes("رقم") || h.includes("id") || h === "#" || h.includes("order")),
        name: header.findIndex((h: string) => h.includes("عميل") || h.includes("اسم") || h.includes("name") || h.includes("customer")),
        status: header.findIndex((h: string) => h.includes("حال") || h.includes("status") || h.includes("تسليم") || h.includes("delivery")),
        note: header.findIndex((h: string) => h.includes("ملاحظ") || h.includes("note") || h.includes("سبب")),
        partial: header.findIndex((h: string) => h.includes("كمية") || h.includes("جزئي") || h.includes("partial") || h.includes("qty")),
      };

      if (colIdx.status === -1) {
        setErrors(["لم يتم العثور على عمود 'حالة التسليم' — تأكد من عناوين الأعمدة\\nالأعمدة الموجودة: " + raw[0].join(" | ")]);
        return;
      }

      const parsed: ExcelRow[] = [];
      const errs: string[] = [];

      for (let i = 1; i < raw.length; i++) {
        const row = raw[i];
        if (row.every((cell: any) => cell === "" || cell === null || cell === undefined)) continue;

        const idVal = colIdx.id >= 0 ? parseInt(String(row[colIdx.id])) : NaN;
        const nameVal = colIdx.name >= 0 ? String(row[colIdx.name]).trim() : "";
        const statusVal = colIdx.status >= 0 ? String(row[colIdx.status]).trim() : "";
        const noteVal = colIdx.note >= 0 ? String(row[colIdx.note]).trim() : "";
        const partialVal = colIdx.partial >= 0 ? parseInt(String(row[colIdx.partial])) : NaN;

        const mappedStatus = normalizeStatus(statusVal);
        if (!mappedStatus) {
          errs.push(\`سطر \${i + 1}: حالة غير معروفة "\${statusVal}"\`);
          continue;
        }

        let orderId: number | undefined;
        if (!isNaN(idVal)) {
          const found = manifest.orders.find(o => o.id === idVal);
          if (found) orderId = found.id;
        }
        if (!orderId && nameVal) {
          const found = manifest.orders.find(o =>
            o.customerName.toLowerCase().includes(nameVal.toLowerCase()) ||
            nameVal.toLowerCase().includes(o.customerName.toLowerCase())
          );
          if (found) orderId = found.id;
        }

        if (!orderId) {
          errs.push(\`سطر \${i + 1}: لم يتم العثور على الطلبية (ID: \${isNaN(idVal) ? "—" : idVal}, العميل: \${nameVal || "—"})\`);
          continue;
        }

        parsed.push({
          orderId,
          customerName: manifest.orders.find(o => o.id === orderId)?.customerName,
          deliveryStatus: mappedStatus,
          deliveryNote: noteVal || undefined,
          partialQuantity: !isNaN(partialVal) && partialVal > 0 ? partialVal : undefined,
        });
      }

      setRows(parsed);
      if (errs.length > 0) setErrors(errs);
    } catch (err: any) {
      setErrors([\`خطأ في قراءة الملف: \${err.message}\`]);
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    let success = 0;
    let fail = 0;
    for (const row of rows) {
      if (!row.orderId || !row.deliveryStatus) continue;
      try {
        await manifestsApi.updateOrderDelivery(manifest.id, row.orderId, {
          deliveryStatus: row.deliveryStatus as DeliveryStatus,
          deliveryNote: row.deliveryNote ?? null,
          partialQuantity: row.partialQuantity ?? null,
        });
        success++;
      } catch { fail++; }
    }
    setImporting(false);
    toast({
      title: \`✅ اكتمل الاستيراد\`,
      description: \`تم تحديث \${success} طلبية\${fail > 0 ? \` — فشل \${fail}\` : ""}\`,
    });
    onImported();
    onClose();
  };

  const slabel = (s: string) => {
    const m: Record<string, { label: string; color: string }> = {
      delivered: { label: "مسلَّم ✓", color: "text-emerald-600" },
      returned: { label: "مرتجع", color: "text-red-500" },
      postponed: { label: "مؤجل", color: "text-orange-500" },
      partial_received: { label: "جزئي", color: "text-teal-500" },
      pending: { label: "انتظار", color: "text-muted-foreground" },
    };
    return m[s] ?? { label: s, color: "" };
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            استيراد حالات التسليم من Excel
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 mt-2">
          <div className="bg-muted/30 border border-border rounded-md p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground mb-1.5">📋 تعليمات الاستيراد:</p>
            <p>• الملف يجب أن يحتوي على عمود <strong className="text-foreground">حالة التسليم</strong> أو Status</p>
            <p>• يُفضَّل وجود عمود <strong className="text-foreground">رقم الطلبية</strong> (ID) أو <strong className="text-foreground">اسم العميل</strong></p>
            <p>• الحالات المقبولة: <span className="text-emerald-600">مسلَّم</span> · <span className="text-red-500">مرتجع</span> · <span className="text-orange-500">مؤجل</span> · <span className="text-teal-500">جزئي</span> · انتظار</p>
          </div>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
            <span className="text-sm font-medium text-foreground">
              {fileName ? fileName : "اضغط لاختيار ملف Excel"}
            </span>
            <span className="text-xs text-muted-foreground mt-1">.xlsx · .xls</span>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          </label>

          {errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 max-h-28 overflow-y-auto">
              <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-1">تحذيرات ({errors.length}):</p>
              {errors.map((e, i) => (
                <p key={i} className="text-[10px] text-red-600 dark:text-red-400">{e}</p>
              ))}
            </div>
          )}

          {rows.length > 0 && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <p className="text-xs font-bold text-foreground mb-2">
                معاينة — {rows.length} طلبية جاهزة للتحديث:
              </p>
              <div className="overflow-y-auto flex-1 border border-border rounded-md">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-right p-2 font-semibold text-muted-foreground">رقم الطلبية</th>
                      <th className="text-right p-2 font-semibold text-muted-foreground">العميل</th>
                      <th className="text-right p-2 font-semibold text-muted-foreground">الحالة الجديدة</th>
                      <th className="text-right p-2 font-semibold text-muted-foreground">ملاحظة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const sl = slabel(row.deliveryStatus ?? "");
                      return (
                        <tr key={i} className="border-b border-border/50 hover:bg-muted/10">
                          <td className="p-2 font-mono text-muted-foreground">#{String(row.orderId).padStart(4, "0")}</td>
                          <td className="p-2 font-medium">{row.customerName}</td>
                          <td className={\`p-2 font-bold \${sl.color}\`}>{sl.label}</td>
                          <td className="p-2 text-muted-foreground">{row.deliveryNote || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 mt-3">
          <Button
            className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white gap-1.5"
            onClick={handleImport}
            disabled={importing || rows.length === 0}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {importing ? "جاري الاستيراد..." : \`استيراد\${rows.length > 0 ? \` (\${rows.length} طلبية)\` : ""}\`}
          </Button>
          <Button variant="outline" className="border-border" onClick={onClose}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
`;

let content = fs.readFileSync(tsxFile, 'utf8');

// Add Upload to imports
if (!content.includes('Upload,')) {
  content = content.replace('  FileSpreadsheet,\n} from "lucide-react";', '  FileSpreadsheet,\n  Upload,\n} from "lucide-react";');
  console.log('Added Upload import');
}

// Add ExcelImportDialog component before export default
const marker = 'export default function ShippingManifestPage()';
if (!content.includes('ExcelImportDialog')) {
  content = content.replace(marker, componentCode + '\n' + marker);
  console.log('Added ExcelImportDialog component');
} else {
  console.log('ExcelImportDialog already exists');
}

fs.writeFileSync(tsxFile, content, 'utf8');
console.log('Done. File size:', content.length);
