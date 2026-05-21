import pathlib

filepath = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\finance-sale-detail.tsx'
content = pathlib.Path(filepath).read_text(encoding='utf-8')

# 1. استبدال import ExcelJS
old_import = 'import ExcelJS from "exceljs";'
new_import = 'import * as XLSX from "xlsx";'
content = content.replace(old_import, new_import, 1)

# 2. ابحث عن بداية دالة exportToExcel ونهايتها
start_marker = 'async function exportToExcel(order: SaleOrder) {'
end_marker   = '// \u2500\u2500 \u0637\u0628\u0627\u0639\u0629 PDF \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'

start_idx = content.find(start_marker)
end_idx   = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print('MARKERS NOT FOUND', start_idx, end_idx)
else:
    new_func = (
        'async function exportToExcel(order: SaleOrder) {\n'
        '  const fmtDate2 = (d: string | null) => d ? new Date(d).toLocaleDateString("ar-EG") : "\u2014";\n'
        '  const total    = parseFloat(order.totalAmount    ?? "0");\n'
        '  const paid     = parseFloat(order.paidAmount     ?? "0");\n'
        '  const discount = parseFloat(order.discountAmount ?? "0");\n'
        '  const shipping = parseFloat(order.shippingCost   ?? "0");\n'
        '  const due      = total - paid;\n'
        '\n'
        '  // \u0648\u0631\u0642\u0629 1: \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629\n'
        '  const info: (string|number)[][] = [\n'
        '    ["\u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629",   order.soNumber],\n'
        '    ["\u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064a\u0644",    order.clientName],\n'
        '    ["\u0647\u0627\u062a\u0641 \u0627\u0644\u0639\u0645\u064a\u0644",   order.clientPhone ?? "\u2014"],\n'
        '    ["\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0639\u0645\u064a\u0644",  order.clientAddress ?? "\u2014"],\n'
        '    ["\u062d\u0627\u0644\u0629 \u0627\u0644\u0623\u0645\u0631",    STATUS_MAP[order.status]?.label ?? order.status],\n'
        '    ["\u062d\u0627\u0644\u0629 \u0627\u0644\u062f\u0641\u0639",    PAY_MAP[order.paymentStatus]?.label ?? order.paymentStatus],\n'
        '    ["\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0625\u0646\u0634\u0627\u0621",  fmtDate2(order.createdAt)],\n'
        '    ["\u0639\u062f\u062f \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a",  order.items.length],\n'
        '    ["\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0642\u0637\u0639",  order.items.reduce((s,i)=>s+i.quantity,0)],\n'
        '    ["\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0643\u0644\u064a",   total],\n'
        '    ["\u0627\u0644\u0645\u062f\u0641\u0648\u0639",       paid],\n'
        '    ["\u0627\u0644\u0645\u062a\u0628\u0642\u064a",       due > 0 ? due : "\u0645\u0633\u062f\u062f \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u2713"],\n'
        '    ...(discount > 0 ? [["\u0627\u0644\u062e\u0635\u0645", discount]] : []),\n'
        '    ...(shipping > 0 ? [["\u0631\u0633\u0648\u0645 \u0627\u0644\u0634\u062d\u0646", shipping]] : []),\n'
        '    ...(order.notes  ? [["\u0645\u0644\u0627\u062d\u0638\u0627\u062a", order.notes]] : []),\n'
        '  ];\n'
        '  const ws1 = XLSX.utils.aoa_to_sheet([["\u0627\u0644\u0628\u064a\u0627\u0646", "\u0627\u0644\u0642\u064a\u0645\u0629"], ...info]);\n'
        '  ws1["!cols"] = [{ wch: 28 }, { wch: 36 }];\n'
        '\n'
        '  // \u0648\u0631\u0642\u0629 2: \u0628\u0646\u0648\u062f \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629\n'
        '  const itemRows = order.items.map((it, i) => [\n'
        '    i + 1,\n'
        '    it.productName ?? "\u2014",\n'
        '    it.color ?? "\u2014",\n'
        '    it.size  ?? "\u2014",\n'
        '    it.quantity,\n'
        '    Number(it.unitPrice),\n'
        '    it.quantity * Number(it.unitPrice),\n'
        '  ]);\n'
        '  const ws2 = XLSX.utils.aoa_to_sheet([\n'
        '    ["#", "\u0627\u0644\u0645\u0646\u062a\u062c", "\u0627\u0644\u0644\u0648\u0646", "\u0627\u0644\u0645\u0642\u0627\u0633", "\u0627\u0644\u0643\u0645\u064a\u0629", "\u0633\u0639\u0631 \u0627\u0644\u0648\u062d\u062f\u0629", "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a"],\n'
        '    ...itemRows,\n'
        '    ["", "", "", "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a", order.items.reduce((s,i)=>s+i.quantity,0), "", total],\n'
        '  ]);\n'
        '  ws2["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 9 }, { wch: 14 }, { wch: 14 }];\n'
        '\n'
        '  const wb = XLSX.utils.book_new();\n'
        '  XLSX.utils.book_append_sheet(wb, ws1, "\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629");\n'
        '  XLSX.utils.book_append_sheet(wb, ws2, "\u0628\u0646\u0648\u062f \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629");\n'
        '  XLSX.writeFile(wb, `\u0641\u0627\u062a\u0648\u0631\u0629-${order.soNumber}.xlsx`);\n'
        '}\n'
        '\n'
    )
    content = content[:start_idx] + new_func + content[end_idx:]
    pathlib.Path(filepath).write_text(content, encoding='utf-8')
    print('SUCCESS - lines:', content.count('\n'))
