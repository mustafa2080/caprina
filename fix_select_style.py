import os, sys
sys.stdout.reconfigure(encoding='utf-8')

base = r'C:\Users\musta\Desktop\pro'
d = os.listdir(base)[0]
for root, dirs, files in os.walk(os.path.join(base, d)):
    dirs[:] = [dd for dd in dirs if dd not in ['node_modules', '.git']]
    for f in files:
        if f == 'invoice-group.tsx':
            path = os.path.join(root, f)

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix SelectTrigger - change from yellow primary to a neutral dark style
old_trigger = 'className="h-9 text-xs bg-primary text-primary-foreground border-primary hover:bg-primary/90 font-bold w-auto gap-1.5 px-3 shrink-0"'
new_trigger = 'className="h-9 text-xs bg-card text-foreground border-border hover:bg-muted font-bold w-auto gap-1.5 px-3 shrink-0 transition-colors"'

if old_trigger in content:
    content = content.replace(old_trigger, new_trigger, 1)
    print("✅ Fixed SelectTrigger color")
else:
    print("❌ SelectTrigger not found")

# Fix SelectContent - add dark styling
old_content_tag = '            <SelectContent>\n              <SelectItem value="pending">قيد الانتظار</SelectItem>\n              <SelectItem value="warehouse_ready">قيد الشحن في المخزن</SelectItem>\n              <SelectItem value="in_shipping">قيد الشحن</SelectItem>\n              <SelectItem value="received">استلم ✓</SelectItem>\n              <SelectItem value="delayed">مؤجل</SelectItem>\n              <SelectItem value="returned">مرتجع</SelectItem>\n            </SelectContent>'
new_content_tag = '''            <SelectContent className="bg-card border-border text-foreground">
              <SelectItem value="pending" className="text-yellow-400 focus:bg-yellow-500/10 focus:text-yellow-300 cursor-pointer">⏳ قيد الانتظار</SelectItem>
              <SelectItem value="warehouse_ready" className="text-blue-400 focus:bg-blue-500/10 focus:text-blue-300 cursor-pointer">📦 قيد الشحن في المخزن</SelectItem>
              <SelectItem value="in_shipping" className="text-purple-400 focus:bg-purple-500/10 focus:text-purple-300 cursor-pointer">🚚 قيد الشحن</SelectItem>
              <SelectItem value="received" className="text-green-400 focus:bg-green-500/10 focus:text-green-300 cursor-pointer">✅ استلم</SelectItem>
              <SelectItem value="delayed" className="text-orange-400 focus:bg-orange-500/10 focus:text-orange-300 cursor-pointer">⏸ مؤجل</SelectItem>
              <SelectItem value="returned" className="text-red-400 focus:bg-red-500/10 focus:text-red-300 cursor-pointer">↩ مرتجع</SelectItem>
            </SelectContent>'''

if old_content_tag in content:
    content = content.replace(old_content_tag, new_content_tag, 1)
    print("✅ Fixed SelectContent items")
else:
    print("❌ SelectContent not found — trying to find it")
    idx = content.find('<SelectContent>')
    if idx != -1:
        print(repr(content[idx:idx+400]))

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("\nDone!")
