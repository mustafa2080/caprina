path = r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\api-server\src\routes\orders.ts'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and replace the cash rollback section (part 2)
old = (
    '    // -- 2) remove cash transaction linked to this order\n'
    '    try {\n'
    '      const invoiceRef = order.invoiceNumber ?? String(order.id);\n'
    '      await db\n'
    '        .delete(cashTransactionsTable)\n'
    '        .where(\n'
    '          and(\n'
    '            eq(cashTransactionsTable.type, "order_collected"),\n'
    '            eq(cashTransactionsTable.referenceNumber, invoiceRef),\n'
    '          )\n'
    '        );\n'
    '    } catch (_) {}\n'
)

new = (
    '    // -- 2) reverse cash transaction linked to this order\n'
    '    try {\n'
    '      const [txRow] = await db\n'
    '        .select()\n'
    '        .from(cashTransactionsTable)\n'
    '        .where(\n'
    '          and(\n'
    '            eq(cashTransactionsTable.type, "order_collected"),\n'
    '            eq(cashTransactionsTable.orderId, order.id),\n'
    '          )\n'
    '        )\n'
    '        .limit(1);\n'
    '      if (txRow) {\n'
    '        const amt = parseFloat(txRow.amount ?? "0");\n'
    '        // اطرح المبلغ من رصيد الخزنة\n'
    '        await db\n'
    '          .update(cashRegistersTable)\n'
    '          .set({\n'
    '            balance: sql`balance - ${amt}`,\n'
    '            updatedAt: new Date(),\n'
    '          })\n'
    '          .where(eq(cashRegistersTable.id, txRow.registerId));\n'
    '        // احذف الـ transaction\n'
    '        await db\n'
    '          .delete(cashTransactionsTable)\n'
    '          .where(eq(cashTransactionsTable.id, txRow.id));\n'
    '      }\n'
    '    } catch (_) {}\n'
)

content = ''.join(lines)
if old in content:
    content = content.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Done - cash rollback updated')
else:
    print('ERROR: old block not found!')
    # debug
    idx = content.find('-- 2) remove cash')
    print(repr(content[idx:idx+300]))
