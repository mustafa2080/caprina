import re, sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\movements.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# ── Step 1: Add showColFilters state after colFilters declaration ──────────────
old1 = 'const [colFilters, setColFilters] = useState<ColFilters>({\n    date: new Set(), type: new Set(), product: new Set(), variant: new Set(),\n    qty: new Set(), reason: new Set(), order: new Set(), location: ne'

# Find exact line
idx1 = content.find('const [colFilters, setColFilters] = useState<ColFilters>({')
line_end = content.find('\n', content.find('\n', idx1)+1)  # end of 2nd line
line_end2 = content.find('\n', line_end+1)  # end of 3rd line
old1_exact = content[idx1:line_end2]
print('Old1 snippet:', repr(old1_exact[:80]))

new1_exact = old1_exact + '\n  const [showColFilters, setShowColFilters] = useState(false);'
content = content.replace(old1_exact, new1_exact, 1)
print('Step 1 OK - showColFilters state added')

# ── Step 2: Wrap all 9 ColFilterBtn with {showColFilters && ...} ───────────────
pattern = r'(<ColFilterBtn col="[^"]*" colFilters=\{colFilters\} getColOptions=\{getColOptions\} toggleColFilter=\{toggleColFilter\} clearColFilter=\{clearColFilter\} />)'
def wrap(m):
    return '{showColFilters && ' + m.group(1) + '}'
content, count = re.subn(pattern, wrap, content)
print(f'Step 2 OK - wrapped {count} ColFilterBtn instances')

# ── Step 3: Add toggle button before the overflow-x-auto table wrapper ─────────
btn_html = '''<div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={() => {
                  if (showColFilters) {
                    setColFilters({ date: new Set(), type: new Set(), product: new Set(), variant: new Set(), qty: new Set(), reason: new Set(), order: new Set(), location: new Set(), notes: new Set() });
                  }
                  setShowColFilters(v => !v);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${showColFilters ? "border-destructive/50 text-destructive bg-destructive/5 hover:bg-destructive/10" : "border-primary/40 text-primary bg-primary/5 hover:bg-primary/10"}`}
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill={showColFilters ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                {showColFilters ? "إلغاء الفلتر" : "إنشاء فلتر"}
              </button>
            </div>
          '''

old3 = '          <div className="overflow-x-auto">\n            <Table>'
new3 = btn_html + old3
assert old3 in content, 'Step3: overflow-x-auto wrapper not found'
content = content.replace(old3, new3, 1)
print('Step 3 OK - toggle button added before table')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('All done. File saved.')
