path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\shipping-manifest.tsx'
with open(path, encoding='utf-8') as f:
    content = f.read()

old = (
    '                    <button\n'
    '                      type="button"\n'
    '                      onClick={() => setStatusSort(s => s === "none" ? "asc" : s === "asc" ? "desc" : "none")}\n'
    '                      className={`flex items-center gap-1 hover:text-primary transition-colors group min-w-0 ${statusSort !== "none" ? "text-primary font-bold" : ""}`}\n'
    '                    >\n'
    '                      <span className="shrink-0">\u0627\u0644\u062d\u0627\u0644\u0629</span>\n'
    '                      <span className="flex flex-col gap-[1px] shrink-0 opacity-40 group-hover:opacity-80">\n'
    '                        <ChevronUp   className={`w-2.5 h-2.5 ${statusSort === "asc"  ? "text-primary opacity-100" : ""}`} />\n'
    '                        <ChevronDown className={`w-2.5 h-2.5 ${statusSort === "desc" ? "text-primary opacity-100" : ""}`} />\n'
    '                      </span>\n'
    '                    </button>'
)

new = '                    <span className="shrink-0">\u0627\u0644\u062d\u0627\u0644\u0629</span>'

if old in content:
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Done OK')
else:
    print('NOT FOUND - checking partial...')
    if 'setStatusSort' in content:
        print('setStatusSort found in file')
    else:
        print('setStatusSort NOT in file')
