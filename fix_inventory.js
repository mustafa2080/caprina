const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'artifacts', 'api-server', 'src', 'lib', 'inventory.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Check if already patched
if (content.includes('تحقق إن الـ variant موجود فعلاً في جدول product_variants')) {
  console.log('Already patched!');
  process.exit(0);
}

// Find the block to replace (the stockRow lookup logic)
const searchFor = `    const [stockRow] = await db
      .select({ id: warehouseStockTable.id })
      .from(warehouseStockTable)
      .where(eq(warehouseStockTable.variantId, order.variantId))
      .limit(1);

    if (stockRow) {
      // الـ variant موجود في المخزن → استخدمه مباشرة
      return { variantId: order.variantId, productId: null };
    }

    // الـ variant مش في warehouse_stock → جرب بالـ productId بتاعه
    const [variant] = await db
      .select({ productId: productVariantsTable.productId })
      .from(productVariantsTable)
      .where(eq(productVariantsTable.id, order.variantId))
      .limit(1);

    if (variant?.productId) {
      // شوف لو المنتج الأب عنده stock
      const [prodStock] = await db
        .select({ id: warehouseStockTable.id })
        .from(warehouseStockTable)
        .where(eq(warehouseStockTable.productId, variant.productId))
        .limit(1);
      if (prodStock) {
        return { variantId: null, productId: variant.productId };
      }
      // حتى لو مش موجود في warehouse_stock، ارجع الـ variantId الأصلي
      // عشان الـ adjustWarehouseStock يقدر ينشئ سجل جديد لو delta > 0
    }
    return { variantId: order.variantId, productId: null };
  }`;

const replaceWith = `    // تحقق إن الـ variant موجود فعلاً في جدول product_variants (كافي — مش شرط يكون في warehouse_stock)
    const [variantRow] = await db
      .select({ id: productVariantsTable.id })
      .from(productVariantsTable)
      .where(eq(productVariantsTable.id, order.variantId))
      .limit(1);

    if (variantRow) {
      // الـ variant موجود → ارجعه مباشرة حتى لو كمية 0 أو مفيش صف في warehouse_stock
      return { variantId: order.variantId, productId: null };
    }

    // الـ variant مش موجود في DB أصلاً → ارجع null
    return { variantId: null, productId: null };
  }`;

if (!content.includes(searchFor)) {
  console.log('ERROR: Target block not found! Checking partial...');
  console.log('Has warehouseStockTable.variantId:', content.includes('warehouseStockTable.variantId'));
  process.exit(1);
}

content = content.replace(searchFor, replaceWith);
fs.writeFileSync(filePath, content, 'utf8');
console.log('SUCCESS: inventory.ts patched!');
