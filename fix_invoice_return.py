import os, sys
sys.stdout.reconfigure(encoding='utf-8')

base = r'C:\Users\musta\Desktop\pro'
d = os.listdir(base)[0]
for root, dirs, files in os.walk(os.path.join(base, d)):
    dirs[:] = [dd for dd in dirs if dd not in ['node_modules', '.git']]
    for f in files:
        if f == 'invoice-group.tsx':
            path = os.path.join(root, f)

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add RETURN_REASONS to import
old_import = "import { STATUS_LABELS as statusLabels, STATUS_CLASSES as statusClasses } from \"@/lib/order-constants\";"
new_import = "import { STATUS_LABELS as statusLabels, STATUS_CLASSES as statusClasses, RETURN_REASONS } from \"@/lib/order-constants\";"
if old_import in content:
    content = content.replace(old_import, new_import, 1)
    print("✅ Fixed import")
else:
    print("❌ import not found")

# 2. Add state vars after pendingStatus line
old_state = "  const [pendingStatus, setPendingStatus]               = useState<string | null>(null);"
new_state = (
    "  const [pendingStatus, setPendingStatus]               = useState<string | null>(null);\n"
    "  const [returnReason, setReturnReason]                 = useState<string>(\"\");\n"
    "  const [returnNote, setReturnNote]                     = useState<string>(\"\");\n"
    "  const [showReturnDialog, setShowReturnDialog]         = useState(false);"
)
if old_state in content:
    content = content.replace(old_state, new_state, 1)
    print("✅ Added state vars")
else:
    print("❌ state line not found")

# 3. Change Select onValueChange to show return dialog when returned
old_select = 'onValueChange={(v) => { if (v) setPendingStatus(v); }}'
new_select = 'onValueChange={(v) => { if (!v) return; if (v === "returned") { setShowReturnDialog(true); } else { setPendingStatus(v); } }}'
if old_select in content:
    content = content.replace(old_select, new_select, 1)
    print("✅ Fixed Select onValueChange")
else:
    print("❌ select onValueChange not found")

# 4. Update handleBulkStatusChange to accept optional reason/note
old_fn = "  const handleBulkStatusChange = async (newStatus: string) => {"
new_fn = "  const handleBulkStatusChange = async (newStatus: string, reason?: string, note?: string) => {"
if old_fn in content:
    content = content.replace(old_fn, new_fn, 1)
    print("✅ Updated function signature")
else:
    print("❌ function signature not found")

# 5. Update the mutate call to include returnReason/returnNote
old_mutate = "            { id: order.id, data: { status: newStatus as any } },"
new_mutate = "            { id: order.id, data: { status: newStatus as any, ...(reason ? { returnReason: reason, returnNote: reason === 'other' ? (note ?? null) : null } : {}) } as any },"
if old_mutate in content:
    content = content.replace(old_mutate, new_mutate, 1)
    print("✅ Updated mutate data")
else:
    print("❌ mutate data not found")

# 6. Replace the "Status change confirm" AlertDialog with return-aware version
old_dialog = """      {/* Status change confirm */}
      <AlertDialog open={!!pendingStatus} onOpenChange={open => { if (!open) setPendingStatus(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد تغيير الحالة</AlertDialogTitle>
            <AlertDialogDescription>
              هتغير حالة {orders.length} طلب إلى «{statusLabels[pendingStatus ?? ""] ?? pendingStatus}». هل أنت متأكد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingStatus && handleBulkStatusChange(pendingStatus)} disabled={isUpdatingStatus}>
              {isUpdatingStatus ? "جاري التحديث..." : "تأكيد"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>"""

new_dialog = """      {/* Status change confirm */}
      <AlertDialog open={!!pendingStatus} onOpenChange={open => { if (!open) setPendingStatus(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد تغيير الحالة</AlertDialogTitle>
            <AlertDialogDescription>
              هتغير حالة {orders.length} طلب إلى «{statusLabels[pendingStatus ?? ""] ?? pendingStatus}». هل أنت متأكد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingStatus && handleBulkStatusChange(pendingStatus)} disabled={isUpdatingStatus}>
              {isUpdatingStatus ? "جاري التحديث..." : "تأكيد"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Return reason dialog */}
      <AlertDialog open={showReturnDialog} onOpenChange={open => { if (!open) { setShowReturnDialog(false); setReturnReason(""); setReturnNote(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-400">
              <RotateCcw className="w-4 h-4" /> تسجيل مرتجع — ما سبب الإرجاع؟
            </AlertDialogTitle>
            <AlertDialogDescription>
              سيتم تحويل {orders.length} منتج إلى «مرتجع».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">سبب الإرجاع *</Label>
              <Select value={returnReason} onValueChange={setReturnReason}>
                <SelectTrigger className="h-9 text-sm bg-card border-red-800 focus:ring-red-700">
                  <SelectValue placeholder="اختر السبب..." />
                </SelectTrigger>
                <SelectContent>
                  {RETURN_REASONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {returnReason === "other" && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">اكتب السبب *</Label>
                <Textarea
                  placeholder="اكتب سبب الإرجاع بالتفصيل..."
                  className="min-h-[70px] text-sm resize-none bg-card border-red-800 focus:ring-red-700"
                  value={returnNote}
                  onChange={e => setReturnNote(e.target.value)}
                />
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setReturnReason(""); setReturnNote(""); }}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-700 hover:bg-red-600 text-white"
              disabled={!returnReason || (returnReason === "other" && !returnNote.trim()) || isUpdatingStatus}
              onClick={() => {
                if (!returnReason) return;
                setShowReturnDialog(false);
                handleBulkStatusChange("returned", returnReason, returnNote);
                setReturnReason("");
                setReturnNote("");
              }}
            >
              {isUpdatingStatus ? "جاري التحديث..." : "تأكيد الإرجاع"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>"""

if old_dialog in content:
    content = content.replace(old_dialog, new_dialog, 1)
    print("✅ Added return dialog")
else:
    print("❌ dialog not found — trying stripped whitespace match")
    # show what's around that area
    idx = content.find("Status change confirm")
    print(content[idx:idx+500])

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("\nAll done!")
