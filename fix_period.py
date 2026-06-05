path = r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\api-server\src\routes\employee.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

search = 'profile,\n    period: {\n      month: monthParam'
idx = content.find(search)
block_start = content.index('    period: {', idx)
block_end = content.index('    },', block_start) + 6

new_block = '    period: {\n      mode,\n      month: resolvedMonth,\n      date: mode === "daily" ? dateParam : undefined,\n      from: dateFrom.toISOString(),\n      to: dateTo.toISOString(),\n    },'

content2 = content[:block_start] + new_block + content[block_end:]
with open(path, 'w', encoding='utf-8') as f:
    f.write(content2)
print('DONE')
