import sys
sys.stdout.reconfigure(encoding='utf-8')

filepath = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\shipping-manifest.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_section = '''      {/* ─── Reopen Confirm Dialog — أدمن فقط ─── */}
      <AlertDialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>'''

new_section = '''      {/* ─── Rollover Dialog — بيان جديد اتنشأ ─── */}
      {showRolloverDialog && (
        <AlertDialog open onOpenChange={() => setShowRolloverDialog(null)}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-emerald-500">
                <CheckCircle2 className="w-5 h-5" />
                تم إغلاق البيان وإنشاء بيان جديد
              </AlertDialogTitle>
              <AlertDialogDescription className="text-right space-y-3">
                <span className="block text-foreground font-medium text-sm">
                  تم إنشاء البيان <strong className="text-emerald-400">{showRolloverDialog.manifestNumber}</strong> تلقائياً
                </span>
                <span className="block text-muted-foreground text-xs">
                  يحتوي على <strong>{showRolloverDialog.orderCount}</strong> طلبية مرحَّلة{showRolloverDialog.breakdown && <span className="text-amber-400"> {showRolloverDialog.breakdown}</span>}
                </span>
                <span className="block text-xs text-muted-foreground">
                  هل تريد الانتقال للبيان الجديد الآن؟
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowRolloverDialog(null)}>لاحقاً</AlertDialogCancel>
              <AlertDialogAction
                className="bg-emerald-700 hover:bg-emerald-600 text-white gap-1"
                onClick={() => { window.location.href = `/shipping/manifests/${showRolloverDialog.id}`; }}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                انتقل للبيان الجديد
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* ─── Reopen Confirm Dialog — أدمن فقط ─── */}
      <AlertDialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>'''

if old_section in content:
    content = content.replace(old_section, new_section, 1)
    print('Rollover dialog added OK')
else:
    print('Section NOT found')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
