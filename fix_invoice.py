import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\invoice-group.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_str = 'window.open(`/invoices?orderId=${orders[0].id}`, "_blank");'
new_str = 'window.open(`/invoices?preselect=${encodeURIComponent(invoiceNumber)}`, "_blank");'

print("OLD found:", old_str in content)

if old_str in content:
    content = content.replace(old_str, new_str, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("FIXED!")
else:
    # show context around handlePrint
    idx = content.find('handlePrint')
    print("Context:", repr(content[idx:idx+300]))
