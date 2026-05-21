import pathlib

filepath = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\api-server\src\routes\finance-sales.ts'
content = pathlib.Path(filepath).read_text(encoding='utf-8')

search = '// \u2500\u2500 DELETE /finance/sale-orders/:id \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500'

new_routes = (
    '// \u2500\u2500 PATCH /finance/sale-orders/:id/items/:itemId \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n'
    'router.patch("/finance/sale-orders/:id/items/:itemId", async (req, res): Promise<void> => {\n'
    '  try {\n'
    '    const tenantId = getTenantId(req);\n'
    '    const orderId  = parseInt(req.params.id);\n'
    '    const itemId   = parseInt(req.params.itemId);\n'
    '    const [order] = await db.select().from(saleOrdersTable).where(and(eq(saleOrdersTable.id, orderId), tenantId !== null ? eq(saleOrdersTable.tenantId, tenantId) : sql`1=1`));\n'
    '    if (!order) { res.status(404).json({ error: "\u0627\u0644\u0623\u0645\u0631 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f" }); return; }\n'
    '    const { productName, color, size, quantity, unitPrice } = req.body;\n'
    '    const [ci] = await db.select().from(saleOrderItemsTable).where(and(eq(saleOrderItemsTable.id, itemId), eq(saleOrderItemsTable.saleOrderId, orderId)));\n'
    '    if (!ci) { res.status(404).json({ error: "\u0627\u0644\u0628\u0646\u062f \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f" }); return; }\n'
    '    const newQty   = quantity  !== undefined ? Number(quantity)  : ci.quantity;\n'
    '    const newPrice = unitPrice !== undefined ? Number(unitPrice) : Number(ci.unitPrice);\n'
    '    const upd: Record<string, any> = { quantity: newQty, unitPrice: String(newPrice), totalPrice: String(newQty * newPrice) };\n'
    '    if (productName !== undefined) upd.productName = productName;\n'
    '    if (color !== undefined) upd.color = color || null;\n'
    '    if (size  !== undefined) upd.size  = size  || null;\n'
    '    await db.update(saleOrderItemsTable).set(upd).where(and(eq(saleOrderItemsTable.id, itemId), eq(saleOrderItemsTable.saleOrderId, orderId)));\n'
    '    const allItems = await db.select().from(saleOrderItemsTable).where(eq(saleOrderItemsTable.saleOrderId, orderId));\n'
    '    const sub = allItems.reduce((s, it) => s + it.quantity * Number(it.unitPrice), 0);\n'
    '    await db.update(saleOrdersTable).set({ totalAmount: String(sub + Number(order.shippingCost??0) + Number(order.taxAmount??0) - Number(order.discountAmount??0)), updatedAt: new Date() }).where(eq(saleOrdersTable.id, orderId));\n'
    '    res.json({ success: true });\n'
    '  } catch (err: any) { res.status(500).json({ error: err.message }); }\n'
    '});\n'
    '\n'
    '// \u2500\u2500 DELETE /finance/sale-orders/:id/items/:itemId \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n'
    'router.delete("/finance/sale-orders/:id/items/:itemId", async (req, res): Promise<void> => {\n'
    '  try {\n'
    '    const tenantId = getTenantId(req);\n'
    '    const orderId  = parseInt(req.params.id);\n'
    '    const itemId   = parseInt(req.params.itemId);\n'
    '    const [order] = await db.select().from(saleOrdersTable).where(and(eq(saleOrdersTable.id, orderId), tenantId !== null ? eq(saleOrdersTable.tenantId, tenantId) : sql`1=1`));\n'
    '    if (!order) { res.status(404).json({ error: "\u0627\u0644\u0623\u0645\u0631 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f" }); return; }\n'
    '    await db.delete(saleOrderItemsTable).where(and(eq(saleOrderItemsTable.id, itemId), eq(saleOrderItemsTable.saleOrderId, orderId)));\n'
    '    const rem = await db.select().from(saleOrderItemsTable).where(eq(saleOrderItemsTable.saleOrderId, orderId));\n'
    '    const sub = rem.reduce((s, it) => s + it.quantity * Number(it.unitPrice), 0);\n'
    '    await db.update(saleOrdersTable).set({ totalAmount: String(sub + Number(order.shippingCost??0) + Number(order.taxAmount??0) - Number(order.discountAmount??0)), updatedAt: new Date() }).where(eq(saleOrdersTable.id, orderId));\n'
    '    res.json({ success: true });\n'
    '  } catch (err: any) { res.status(500).json({ error: err.message }); }\n'
    '});\n'
    '\n'
)

if search in content:
    new_content = content.replace(search, new_routes + search, 1)
    pathlib.Path(filepath).write_text(new_content, encoding='utf-8')
    print('SUCCESS - total lines:', new_content.count('\n'))
else:
    print('NOT FOUND')
