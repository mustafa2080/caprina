path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\shipping-manifest.tsx'
with open(path, encoding='utf-8') as f:
    c = f.read()

# 1) Update ColFilterBtn signature
old1 = 'function ColFilterBtn({ col, colFilters, getColOptions, toggleColFilter, clearColFilter }: {\n  col: keyof ColFilters;\n  colFilters: ColFilters;\n  getColOptions: (col: keyof ColFilters) => string[];\n  toggleColFilter: (col: keyof ColFilters, val: string) => void;\n  clearColFilter: (col: keyof ColFilters) => void;\n}) {\n  const [open, setOpen] = useState(false);\n  const [search, setSearch] = useState("");\n  const [sort, setSort] = useState<"asc" | "desc">("asc");'
new1 = 'function ColFilterBtn({ col, colFilters, getColOptions, toggleColFilter, clearColFilter, sortCol, sortDir, onSort }: {\n  col: keyof ColFilters;\n  colFilters: ColFilters;\n  getColOptions: (col: keyof ColFilters) => string[];\n  toggleColFilter: (col: keyof ColFilters, val: string) => void;\n  clearColFilter: (col: keyof ColFilters) => void;\n  sortCol: keyof ColFilters | null;\n  sortDir: "asc" | "desc";\n  onSort: (col: keyof ColFilters, dir: "asc" | "desc") => void;\n}) {\n  const [open, setOpen] = useState(false);\n  const [search, setSearch] = useState("");\n  const sort = sortCol === col ? sortDir : "asc";'
assert old1 in c, "old1 not found"
c = c.replace(old1, new1)
print("step1 ok")

# 2) Update sort buttons
old2 = '            <button type="button" onClick={() => setSort("asc")}\n              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded border text-[10px] transition-all ${sort === "asc" ? "border-primary bg-primary/10 text-primary font-bold" : "border-border text-muted-foreground hover:bg-muted/30"}`}>\n              <ChevronUp className="w-2.5 h-2.5" />&#1571;&#x2192;&#1610;\n            </button>\n            <button type="button" onClick={() => setSort("desc")}\n              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded border text-[10px] transition-all ${sort === "desc" ? "border-primary bg-primary/10 text-primary font-bold" : "border-border text-muted-foreground hover:bg-muted/30"}`}>\n              <ChevronDown className="w-2.5 h-2.5" />&#1610;&#x2192;&#1571;\n            </button>'
new2 = '            <button type="button" onClick={() => { onSort(col, "asc"); setOpen(false); }}\n              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded border text-[10px] transition-all ${sort === "asc" && sortCol === col ? "border-primary bg-primary/10 text-primary font-bold" : "border-border text-muted-foreground hover:bg-muted/30"}`}>\n              <ChevronUp className="w-2.5 h-2.5" />&#1571;&#x2192;&#1610;\n            </button>\n            <button type="button" onClick={() => { onSort(col, "desc"); setOpen(false); }}\n              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded border text-[10px] transition-all ${sort === "desc" && sortCol === col ? "border-primary bg-primary/10 text-primary font-bold" : "border-border text-muted-foreground hover:bg-muted/30"}`}>\n              <ChevronDown className="w-2.5 h-2.5" />&#1610;&#x2192;&#1571;\n            </button>'

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
print("done step1 only - will do step2 separately")
