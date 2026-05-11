path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\movements.tsx'
with open(path, encoding='utf-8') as f:
    content = f.read()

# 1- عدل CardHeader عشان يحتوي الزر
old_header = (
    '        <CardHeader className="py-3 px-4 border-b border-border">\n'
    '          <CardTitle className="text-sm font-bold flex items-center gap-2">\n'
    '            <Activity className="w-3.5 h-3.5 text-muted-foreground" />\n'
    '            \u062c\u062f\u0648\u0644 \u0627\u0644\u062d\u0631\u0643\u0627\u062a\n'
    '            {!isLoading && <Badge variant="outline" className="text-[9px] font-normal border-border text-muted-foreground mr-1">{movements.length} \u062d\u0631\u0643\u0629</Badge>}\n'
    '          </CardTitle>\n'
    '        </CardHeader>'
)

new_header = (
    '        <CardHeader className="py-3 px-4 border-b border-border flex flex-row items-center justify-between">\n'
    '          <CardTitle className="text-sm font-bold flex items-center gap-2">\n'
    '            <Activity className="w-3.5 h-3.5 text-muted-foreground" />\n'
    '            \u062c\u062f\u0648\u0644 \u0627\u0644\u062d\u0631\u0643\u0627\u062a\n'
    '            {!isLoading && <Badge variant="outline" className="text-[9px] font-normal border-border text-muted-foreground mr-1">{movements.length} \u062d\u0631\u0643\u0629</Badge>}\n'
    '          </CardTitle>\n'
    '          {!isLoading && movements.length > 0 && (\n'
    '            <button\n'
    '              type="button"\n'
    '              onClick={() => {\n'
    '                if (showColFilters) {\n'
    '                  setColFilters({ date: new Set(), type: new Set(), product: new Set(), variant: new Set(), qty: new Set(), reason: new Set(), order: new Set(), location: new Set(), notes: new Set() });\n'
    '                }\n'
    '                setShowColFilters(v => !v);\n'
    '              }}\n'
    '              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${showColFilters ? "border-destructive/50 text-destructive bg-destructive/5 hover:bg-destructive/10" : "border-primary/40 text-primary bg-primary/5 hover:bg-primary/10"}`}\n'
    '            >\n'
    '              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill={showColFilters ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>\n'
    '              {showColFilters ? "\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u0641\u0644\u062a\u0631" : "\u0625\u0646\u0634\u0627\u0621 \u0641\u0644\u062a\u0631"}\n'
    '            </button>\n'
    '          )}\n'
    '        </CardHeader>'
)

# 2- شيل الـ div القديم للزر
old_btn_div = (
    '            <div className="flex justify-end px-4 pt-3">\n'
    '              <button\n'
    '                type="button"\n'
    '                onClick={() => {\n'
    '                  if (showColFilters) {\n'
    '                    setColFilters({ date: new Set(), type: new Set(), product: new Set(), variant: new Set(), qty: new Set(), reason: new Set(), order: new Set(), location: new Set(), notes: new Set() });\n'
    '                  }\n'
    '                  setShowColFilters(v => !v);\n'
    '                }}\n'
    '                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${showColFilters ? "border-destructive/50 text-destructive bg-destructive/5 hover:bg-destructive/10" : "border-primary/40 text-primary bg-primary/5 hover:bg-primary/10"}`}\n'
    '              >\n'
    '                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill={showColFilters ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>\n'
    '                {showColFilters ? "\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u0641\u0644\u062a\u0631" : "\u0625\u0646\u0634\u0627\u0621 \u0641\u0644\u062a\u0631"}\n'
    '              </button>\n'
    '            </div>\n'
)

if old_header in content:
    content = content.replace(old_header, new_header)
    print('Header OK')
else:
    print('Header NOT FOUND')

if old_btn_div in content:
    content = content.replace(old_btn_div, '')
    print('Old btn div removed OK')
else:
    print('Old btn div NOT FOUND')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
