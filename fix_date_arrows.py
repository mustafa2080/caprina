path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\shipping-manifest.tsx'
with open(path, encoding='utf-8') as f:
    content = f.read()

old = (
    '                    <button\n'
    '                      type="button"\n'
    '                      onClick={() => setDateSort(s => s === "none" ? "asc" : s === "asc" ? "desc" : "none")}\n'
    '                      className={`flex items-center gap-1 hover:text-primary transition-colors group min-w-0 text-[9px] ${dateSort !== "none" ? "text-primary font-bold opacity-100" : "opacity-60"}`}\n'
    '                    >\n'
    '                      <span className="shrink-0">\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0625\u0636\u0627\u0641\u0629</span>\n'
    '                      <span className="flex flex-col gap-[1px] shrink-0 opacity-40 group-hover:opacity-80">\n'
    '                        <ChevronUp   className={`w-2.5 h-2.5 ${dateSort === "asc"  ? "text-primary opacity-100" : ""}`} />\n'
    '                        <ChevronDown className={`w-2.5 h-2.5 ${dateSort === "desc" ? "text-primary opacity-100" : ""}`} />\n'
    '                      </span>\n'
    '                    </button>'
)

new = '                    <span className="shrink-0 text-[9px] opacity-60">\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0625\u0636\u0627\u0641\u0629</span>'

if old in content:
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Done OK')
else:
    print('NOT FOUND')
