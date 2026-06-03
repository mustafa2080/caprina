path = r'C:\Users\musta\Desktop\pro\Caprina-Orders\Caprina-Orders\artifacts\api-server\src\routes\orders.ts'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_block = (
    '    // -- 1) restore inventory stock if a movement exists\n'
    '    try {\n'
    '      const [lastMovement] = await db\n'
    '        .select({ id: inventoryMovementsTable.id })\n'
    '        .from(inventoryMovementsTable)\n'
    '        .where(eq(inventoryMovementsTable.orderId, order.id))\n'
    '        .orderBy(desc(inventoryMovementsTable.id))\n'
    '        .limit(1);\n'
    '      if (lastMovement) {\n'
    '        const orderRef = {\n'
    '          variantId: order.variantId, productId: order.productId,\n'
    '          product: order.product, color: order.color,\n'
    '          size: order.size, warehouseId: order.warehouseId,\n'
    '        };\n'
    '        const { variantId, productId } = await resolveInventoryTarget(orderRef);\n'
    '        await adjustWarehouseStock(order.warehouseId, variantId, productId, order.quantity).catch(() => {});\n'
    '        await syncProductQuantityFromWarehouses(variantId, productId).catch(() => {});\n'
    '        await db.delete(inventoryMovementsTable).where(eq(inventoryMovementsTable.orderId, order.id)).catch(() => {});\n'
    '      }\n'
    '    } catch (_) {}\n'
    '\n'
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
    '\n'
)

# Insert after line index 656 (0-based) = line 657 (1-based, the "continue;" closing brace line)
lines = lines[:657] + [new_block] + lines[657:]

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Done - inserted rollback block')
