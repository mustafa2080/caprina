path = r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\caprina\src\pages\team.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = 'profiles.filter(p => !teamSearch || (p.displayName ?? "").includes(teamSearch) || (p as any).username?.includes(teamSearch) || (p as any).jobTitle?.includes(teamSearch))'
new = 'profiles.filter(p => { const q = teamSearch.toLowerCase(); return !teamSearch || (p.displayName ?? "").toLowerCase().includes(q) || (p as any).username?.toLowerCase().includes(q) || (p as any).jobTitle?.toLowerCase().includes(q); })'

if old in content:
    content = content.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('DONE')
else:
    print('NOT FOUND')
