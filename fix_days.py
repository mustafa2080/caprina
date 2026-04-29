import pathlib

f = pathlib.Path('C:/Users/musta/Desktop/pro/Caprina-Orders الاصداؤ الاخير_2/Caprina-Orders/artifacts/caprina/src/components/charts-section.tsx')
content = f.read_text(encoding='utf-8')

old = '{d.label.slice(0, 2)}'
new = '{d.label === "الأحد" ? "أحد" : d.label === "الاثنين" ? "اثن" : d.label === "الثلاثاء" ? "ثلا" : d.label === "الأربعاء" ? "أرب" : d.label === "الخميس" ? "خمس" : d.label === "الجمعة" ? "جمع" : d.label === "السبت" ? "سبت" : d.label}'

if old in content:
    new_content = content.replace(old, new)
    f.write_text(new_content, encoding='utf-8')
    print('FIXED successfully')
else:
    print('Pattern not found')
