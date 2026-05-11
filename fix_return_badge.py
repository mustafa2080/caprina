import os, sys
sys.stdout.reconfigure(encoding='utf-8')

base = r'C:\Users\musta\Desktop\pro'
d = os.listdir(base)[0]
for root, dirs, files in os.walk(os.path.join(base, d)):
    dirs[:] = [dd for dd in dirs if dd not in ['node_modules', '.git', 'dist']]
    for f in files:
        if f == 'order-detail.tsx':
            path = os.path.join(root, f)

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix: show "مازال عند شركة الشحن" only when explicitly false/0, not when null
old = '''                            ) : (
                              <>
                                <Badge variant="outline" className="text-[9px] font-bold border-red-600 text-red-400 w-fit">
                                  ↩ مرتجع
                                </Badge>
                                <Badge variant="outline" className="text-[9px] font-bold border-orange-600 text-orange-400 w-fit">
                                  <Clock className="w-2.5 h-2.5 ml-1" />مازال عند شركة الشحن
                                </Badge>
                              </>
                            )}'''

new = '''                            ) : (
                              <>
                                <Badge variant="outline" className="text-[9px] font-bold border-red-600 text-red-400 w-fit">
                                  ↩ مرتجع
                                </Badge>
                                {(returnRec === 0 || returnRec === false) && (
                                  <Badge variant="outline" className="text-[9px] font-bold border-orange-600 text-orange-400 w-fit">
                                    <Clock className="w-2.5 h-2.5 ml-1" />مازال عند شركة الشحن
                                  </Badge>
                                )}
                                {(returnRec === 1 || returnRec === true) && (
                                  <Badge variant="outline" className="text-[9px] font-bold border-emerald-600 text-emerald-400 w-fit">
                                    <CheckCircle2 className="w-2.5 h-2.5 ml-1" />في المخزن
                                  </Badge>
                                )}
                              </>
                            )}'''

if old in content:
    content = content.replace(old, new, 1)
    print("✅ Fixed returnReceived badge display")
else:
    print("❌ not found")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
