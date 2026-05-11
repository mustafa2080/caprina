import os, sys
sys.stdout.reconfigure(encoding='utf-8')

base = r'C:\Users\musta\Desktop\pro'
d = os.listdir(base)[0]
path = os.path.join(base, d, 'Caprina-Orders', 'artifacts', 'caprina', 'src', 'pages', 'smart-analytics.tsx')

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = 'import { Link, useLocation } from "wouter";'
new = 'import { useState } from "react";\nimport { Link, useLocation } from "wouter";'

if old in content:
    content = content.replace(old, new, 1)
    print("✅ Added useState import")
else:
    print("❌ not found")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
