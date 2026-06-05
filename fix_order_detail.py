# -*- coding: utf-8 -*-
"""
Fix order-detail.tsx:
1. Add icons to SelectItem in status Select (invoice mode + normal mode)
2. Convert showPartialInput Card -> Dialog (2 locations)
3. Convert showReturnInput Card -> Dialog (2 locations)
"""

FILE = r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\caprina\src\pages\order-detail.tsx'

with open(FILE, encoding='utf-8') as f:
    content = f.read()

original_size = len(content)
changes = []

# ─── FIX 1: Select icons (both invoice and normal mode are identical, replace all 2) ───
OLD_SELECT_ITEMS = (
    '                      <SelectItem value="pending">\u0642\u064a\u062f \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631</SelectItem>\n'
    '                      <SelectItem value="warehouse_ready">\u0642\u064a\u062f \u0627\u0644\u0634\u062d\u0646 \u0641\u064a \u0627\u0644\u0645\u062e\u0632\u0646</SelectItem>\n'
    '                      <SelectItem value="in_shipping">\u0642\u064a\u062f \u0627\u0644\u0634\u062d\u0646</SelectItem>\n'
    '                      <SelectItem value="received">\u0627\u0633\u062a\u0644\u0645 \u2713</SelectItem>\n'
    '                      <SelectItem value="delayed">\u0645\u0624\u062c\u0644</SelectItem>\n'
    '                      <SelectItem value="returned">\u0645\u0631\u062a\u062c\u0639</SelectItem>\n'
    '                      <SelectItem value="partial_received">\u0627\u0633\u062a\u0644\u0645 \u062c\u0632\u0626\u064a</SelectItem>\n'
)
NEW_SELECT_ITEMS = (
    '                      <SelectItem value="pending"><span className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-yellow-400" />\u0642\u064a\u062f \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631</span></SelectItem>\n'
    '                      <SelectItem value="warehouse_ready"><span className="flex items-center gap-1.5"><Warehouse className="w-3 h-3 text-blue-400" />\u0642\u064a\u062f \u0627\u0644\u0634\u062d\u0646 \u0641\u064a \u0627\u0644\u0645\u062e\u0632\u0646</span></SelectItem>\n'
    '                      <SelectItem value="in_shipping"><span className="flex items-center gap-1.5"><Truck className="w-3 h-3 text-purple-400" />\u0642\u064a\u062f \u0627\u0644\u0634\u062d\u0646</span></SelectItem>\n'
    '                      <SelectItem value="received"><span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-400" />\u0627\u0633\u062a\u0644\u0645 \u2713</span></SelectItem>\n'
    '                      <SelectItem value="delayed"><span className="flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-orange-400" />\u0645\u0624\u062c\u0644</span></SelectItem>\n'
    '                      <SelectItem value="returned"><span className="flex items-center gap-1.5"><RotateCcw className="w-3 h-3 text-red-400" />\u0645\u0631\u062a\u062c\u0639</span></SelectItem>\n'
    '                      <SelectItem value="partial_received"><span className="flex items-center gap-1.5"><Package className="w-3 h-3 text-violet-400" />\u0627\u0633\u062a\u0644\u0645 \u062c\u0632\u0626\u064a</span></SelectItem>\n'
)

# invoice mode SelectItems (3-space indent)
OLD_SELECT_ITEMS_INVOICE = OLD_SELECT_ITEMS
NEW_SELECT_ITEMS_INVOICE = NEW_SELECT_ITEMS

# normal mode SelectItems (2-space indent)
OLD_SELECT_ITEMS_NORMAL = (
    '                    <SelectItem value="pending">\u0642\u064a\u062f \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631</SelectItem>\n'
    '                    <SelectItem value="warehouse_ready">\u0642\u064a\u062f \u0627\u0644\u0634\u062d\u0646 \u0641\u064a \u0627\u0644\u0645\u062e\u0632\u0646</SelectItem>\n'
    '                    <SelectItem value="in_shipping">\u0642\u064a\u062f \u0627\u0644\u0634\u062d\u0646</SelectItem>\n'
    '                    <SelectItem value="received">\u0627\u0633\u062a\u0644\u0645 \u2713</SelectItem>\n'
    '                    <SelectItem value="delayed">\u0645\u0624\u062c\u0644</SelectItem>\n'
    '                    <SelectItem value="returned">\u0645\u0631\u062a\u062c\u0639</SelectItem>\n'
    '                    <SelectItem value="partial_received">\u0627\u0633\u062a\u0644\u0645 \u062c\u0632\u0626\u064a</SelectItem>\n'
)
NEW_SELECT_ITEMS_NORMAL = (
    '                    <SelectItem value="pending"><span className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-yellow-400" />\u0642\u064a\u062f \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631</span></SelectItem>\n'
    '                    <SelectItem value="warehouse_ready"><span className="flex items-center gap-1.5"><Warehouse className="w-3 h-3 text-blue-400" />\u0642\u064a\u062f \u0627\u0644\u0634\u062d\u0646 \u0641\u064a \u0627\u0644\u0645\u062e\u0632\u0646</span></SelectItem>\n'
    '                    <SelectItem value="in_shipping"><span className="flex items-center gap-1.5"><Truck className="w-3 h-3 text-purple-400" />\u0642\u064a\u062f \u0627\u0644\u0634\u062d\u0646</span></SelectItem>\n'
    '                    <SelectItem value="received"><span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-400" />\u0627\u0633\u062a\u0644\u0645 \u2713</span></SelectItem>\n'
    '                    <SelectItem value="delayed"><span className="flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-orange-400" />\u0645\u0624\u062c\u0644</span></SelectItem>\n'
    '                    <SelectItem value="returned"><span className="flex items-center gap-1.5"><RotateCcw className="w-3 h-3 text-red-400" />\u0645\u0631\u062a\u062c\u0639</span></SelectItem>\n'
    '                    <SelectItem value="partial_received"><span className="flex items-center gap-1.5"><Package className="w-3 h-3 text-violet-400" />\u0627\u0633\u062a\u0644\u0645 \u062c\u0632\u0626\u064a</span></SelectItem>\n'
)

cnt1 = content.count(OLD_SELECT_ITEMS_INVOICE)
cnt2 = content.count(OLD_SELECT_ITEMS_NORMAL)
print("Invoice select items found:", cnt1)
print("Normal select items found:", cnt2)

if cnt1 > 0:
    content = content.replace(OLD_SELECT_ITEMS_INVOICE, NEW_SELECT_ITEMS_INVOICE)
    changes.append("Invoice select icons added")
if cnt2 > 0:
    content = content.replace(OLD_SELECT_ITEMS_NORMAL, NEW_SELECT_ITEMS_NORMAL)
    changes.append("Normal select icons added")

# ─── FIX 2a: Partial Card -> Dialog (invoice mode) ───────────────────────────
OLD_PARTIAL_INVOICE = (
    '          {/* Partial received input \u2014 invoice mode */}\n'
    '          {showPartialInput && (\n'
    '            <Card className="border-purple-800 bg-purple-900/20">\n'
    '              <CardContent className="p-4">\n'
    '                <p className="text-sm font-bold text-purple-400 mb-3">\u0627\u0633\u062a\u0644\u0627\u0645 \u062c\u0632\u0626\u064a \u2014 \u0643\u0645 \u0648\u062d\u062f\u0629 \u0627\u0633\u062a\u0644\u0645\u062a\u061f</p>\n'
    '                <div className="flex items-center gap-3">\n'
    '                  <Input type="number" min="1" placeholder="\u0627\u0644\u0643\u0645\u064a\u0629" value={partialQty} onChange={e => setPartialQty(e.target.value)} className="h-8 text-sm w-40 bg-card" />\n'
    '                  <Button size="sm" className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white" onClick={handlePartialReceived} disabled={updateOrder.isPending}>\u062a\u0623\u0643\u064a\u062f</Button>\n'
    '                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setShowPartialInput(false); setPartialQty(""); setSelectDisplayStatus(null); }}>\u0625\u0644\u063a\u0627\u0621</Button>\n'
    '                </div>\n'
    '              </CardContent>\n'
    '            </Card>\n'
    '          )}'
)
NEW_PARTIAL_INVOICE = (
    '          {/* Partial received input \u2014 invoice mode */}\n'
    '          <Dialog open={showPartialInput} onOpenChange={(open) => { if (!open) { setShowPartialInput(false); setPartialQty(""); setSelectDisplayStatus(null); } }}>\n'
    '            <DialogContent className="sm:max-w-md">\n'
    '              <DialogHeader>\n'
    '                <DialogTitle className="flex items-center gap-2 text-purple-400">\n'
    '                  <Package className="w-4 h-4" />\u0627\u0633\u062a\u0644\u0627\u0645 \u062c\u0632\u0626\u064a\n'
    '                </DialogTitle>\n'
    '                <DialogDescription>\u062d\u062f\u062f \u0639\u062f\u062f \u0627\u0644\u0648\u062d\u062f\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u0644\u0645\u0629</DialogDescription>\n'
    '              </DialogHeader>\n'
    '              <div className="flex items-center gap-3 py-2">\n'
    '                <Input type="number" min="1" placeholder="\u0627\u0644\u0643\u0645\u064a\u0629" value={partialQty} onChange={e => setPartialQty(e.target.value)} className="h-9 text-sm bg-card" />\n'
    '              </div>\n'
    '              <DialogFooter>\n'
    '                <Button variant="ghost" onClick={() => { setShowPartialInput(false); setPartialQty(""); setSelectDisplayStatus(null); }}>\u0625\u0644\u063a\u0627\u0621</Button>\n'
    '                <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handlePartialReceived} disabled={updateOrder.isPending}>\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645</Button>\n'
    '              </DialogFooter>\n'
    '            </DialogContent>\n'
    '          </Dialog>'
)
cnt3 = content.count(OLD_PARTIAL_INVOICE)
print("Partial invoice Card found:", cnt3)
if cnt3 > 0:
    content = content.replace(OLD_PARTIAL_INVOICE, NEW_PARTIAL_INVOICE, 1)
    changes.append("Partial invoice Card -> Dialog")

# ─── FIX 2b: Partial Card -> Dialog (normal mode) ────────────────────────────
OLD_PARTIAL_NORMAL = (
    '      {/* Partial received input */}\n'
    '      {showPartialInput && (\n'
    '        <Card className="border-purple-800 bg-purple-900/20">\n'
    '          <CardContent className="p-4">\n'
    '            <p className="text-sm font-bold text-purple-400 mb-3">\u0627\u0633\u062a\u0644\u0627\u0645 \u062c\u0632\u0626\u064a \u2014 \u0643\u0645 \u0648\u062d\u062f\u0629 \u0627\u0633\u062a\u0644\u0645\u062a\u061f</p>\n'
    '            <div className="flex items-center gap-3">\n'
    '              <Input type="number" min="1" max={order.quantity} placeholder={`\u0627\u0644\u062d\u062f \u0627\u0644\u0623\u0642\u0635\u0649: ${order.quantity}`} value={partialQty} onChange={e => setPartialQty(e.target.value)} className="h-8 text-sm w-40 bg-card" />\n'
    '              <Button size="sm" className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white" onClick={handlePartialReceived} disabled={updateOrder.isPending}>\u062a\u0623\u0643\u064a\u062f</Button>\n'
    '              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setShowPartialInput(false); setPartialQty(""); setSelectDisplayStatus(null); }}>\u0625\u0644\u063a\u0627\u0621</Button>\n'
    '            </div>\n'
    '          </CardContent>\n'
    '        </Card>\n'
    '      )}'
)
NEW_PARTIAL_NORMAL = (
    '      {/* Partial received input */}\n'
    '      <Dialog open={showPartialInput} onOpenChange={(open) => { if (!open) { setShowPartialInput(false); setPartialQty(""); setSelectDisplayStatus(null); } }}>\n'
    '        <DialogContent className="sm:max-w-md">\n'
    '          <DialogHeader>\n'
    '            <DialogTitle className="flex items-center gap-2 text-purple-400">\n'
    '              <Package className="w-4 h-4" />\u0627\u0633\u062a\u0644\u0627\u0645 \u062c\u0632\u0626\u064a\n'
    '            </DialogTitle>\n'
    '            <DialogDescription>\u062d\u062f\u062f \u0639\u062f\u062f \u0627\u0644\u0648\u062d\u062f\u0627\u062a \u0627\u0644\u0645\u0633\u062a\u0644\u0645\u0629 (\u0627\u0644\u062d\u062f \u0627\u0644\u0623\u0642\u0635\u0649: {order.quantity})</DialogDescription>\n'
    '          </DialogHeader>\n'
    '          <div className="flex items-center gap-3 py-2">\n'
    '            <Input type="number" min="1" max={order.quantity} placeholder={`\u0627\u0644\u062d\u062f \u0627\u0644\u0623\u0642\u0635\u0649: ${order.quantity}`} value={partialQty} onChange={e => setPartialQty(e.target.value)} className="h-9 text-sm bg-card" />\n'
    '          </div>\n'
    '          <DialogFooter>\n'
    '            <Button variant="ghost" onClick={() => { setShowPartialInput(false); setPartialQty(""); setSelectDisplayStatus(null); }}>\u0625\u0644\u063a\u0627\u0621</Button>\n'
    '            <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handlePartialReceived} disabled={updateOrder.isPending}>\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645</Button>\n'
    '          </DialogFooter>\n'
    '        </DialogContent>\n'
    '      </Dialog>'
)
cnt4 = content.count(OLD_PARTIAL_NORMAL)
print("Partial normal Card found:", cnt4)
if cnt4 > 0:
    content = content.replace(OLD_PARTIAL_NORMAL, NEW_PARTIAL_NORMAL, 1)
    changes.append("Partial normal Card -> Dialog")

# ─── FIX 3: Return Card -> Dialog (both modes) ────────────────────────────────
# Strategy: use line-based replacement since the Return block is too long for string matching
# We replace "{showReturnInput && (" ... "}" pattern

# Find the normal mode Return block boundaries
lines = content.split('\n')
total = len(lines)

def find_return_block(start_hint, comment_text):
    """Find Return block start and end line indices"""
    for i in range(max(0, start_hint-5), min(total, start_hint+10)):
        if comment_text in lines[i]:
            # Found comment, next non-empty line should be {showReturnInput &&
            for j in range(i, min(total, i+5)):
                if '{showReturnInput && (' in lines[j]:
                    # Find matching closing brace
                    depth = 0
                    for k in range(j, min(total, j+200)):
                        depth += lines[k].count('{') - lines[k].count('}')
                        if depth == 0 and k > j:
                            return i, j, k
    return None, None, None

# invoice mode: around line 2206 (0-indexed: 2205)
inv_comment, inv_start, inv_end = find_return_block(2205, 'Return reason input \u2014 invoice mode')
print("Invoice return block:", inv_comment, inv_start, inv_end)

# normal mode: around line 2453 (0-indexed: 2452)
norm_comment, norm_start, norm_end = find_return_block(2452, 'Return reason input')
print("Normal return block:", norm_comment, norm_start, norm_end)

# ─── FIX 3: Return Dialog content builder ─────────────────────────────────────
def build_return_dialog(indent, has_ref=False):
    """Build Dialog replacement for the return block"""
    i = indent
    ref_attr = ' ref={returnSectionRef}' if has_ref else ''
    return (
        f'{i}<Dialog open={{showReturnInput}} onOpenChange={{(open) => {{ if (!open) {{ setShowReturnInput(false); setReturnReason(""); setReturnNote(""); setReturnIsDamaged(false); setReturnReceived(null); setSelectDisplayStatus(null); }} }}}}>\n'
        f'{i}  <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">\n'
        f'{i}    <DialogHeader>\n'
        f'{i}      <DialogTitle className="flex items-center gap-2 text-red-400">\n'
        f'{i}        <RotateCcw className="w-4 h-4" />\u062a\u0633\u062c\u064a\u0644 \u0645\u0631\u062a\u062c\u0639\n'
        f'{i}      </DialogTitle>\n'
        f'{i}      <DialogDescription>\u0645\u0627 \u0633\u0628\u0628 \u0627\u0644\u0625\u0631\u062c\u0627\u0639\u061f</DialogDescription>\n'
        f'{i}    </DialogHeader>\n'
        f'{i}    <div className="space-y-3 py-2">\n'
        f'{i}      <div className="space-y-1">\n'
        f'{i}        <Label className="text-xs text-muted-foreground">\u0633\u0628\u0628 \u0627\u0644\u0625\u0631\u062c\u0627\u0639 *</Label>\n'
        f'{i}        <Select value={{returnReason}} onValueChange={{setReturnReason}}>\n'
        f'{i}          <SelectTrigger className="h-9 text-sm bg-card border-red-800 focus:ring-red-700">\n'
        f'{i}            <SelectValue placeholder="\u0627\u062e\u062a\u0631 \u0627\u0644\u0633\u0628\u0628..." />\n'
        f'{i}          </SelectTrigger>\n'
        f'{i}          <SelectContent>\n'
        f'{i}            {{RETURN_REASONS.map(r => (\n'
        f'{i}              <SelectItem key={{r.value}} value={{r.value}}>{{r.label}}</SelectItem>\n'
        f'{i}            ))}}\n'
        f'{i}          </SelectContent>\n'
        f'{i}        </Select>\n'
        f'{i}      </div>\n'
        f'{i}      {{returnReason === "other" && (\n'
        f'{i}        <div className="space-y-1">\n'
        f'{i}          <Label className="text-xs text-muted-foreground">\u0627\u0643\u062a\u0628 \u0627\u0644\u0633\u0628\u0628 *</Label>\n'
        f'{i}          <Textarea\n'
        f'{i}            placeholder="\u0627\u0643\u062a\u0628 \u0633\u0628\u0628 \u0627\u0644\u0625\u0631\u062c\u0627\u0639 \u0628\u0627\u0644\u062a\u0641\u0635\u064a\u0644..."\n'
        f'{i}            className="min-h-[70px] text-sm resize-none bg-card border-red-800 focus:ring-red-700"\n'
        f'{i}            value={{returnNote}}\n'
        f'{i}            onChange={{e => setReturnNote(e.target.value)}}\n'
        f'{i}          />\n'
        f'{i}        </div>\n'
        f'{i}      )}}\n'
        f'{i}      {{manifestStatus?.manifestStatus === "open" && (\n'
        f'{i}      <div className="space-y-2">\n'
        f'{i}        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">\u0647\u0644 \u062a\u0645 \u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u0645\u0631\u062a\u062c\u0639\u061f *</p>\n'
        f'{i}        <div className="flex gap-2.5">\n'
        f'{i}          <button type="button" onClick={{() => setReturnReceived(true)}}\n'
        f'{i}            className="flex-1 relative outline-none cursor-pointer p-0 border-0 bg-transparent"\n'
        f'{i}            style={{{{ borderRadius: 14 }}}}>\n'
        f'{i}            <div className="absolute inset-0 top-1 rounded-[14px] transition-colors" style={{{{ background: returnReceived === true ? "#085041" : "var(--color-background-secondary)", border: returnReceived === true ? "none" : "1.5px solid #9FE1CB" }}}} />\n'
        f'{i}            <div className={{`relative z-10 flex flex-col items-center gap-1.5 px-3 pt-3 pb-4 rounded-[14px] transition-all ${{returnReceived === true ? "mb-1" : "mb-0"}}`}} style={{{{ background: returnReceived === true ? "#0F6E56" : "var(--color-background-primary)", border: returnReceived === true ? "none" : "1.5px solid #9FE1CB", boxShadow: returnReceived === true ? "inset 0 0 0 2px rgba(159,225,203,0.4)" : "none", transform: returnReceived === true ? "translateY(2px)" : "none" }}}}>\n'
        f'{i}              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={{returnReceived === true ? "#E1F5EE" : "#1D9E75"}} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7L9 18l-5-5"/></svg>\n'
        f'{i}              <span className="text-[11px] font-semibold leading-tight" style={{{{ color: returnReceived === true ? "#E1F5EE" : "#0F6E56" }}}}}>\u062a\u0645 \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645</span>\n'
        f'{i}              <span className="text-[9px] leading-tight" style={{{{ color: returnReceived === true ? "rgba(225,245,238,0.7)" : "#5F5E5A" }}}}}>\u064a\u064f\u0639\u0627\u062f \u0644\u0644\u0645\u062e\u0632\u0646</span>\n'
        f'{i}            </div>\n'
        f'{i}          </button>\n'
        f'{i}          <button type="button" onClick={{() => setReturnReceived(false)}}\n'
        f'{i}            className="flex-1 relative outline-none cursor-pointer p-0 border-0 bg-transparent"\n'
        f'{i}            style={{{{ borderRadius: 14 }}}}>\n'
        f'{i}            <div className="absolute inset-0 top-1 rounded-[14px] transition-colors" style={{{{ background: returnReceived === false ? "#412402" : "var(--color-background-secondary)", border: returnReceived === false ? "none" : "1.5px solid #FAC775" }}}} />\n'
        f'{i}            <div className={{`relative z-10 flex flex-col items-center gap-1.5 px-3 pt-3 pb-4 rounded-[14px] transition-all ${{returnReceived === false ? "mb-1" : "mb-0"}}`}} style={{{{ background: returnReceived === false ? "#854F0B" : "var(--color-background-primary)", border: returnReceived === false ? "none" : "1.5px solid #FAC775", boxShadow: returnReceived === false ? "inset 0 0 0 2px rgba(250,199,117,0.4)" : "none", transform: returnReceived === false ? "translateY(2px)" : "none" }}}}>\n'
        f'{i}              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={{returnReceived === false ? "#FAEEDA" : "#BA7517"}} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>\n'
        f'{i}              <span className="text-[11px] font-semibold leading-tight" style={{{{ color: returnReceived === false ? "#FAEEDA" : "#854F0B" }}}}}>\u0645\u0627\u0632\u0627\u0644 \u0641\u064a \u0627\u0644\u0634\u062d\u0646</span>\n'
        f'{i}              <span className="text-[9px] leading-tight" style={{{{ color: returnReceived === false ? "rgba(250,238,218,0.7)" : "#5F5E5A" }}}}}>\u0644\u0627 \u064a\u0624\u062b\u0631 \u0639\u0644\u0649 \u0627\u0644\u0645\u062e\u0632\u0646</span>\n'
        f'{i}            </div>\n'
        f'{i}          </button>\n'
        f'{i}        </div>\n'
        f'{i}        <p className="text-[10px] text-center font-medium" style={{{{ color: returnReceived === true ? "#0F6E56" : returnReceived === false ? "#854F0B" : "var(--color-text-secondary)" }}}}>\n'
        f'{i}          {{returnReceived === true && "\u2713 \u0633\u064a\u062a\u0645 \u0625\u0631\u062c\u0627\u0639 \u0627\u0644\u0628\u0636\u0627\u0639\u0629 \u0644\u0644\u0645\u062e\u0632\u0646 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b"}}\n'
        f'{i}          {{returnReceived === false && "\u23f3 \u0645\u0631\u062a\u062c\u0639 \u0645\u0627\u0632\u0627\u0644 \u0641\u064a \u0634\u0631\u0643\u0629 \u0627\u0644\u0634\u062d\u0646 \u2014 \u0644\u0646 \u064a\u0624\u062b\u0631 \u0639\u0644\u0649 \u0627\u0644\u0645\u062e\u0632\u0646"}}\n'
        f'{i}          {{returnReceived === null && "\u26a0 \u0645\u0637\u0644\u0648\u0628 \u2014 \u062d\u062f\u062f \u062d\u0627\u0644\u0629 \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645"}}\n'
        f'{i}        </p>\n'
        f'{i}      </div>\n'
        f'{i}      )}}\n'
        f'{i}      <div\n'
        f'{i}        className={{`flex items-center gap-3 p-2.5 rounded border cursor-pointer transition-colors ${{returnIsDamaged ? "border-amber-700 bg-amber-900/20" : "border-border bg-card/50"}}`}}\n'
        f'{i}        onClick={{() => setReturnIsDamaged(v => !v)}}\n'
        f'{i}      >\n'
        f'{i}        <div className={{`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${{returnIsDamaged ? "bg-amber-600 border-amber-600" : "border-muted-foreground"}}`}}>\n'
        f'{i}          {{returnIsDamaged && <X className="w-2.5 h-2.5 text-white" />}}\n'
        f'{i}        </div>\n'
        f'{i}        <div>\n'
        f'{i}          <p className={{`text-xs font-bold ${{returnIsDamaged ? "text-amber-400" : "text-muted-foreground"}}`}}>\n'
        f'{i}            <AlertTriangle className="w-3 h-3 inline ml-1" />\n'
        f'{i}            \u0627\u0644\u0645\u0646\u062a\u062c \u062a\u0627\u0644\u0641 / \u063a\u064a\u0631 \u0635\u0627\u0644\u062d \u0644\u0644\u0628\u064a\u0639\n'
        f'{i}          </p>\n'
        f'{i}          <p className="text-[10px] text-muted-foreground mt-0.5">\n'
        f'{i}            {{returnIsDamaged ? "\u26a0 \u0644\u0646 \u064a\u064f\u0636\u0627\u0641 \u0644\u0644\u0645\u062e\u0632\u0648\u0646 \u2014 \u0633\u064a\u064f\u0633\u062c\u064e\u0651\u0644 \u0643\u062e\u0633\u0627\u0631\u0629" : "\u0641\u064a \u062d\u0627\u0644\u0629 \u0627\u0644\u062a\u064a\u0643\u060c \u0644\u0646 \u064a\u064f\u0631\u062c\u064e\u0639 \u0644\u0644\u0645\u062e\u0632\u0648\u0646"}}\n'
        f'{i}          </p>\n'
        f'{i}        </div>\n'
        f'{i}      </div>\n'
        f'{i}    </div>\n'
        f'{i}    <DialogFooter>\n'
        f'{i}      <Button variant="ghost" onClick={{() => {{ setShowReturnInput(false); setReturnReason(""); setReturnNote(""); setReturnIsDamaged(false); setReturnReceived(null); setSelectDisplayStatus(null); }}}}}>\u0625\u0644\u063a\u0627\u0621</Button>\n'
        f'{i}      <Button className="bg-red-700 hover:bg-red-600 text-white gap-1" onClick={{handleReturnConfirm}} disabled={{updateOrder.isPending || (manifestStatus?.manifestStatus === "open" && returnReceived === null)}}>\n'
        f'{i}        <RotateCcw className="w-3 h-3" />{{updateOrder.isPending ? "\u062c\u0627\u0631\u064a..." : "\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0625\u0631\u062c\u0627\u0639"}}\n'
        f'{i}      </Button>\n'
        f'{i}    </DialogFooter>\n'
        f'{i}  </DialogContent>\n'
        f'{i}</Dialog>'
    )


# ─── Apply Return Dialog replacements ────────────────────────────────────────
# Re-read lines after partial changes
lines = content.split('\n')
total = len(lines)

def find_return_block(lines, start_hint, comment_text):
    total = len(lines)
    for i in range(max(0, start_hint-20), min(total, start_hint+20)):
        if comment_text in lines[i]:
            for j in range(i, min(total, i+5)):
                if '{showReturnInput && (' in lines[j]:
                    depth = 0
                    for k in range(j, min(total, j+300)):
                        depth += lines[k].count('{') - lines[k].count('}')
                        if depth == 0 and k > j:
                            return i, j, k
    return None, None, None

inv_comment, inv_start, inv_end = find_return_block(lines, 2200, 'Return reason input \u2014 invoice mode')
print("Invoice return block:", inv_comment, inv_start, inv_end)

norm_comment, norm_start, norm_end = find_return_block(lines, 2450, 'Return reason input')
print("Normal return block:", norm_comment, norm_start, norm_end)

# Apply invoice return Dialog
if inv_start is not None:
    indent = '          '
    dialog_lines = build_return_dialog(indent).split('\n')
    comment_line = lines[inv_comment]
    new_block = [comment_line] + dialog_lines
    lines = lines[:inv_comment] + new_block + lines[inv_end+1:]
    content = '\n'.join(lines)
    changes.append("Return invoice Card -> Dialog")
    # Recalculate lines for normal mode
    lines = content.split('\n')
    print("Applied invoice return dialog")

norm_comment2, norm_start2, norm_end2 = find_return_block(lines, 2450, 'Return reason input')
print("Normal return block (re-scan):", norm_comment2, norm_start2, norm_end2)

if norm_start2 is not None:
    indent = '      '
    dialog_lines = build_return_dialog(indent).split('\n')
    comment_line = lines[norm_comment2]
    new_block = [comment_line] + dialog_lines
    lines = lines[:norm_comment2] + new_block + lines[norm_end2+1:]
    content = '\n'.join(lines)
    changes.append("Return normal Card -> Dialog")
    print("Applied normal return dialog")

# ─── Also add missing imports if needed ──────────────────────────────────────
IMPORT_CHECK = 'DialogDescription'
if IMPORT_CHECK not in content:
    # Find Dialog import line and add DialogDescription
    content = content.replace(
        'import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle }',
        'import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle }'
    )
    changes.append("Added DialogDescription import")

# ─── Write output ─────────────────────────────────────────────────────────────
with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

new_size = len(content)
print(f"\n{'='*50}")
print(f"Done! Changes applied: {len(changes)}")
for c in changes:
    print(f"  + {c}")
print(f"File size: {original_size} -> {new_size} bytes (+{new_size-original_size})")
