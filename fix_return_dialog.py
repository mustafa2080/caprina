filepath = r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\caprina\src\pages\order-detail.tsx'
with open(filepath, encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")

# Normal section Return Card: lines 2461-2583 (1-indexed), 0-indexed: 2460-2582
print("Line 2461:", repr(lines[2460][:80]))
print("Line 2583:", repr(lines[2582][:80]))
print("Line 2584:", repr(lines[2583][:80]))

dialog_open = (
    '      {/* Return reason input \u2014 Dialog */}\n'
    '      <Dialog open={showReturnInput} onOpenChange={(v) => { if (!v) { setShowReturnInput(false); setReturnReason(""); setReturnNote(""); setReturnIsDamaged(false); setReturnReceived(null); setSelectDisplayStatus(null); } }}>\n'
    '        <DialogContent className="max-w-md overflow-y-auto max-h-[90vh]" dir="rtl">\n'
    '          <DialogHeader>\n'
    '            <DialogTitle className="flex items-center gap-2 text-sm text-red-400">\n'
    '              <RotateCcw className="w-4 h-4" />\u062a\u0633\u062c\u064a\u0644 \u0645\u0631\u062a\u062c\u0639\n'
    '            </DialogTitle>\n'
    '          </DialogHeader>\n'
    '          <div className="space-y-3">\n'
)

inner = ''.join(lines[2468:2580])

dialog_close = (
    '          </div>\n'
    '        </DialogContent>\n'
    '      </Dialog>\n'
)

new_block = dialog_open + inner + dialog_close

new_lines = lines[:2460] + [new_block] + lines[2583:]
with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"Done! New total lines: {len(new_lines)}")
