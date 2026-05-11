import os, sys

base = r'C:\Users\musta\Desktop\pro'
d = os.listdir(base)[0]
path = os.path.join(base, d, 'Caprina-Orders', 'Caprina-Orders', 'artifacts', 'caprina', 'src', 'pages', 'order-detail.tsx')
if not os.path.exists(path):
    path = os.path.join(base, d, 'artifacts', 'caprina', 'src', 'pages', 'order-detail.tsx')
    if not os.path.exists(path):
        # search
        for root, dirs, files in os.walk(os.path.join(base, d)):
            dirs[:] = [dd for dd in dirs if dd not in ['node_modules', '.git']]
            for f in files:
                if f == 'order-detail.tsx':
                    path = os.path.join(root, f)
                    break

print('Path:', path)
print('Exists:', os.path.exists(path))
