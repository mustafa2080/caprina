# -*- coding: utf-8 -*-
import sys, os

base = r"C:\Users\musta\Desktop\pro"
found = None
for name in os.listdir(base):
    if "Caprina" in name and name.endswith("_2"):
        found = os.path.join(base, name, "Caprina-Orders", "artifacts", "caprina", "src", "pages", "order-detail.tsx")
        break

if not found or not os.path.exists(found):
    print("NOT FOUND:", found); sys.exit(1)

with open(found, encoding="utf-8") as f:
    content = f.read()

# ────────────────────────────────────────────────────────────────────────────
# Find the product section by unique anchor lines and replace the whole block
# ────────────────────────────────────────────────────────────────────────────
ANCHOR_START = '                      {/* Product picker from inventory */}'
ANCHOR_END   = '                      </div>'  # closes the last grid div for fields

# Find start
start = content.find(ANCHOR_START)
if start == -1:
    print("START not found"); sys.exit(1)

# The block ends after the closing </div> of the grid cols-5
# We look for the closing of the last FormField grid div
GRID_MARKER = '                      <div className="grid grid-cols-5 gap-3">'
grid_pos = content.find(GRID_MARKER, start)
if grid_pos == -1:
    print("GRID not found"); sys.exit(1)

# Now find the closing </div> of that grid
end_search = content.find('\n                      </div>', grid_pos)
end = end_search + len('\n                      </div>')

print("start:", start, "| grid:", grid_pos, "| end:", end)
print("Old block preview:", repr(content[start:start+80]))
print("Old block end:", repr(content[end-30:end+30]))
