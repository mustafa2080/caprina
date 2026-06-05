# -*- coding: utf-8 -*-
"""
Fix order-detail.tsx - Clean rewrite
1. Add icons to SelectItem (invoice + normal mode)
2. Partial Card -> Dialog (invoice + normal)
3. Return Card -> Dialog (invoice + normal)
"""
import sys, re
sys.stdout.reconfigure(encoding='utf-8')

FILE = r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\caprina\src\pages\order-detail.tsx'

with open(FILE, encoding='utf-8') as f:
    content = f.read()

original_size = len(content)
changes = []

# ── CHECK STATE ──────────────────────────────────────────────────────────────
print("File size:", original_size)
print("Clock icon present:", 'Clock className' in content)
print("Partial Card present:", 'showPartialInput && (' in content)
print("Return Card present:", 'showReturnInput && (' in content)
print()

# ── FIX 1: Select icons ──────────────────────────────────────────────────────
# Only if not already done
if 'Clock className' not in content:
    # Replace both occurrences (invoice + normal differ only in indentation)
    content = content.replace(
        '<SelectItem value="pending">\u0642\u064a\u062f \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631</SelectItem>',
        '<SelectItem value="pending"><span className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-yellow-400" />\u0642\u064a\u062f \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631</span></SelectItem>'
    )
    content = content.replace(
        '<SelectItem value="warehouse_ready">\u0642\u064a\u062f \u0627\u0644\u0634\u062d\u0646 \u0641\u064a \u0627\u0644\u0645\u062e\u0632\u0646</SelectItem>',
        '<SelectItem value="warehouse_ready"><span className="flex items-center gap-1.5"><Warehouse className="w-3 h-3 text-blue-400" />\u0642\u064a\u062f \u0627\u0644\u0634\u062d\u0646 \u0641\u064a \u0627\u0644\u0645\u062e\u0632\u0646</span></SelectItem>'
    )
    content = content.replace(
        '<SelectItem value="in_shipping">\u0642\u064a\u062f \u0627\u0644\u0634\u062d\u0646</SelectItem>',
        '<SelectItem value="in_shipping"><span className="flex items-center gap-1.5"><Truck className="w-3 h-3 text-purple-400" />\u0642\u064a\u062f \u0627\u0644\u0634\u062d\u0646</span></SelectItem>'
    )
    content = content.replace(
        '<SelectItem value="received">\u0627\u0633\u062a\u0644\u0645 \u2713</SelectItem>',
        '<SelectItem value="received"><span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-400" />\u0627\u0633\u062a\u0644\u0645 \u2713</span></SelectItem>'
    )
    content = content.replace(
        '<SelectItem value="delayed">\u0645\u0624\u062c\u0644</SelectItem>',
        '<SelectItem value="delayed"><span className="flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-orange-400" />\u0645\u0624\u062c\u0644</span></SelectItem>'
    )
    content = content.replace(
        '<SelectItem value="returned">\u0645\u0631\u062a\u062c\u0639</SelectItem>',
        '<SelectItem value="returned"><span className="flex items-center gap-1.5"><RotateCcw className="w-3 h-3 text-red-400" />\u0645\u0631\u062a\u062c\u0639</span></SelectItem>'
    )
    content = content.replace(
        '<SelectItem value="partial_received">\u0627\u0633\u062a\u0644\u0645 \u062c\u0632\u0626\u064a</SelectItem>',
        '<SelectItem value="partial_received"><span className="flex items-center gap-1.5"><Package className="w-3 h-3 text-violet-400" />\u0627\u0633\u062a\u0644\u0645 \u062c\u0632\u0626\u064a</span></SelectItem>'
    )
    changes.append("Select icons added")
    print("+ Select icons added")
else:
    print("- Select icons already present, skipping")

print("Select icons done. New size:", len(content))

# ── FIX 2: Partial Card -> Dialog ───────────────────────────────────────────
# Invoice mode
OLD_PARTIAL_INV = """{showPartialInput && (
            <Card className="border-purple-800 bg-purple-900/20">
              <CardContent className="p-4">
                <p className="text-sm font-bold text-purple-400 mb-3">\u0627\u0633\u062a\u0644\u0627\u0645 \u062c\u0632\u0626\u064a \u2014 \u0643\u0645 \u0648\u062d\u062f\u0629 \u0627\u0633\u062a\u0644\u0645\u062a\u061f</p>
                <div className="flex items-center gap-3">
                  <Input type="number" min="1" placeholder="\u0627\u0644\u0643\u0645\u064a\u0629" value={partialQty} onChange={e => setPartialQty(e.target.value)} className="h-8 text-sm w-40 bg-card" />
                  <Button size="sm" className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white" onClick={handlePartialReceived} disabled={updateOrder.isPending}>\u062a\u0623\u0643\u064a\u062f</Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setShowPartialInput(false); setPartialQty(""); setSelectDisplayStatus(null); }}>\u0625\u0644\u063a\u0627\u0621</Button>
                </div>
              </CardContent>
            </Card>
          )}"""

NEW_PARTIAL_INV = """<Dialog open={showPartialInput} onOpenChange={(open) => { if (!open) { setShowPartialInput(false); setPartialQty(""); setSelectDisplayStatus(null); } }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-purple-400">
                  <Package className="w-4 h-4" />\u0627\u0633\u062a\u0644\u0627\u0645 \u062c\u0632\u0626\u064a
                </DialogTitle>
                <DialogDescription>\u062d\u062f\u062f \u0639\u062f\u062f \u0627\u0644\u0648\u062d\u062f\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u0644\u0645\u0629</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-3 py-2">
                <Input type="number" min="1" placeholder="\u0627\u0644\u0643\u0645\u064a\u0629" value={partialQty} onChange={e => setPartialQty(e.target.value)} className="h-9 text-sm bg-card" />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => { setShowPartialInput(false); setPartialQty(""); setSelectDisplayStatus(null); }}>\u0625\u0644\u063a\u0627\u0621</Button>
                <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handlePartialReceived} disabled={updateOrder.isPending}>\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>"""

if OLD_PARTIAL_INV in content:
    content = content.replace(OLD_PARTIAL_INV, NEW_PARTIAL_INV, 1)
    changes.append("Partial invoice Card -> Dialog")
    print("+ Partial invoice dialog")
else:
    print("- Partial invoice block not found (may already be dialog)")

# Normal mode
OLD_PARTIAL_NORM = """{showPartialInput && (
        <Card className="border-purple-800 bg-purple-900/20">
          <CardContent className="p-4">
            <p className="text-sm font-bold text-purple-400 mb-3">\u0627\u0633\u062a\u0644\u0627\u0645 \u062c\u0632\u0626\u064a \u2014 \u0643\u0645 \u0648\u062d\u062f\u0629 \u0627\u0633\u062a\u0644\u0645\u062a\u061f</p>
            <div className="flex items-center gap-3">
              <Input type="number" min="1" max={order.quantity} placeholder={`\u0627\u0644\u062d\u062f \u0627\u0644\u0623\u0642\u0635\u0649: ${order.quantity}`} value={partialQty} onChange={e => setPartialQty(e.target.value)} className="h-8 text-sm w-40 bg-card" />
              <Button size="sm" className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white" onClick={handlePartialReceived} disabled={updateOrder.isPending}>\u062a\u0623\u0643\u064a\u062f</Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setShowPartialInput(false); setPartialQty(""); setSelectDisplayStatus(null); }}>\u0625\u0644\u063a\u0627\u0621</Button>
            </div>
          </CardContent>
        </Card>
      )}"""

NEW_PARTIAL_NORM = """<Dialog open={showPartialInput} onOpenChange={(open) => { if (!open) { setShowPartialInput(false); setPartialQty(""); setSelectDisplayStatus(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-400">
              <Package className="w-4 h-4" />\u0627\u0633\u062a\u0644\u0627\u0645 \u062c\u0632\u0626\u064a
            </DialogTitle>
            <DialogDescription>\u062d\u062f\u062f \u0639\u062f\u062f \u0627\u0644\u0648\u062d\u062f\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u0644\u0645\u0629 (\u0627\u0644\u062d\u062f \u0627\u0644\u0623\u0642\u0635\u0649: {order.quantity})</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 py-2">
            <Input type="number" min="1" max={order.quantity} placeholder={`\u0627\u0644\u062d\u062f \u0627\u0644\u0623\u0642\u0635\u0649: ${order.quantity}`} value={partialQty} onChange={e => setPartialQty(e.target.value)} className="h-9 text-sm bg-card" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowPartialInput(false); setPartialQty(""); setSelectDisplayStatus(null); }}>\u0625\u0644\u063a\u0627\u0621</Button>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handlePartialReceived} disabled={updateOrder.isPending}>\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>"""

if OLD_PARTIAL_NORM in content:
    content = content.replace(OLD_PARTIAL_NORM, NEW_PARTIAL_NORM, 1)
    changes.append("Partial normal Card -> Dialog")
    print("+ Partial normal dialog")
else:
    print("- Partial normal block not found (may already be dialog)")

print("Partial done. Size:", len(content))

# ── FIX 3: Return Card -> Dialog (line-based) ───────────────────────────────
# Use regex to find and replace the showReturnInput blocks

def make_return_dialog(indent):
    i = indent
    return (
        i + '<Dialog open={showReturnInput} onOpenChange={(open) => { if (!open) { setShowReturnInput(false); setReturnReason(""); setReturnNote(""); setReturnIsDamaged(false); setReturnReceived(null); setSelectDisplayStatus(null); } }}>\n' +
        i + '  <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">\n' +
        i + '    <DialogHeader>\n' +
        i + '      <DialogTitle className="flex items-center gap-2 text-red-400">\n' +
        i + '        <RotateCcw className="w-4 h-4" />\u062a\u0633\u062c\u064a\u0644 \u0645\u0631\u062a\u062c\u0639\n' +
        i + '      </DialogTitle>\n' +
        i + '      <DialogDescription>\u0645\u0627 \u0633\u0628\u0628 \u0627\u0644\u0625\u0631\u062c\u0627\u0639\u061f</DialogDescription>\n' +
        i + '    </DialogHeader>\n' +
        i + '    <div className="space-y-3 py-2">\n' +
        i + '      <div className="space-y-1">\n' +
        i + '        <Label className="text-xs text-muted-foreground">\u0633\u0628\u0628 \u0627\u0644\u0625\u0631\u062c\u0627\u0639 *</Label>\n' +
        i + '        <Select value={returnReason} onValueChange={setReturnReason}>\n' +
        i + '          <SelectTrigger className="h-9 text-sm bg-card border-red-800 focus:ring-red-700">\n' +
        i + '            <SelectValue placeholder="\u0627\u062e\u062a\u0631 \u0627\u0644\u0633\u0628\u0628..." />\n' +
        i + '          </SelectTrigger>\n' +
        i + '          <SelectContent>\n' +
        i + '            {RETURN_REASONS.map(r => (\n' +
        i + '              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>\n' +
        i + '            ))}\n' +
        i + '          </SelectContent>\n' +
        i + '        </Select>\n' +
        i + '      </div>\n' +
        i + '      {returnReason === "other" && (\n' +
        i + '        <div className="space-y-1">\n' +
        i + '          <Label className="text-xs text-muted-foreground">\u0627\u0643\u062a\u0628 \u0627\u0644\u0633\u0628\u0628 *</Label>\n' +
        i + '          <Textarea\n' +
        i + '            placeholder="\u0627\u0643\u062a\u0628 \u0633\u0628\u0628 \u0627\u0644\u0625\u0631\u062c\u0627\u0639 \u0628\u0627\u0644\u062a\u0641\u0635\u064a\u0644..."\n' +
        i + '            className="min-h-[70px] text-sm resize-none bg-card border-red-800 focus:ring-red-700"\n' +
        i + '            value={returnNote}\n' +
        i + '            onChange={e => setReturnNote(e.target.value)}\n' +
        i + '          />\n' +
        i + '        </div>\n' +
        i + '      )}\n' +
        i + '      {manifestStatus?.manifestStatus === "open" && (\n' +
        i + '      <div className="space-y-2">\n' +
        i + '        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">\u0647\u0644 \u062a\u0645 \u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u0645\u0631\u062a\u062c\u0639\u061f *</p>\n' +
        i + '        <div className="flex gap-2.5">\n' +
        i + '          <button type="button" onClick={() => setReturnReceived(true)}\n' +
        i + '            className="flex-1 relative outline-none cursor-pointer p-0 border-0 bg-transparent"\n' +
        i + '            style={{ borderRadius: 14 }}>\n' +
        i + '            <div className="absolute inset-0 top-1 rounded-[14px] transition-colors" style={{ background: returnReceived === true ? "#085041" : "var(--color-background-secondary)", border: returnReceived === true ? "none" : "1.5px solid #9FE1CB" }} />\n' +
        i + '            <div className={`relative z-10 flex flex-col items-center gap-1.5 px-3 pt-3 pb-4 rounded-[14px] transition-all ${returnReceived === true ? "mb-1" : "mb-0"}`} style={{ background: returnReceived === true ? "#0F6E56" : "var(--color-background-primary)", border: returnReceived === true ? "none" : "1.5px solid #9FE1CB", boxShadow: returnReceived === true ? "inset 0 0 0 2px rgba(159,225,203,0.4)" : "none", transform: returnReceived === true ? "translateY(2px)" : "none" }}>\n' +
        i + '              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={returnReceived === true ? "#E1F5EE" : "#1D9E75"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7L9 18l-5-5"/></svg>\n' +
        i + '              <span className="text-[11px] font-semibold leading-tight" style={{ color: returnReceived === true ? "#E1F5EE" : "#0F6E56" }}>\u062a\u0645 \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645</span>\n' +
        i + '              <span className="text-[9px] leading-tight" style={{ color: returnReceived === true ? "rgba(225,245,238,0.7)" : "#5F5E5A" }}>\u064a\u064f\u0639\u0627\u062f \u0644\u0644\u0645\u062e\u0632\u0646</span>\n' +
        i + '            </div>\n' +
        i + '          </button>\n' +
        i + '          <button type="button" onClick={() => setReturnReceived(false)}\n' +
        i + '            className="flex-1 relative outline-none cursor-pointer p-0 border-0 bg-transparent"\n' +
        i + '            style={{ borderRadius: 14 }}>\n' +
        i + '            <div className="absolute inset-0 top-1 rounded-[14px] transition-colors" style={{ background: returnReceived === false ? "#412402" : "var(--color-background-secondary)", border: returnReceived === false ? "none" : "1.5px solid #FAC775" }} />\n' +
        i + '            <div className={`relative z-10 flex flex-col items-center gap-1.5 px-3 pt-3 pb-4 rounded-[14px] transition-all ${returnReceived === false ? "mb-1" : "mb-0"}`} style={{ background: returnReceived === false ? "#854F0B" : "var(--color-background-primary)", border: returnReceived === false ? "none" : "1.5px solid #FAC775", boxShadow: returnReceived === false ? "inset 0 0 0 2px rgba(250,199,117,0.4)" : "none", transform: returnReceived === false ? "translateY(2px)" : "none" }}>\n' +
        i + '              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={returnReceived === false ? "#FAEEDA" : "#BA7517"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>\n' +
        i + '              <span className="text-[11px] font-semibold leading-tight" style={{ color: returnReceived === false ? "#FAEEDA" : "#854F0B" }}>\u0645\u0627\u0632\u0627\u0644 \u0641\u064a \u0627\u0644\u0634\u062d\u0646</span>\n' +
        i + '              <span className="text-[9px] leading-tight" style={{ color: returnReceived === false ? "rgba(250,238,218,0.7)" : "#5F5E5A" }}>\u0644\u0627 \u064a\u0624\u062b\u0631 \u0639\u0644\u0649 \u0627\u0644\u0645\u062e\u0632\u0646</span>\n' +
        i + '            </div>\n' +
        i + '          </button>\n' +
        i + '        </div>\n' +
        i + '        <p className="text-[10px] text-center font-medium" style={{ color: returnReceived === true ? "#0F6E56" : returnReceived === false ? "#854F0B" : "var(--color-text-secondary)" }}>\n' +
        i + '          {returnReceived === true && "\u2713 \u0633\u064a\u062a\u0645 \u0625\u0631\u062c\u0627\u0639 \u0627\u0644\u0628\u0636\u0627\u0639\u0629 \u0644\u0644\u0645\u062e\u0632\u0646 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b"}\n' +
        i + '          {returnReceived === false && "\u23f3 \u0645\u0631\u062a\u062c\u0639 \u0645\u0627\u0632\u0627\u0644 \u0641\u064a \u0634\u0631\u0643\u0629 \u0627\u0644\u0634\u062d\u0646 \u2014 \u0644\u0646 \u064a\u0624\u062b\u0631 \u0639\u0644\u0649 \u0627\u0644\u0645\u062e\u0632\u0646"}\n' +
        i + '          {returnReceived === null && "\u26a0 \u0645\u0637\u0644\u0648\u0628 \u2014 \u062d\u062f\u062f \u062d\u0627\u0644\u0629 \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645"}\n' +
        i + '        </p>\n' +
        i + '      </div>\n' +
        i + '      )}\n' +
        i + '      <div\n' +
        i + '        className={`flex items-center gap-3 p-2.5 rounded border cursor-pointer transition-colors ${returnIsDamaged ? "border-amber-700 bg-amber-900/20" : "border-border bg-card/50"}`}\n' +
        i + '        onClick={() => setReturnIsDamaged(v => !v)}\n' +
        i + '      >\n' +
        i + '        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${returnIsDamaged ? "bg-amber-600 border-amber-600" : "border-muted-foreground"}`}>\n' +
        i + '          {returnIsDamaged && <X className="w-2.5 h-2.5 text-white" />}\n' +
        i + '        </div>\n' +
        i + '        <div>\n' +
        i + '          <p className={`text-xs font-bold ${returnIsDamaged ? "text-amber-400" : "text-muted-foreground"}`}>\n' +
        i + '            <AlertTriangle className="w-3 h-3 inline ml-1" />\n' +
        i + '            \u0627\u0644\u0645\u0646\u062a\u062c \u062a\u0627\u0644\u0641 / \u063a\u064a\u0631 \u0635\u0627\u0644\u062d \u0644\u0644\u0628\u064a\u0639\n' +
        i + '          </p>\n' +
        i + '          <p className="text-[10px] text-muted-foreground mt-0.5">\n' +
        i + '            {returnIsDamaged ? "\u26a0 \u0644\u0646 \u064a\u064f\u0636\u0627\u0641 \u0644\u0644\u0645\u062e\u0632\u0648\u0646 \u2014 \u0633\u064a\u064f\u0633\u062c\u064e\u0651\u0644 \u0643\u062e\u0633\u0627\u0631\u0629" : "\u0641\u064a \u062d\u0627\u0644\u0629 \u0627\u0644\u062a\u064a\u0643\u060c \u0644\u0646 \u064a\u064f\u0631\u062c\u064e\u0639 \u0644\u0644\u0645\u062e\u0632\u0648\u0646"}\n' +
        i + '          </p>\n' +
        i + '        </div>\n' +
        i + '      </div>\n' +
        i + '    </div>\n' +
        i + '    <DialogFooter>\n' +
        i + '      <Button variant="ghost" onClick={() => { setShowReturnInput(false); setReturnReason(""); setReturnNote(""); setReturnIsDamaged(false); setReturnReceived(null); setSelectDisplayStatus(null); }}>\u0625\u0644\u063a\u0627\u0621</Button>\n' +
        i + '      <Button className="bg-red-700 hover:bg-red-600 text-white gap-1" onClick={handleReturnConfirm} disabled={updateOrder.isPending || (manifestStatus?.manifestStatus === "open" && returnReceived === null)}>\n' +
        i + '        <RotateCcw className="w-3 h-3" />{updateOrder.isPending ? "\u062c\u0627\u0631\u064a..." : "\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0625\u0631\u062c\u0627\u0639"}\n' +
        i + '      </Button>\n' +
        i + '    </DialogFooter>\n' +
        i + '  </DialogContent>\n' +
        i + '</Dialog>'
    )
