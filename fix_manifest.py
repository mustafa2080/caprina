
import re

path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\shipping-manifest.tsx'

with open(path, encoding='utf-8') as f:
    content = f.read()

# Find and remove the expanded product cards block inside the dropdown button section
# The block starts with {expanded && ( and ends with )} and contains bg-muted/10 px-2 py-1
pattern = r'\n\s+\{expanded && \(\n\s+<div className="space-y-1">\n\s+\{group\.map\(\(order\) => \{.*?</div>\n\s+\);\s*\}\)\}\n\s+</div>\n\s+\)\}'

match = re.search(pattern, content, re.DOTALL)
if match:
    print("Found block:")
    print(repr(match.group()[:200]))
    new_content = content[:match.start()] + content[match.end():]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Done! Removed duplicate product block.")
else:
    print("Pattern not found, trying simpler approach...")
    # Find by specific anchor
    start_marker = '                {expanded && (\n                  <div className="space-y-1">\n                    {group.map((order) => {'
    end_marker = '                })\n                </div>\n              )}'
    
    s = content.find(start_marker)
    e = content.find(end_marker, s) + len(end_marker) if s != -1 else -1
    
    print(f"start: {s}, end: {e}")
    if s != -1 and e > s:
        print("Found! Removing...")
        print(repr(content[s:s+100]))
        new_content = content[:s] + content[e+1:]
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print("Done!")
    else:
        print("Could not find block. Printing surrounding area:")
        idx = content.find('rounded-md border border-border/40 bg-muted/10')
        if idx != -1:
            # find opening brace before this
            chunk = content[idx-400:idx+500]
            print(repr(chunk))
