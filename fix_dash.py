path = r"C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\dashboard.tsx"

with open(path, encoding='utf-8') as f:
    content = f.read()

old_label = '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0643\u0627\u0634'
new_label = '\u0625\u062c\u0645\u0627\u0644\u064a \u0623\u0631\u0635\u062f\u0629 \u062c\u0645\u064a\u0639 \u0627\u0644\u062e\u0632\u0646 \u0627\u0644\u0646\u0634\u0637\u0629'

if old_label in content:
    content = content.replace(old_label, new_label)
    print("label replaced OK")
else:
    print("label NOT FOUND")

subtitle = '\u0625\u062c\u0645\u0627\u0644\u064a \u0623\u0631\u0635\u062f\u0629 \u062c\u0645\u064a\u0639 \u0627\u0644\u062e\u0632\u0646 \u0627\u0644\u0646\u0634\u0637\u0629'
lines = content.split('\n')
new_lines = []
for line in lines:
    if ('mt-0.5 sm:mt-1' in line) and (subtitle in line):
        print("removed subtitle line")
        continue
    new_lines.append(line)

content = '\n'.join(new_lines)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("DONE")
