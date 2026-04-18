import { Router, type IRouter } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { db, ordersTable, productsTable, productVariantsTable } from "@workspace/db";
import { eq, and, ilike } from "drizzle-orm";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// ─── Shared parser ─────────────────────────────────────────────────────────────
async function parseFileToRaw(buffer: Buffer, originalname: string): Promise<{ headers: string[]; rows: any[][] }> {
  const isCSV = /\.csv$/i.test(originalname);
  const workbook = new ExcelJS.Workbook();

  if (isCSV) {
    const { Readable } = await import("stream");
    const stream = Readable.from(buffer.toString("utf-8"));
    await workbook.csv.read(stream);
  } else {
    await workbook.xlsx.load(buffer);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { headers: [], rows: [] };

  let headers: string[] = [];
  let columnCount = 0;
  const rows: any[][] = [];

  worksheet.eachRow((row, rowNum) => {
    const values = (row.values as any[]).slice(1).map(v => {
      if (v === null || v === undefined) return "";
      if (typeof v === "object" && "result" in v) return v.result ?? "";
      return v;
    });

    if (rowNum === 1) {
      // Generate fallback names for empty headers
      headers = values.map((v, i) => {
        const s = String(v ?? "").trim();
        return s || `عمود_${i + 1}`;
      });
      // Remove trailing empty columns
      while (headers.length > 0 && headers[headers.length - 1].startsWith("عمود_")) {
        const idx = headers.length - 1;
        const orig = values[idx];
        if (!orig || String(orig).trim() === "") headers.pop();
        else break;
      }
      columnCount = headers.length;
    } else {
      // Trim row to column count
      rows.push(values.slice(0, columnCount));
    }
  });

  return { headers, rows };
}

// ─── Step 1: Parse file → return headers + sample ─────────────────────────────
router.post("/orders/import/parse", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "لم يتم رفع ملف" }); return; }

  try {
    const { headers, rows } = await parseFileToRaw(req.file.buffer, req.file.originalname);

    if (!headers.length) {
      res.status(400).json({ error: "الملف فارغ أو غير مدعوم" });
      return;
    }

    res.json({
      headers,
      sample: rows.slice(0, 5),
      totalRows: rows.length,
      allRows: rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: `فشل قراءة الملف: ${err.message}` });
  }
});

// ─── Step 2: Execute with mapping ─────────────────────────────────────────────
router.post("/orders/import/execute", async (req, res): Promise<void> => {
  const { headers, rows, mapping } = req.body as {
    headers: string[];
    rows: any[][];
    mapping: {
      name: string;
      phone: string;
      address: string;
      product: string;
      color: string;
      size: string;
      quantity: string;
      price: string;
      notes: string;
    };
  };

  if (!headers?.length || !rows?.length || !mapping) {
    res.status(400).json({ error: "بيانات غير مكتملة" });
    return;
  }

  // Build header → index map
  const headerIdx: Record<string, number> = {};
  headers.forEach((h, i) => { headerIdx[h] = i; });

  const getCell = (row: any[], colName: string): string => {
    if (!colName) return "";
    const idx = headerIdx[colName];
    if (idx === undefined) return "";
    const v = row[idx];
    if (v === null || v === undefined) return "";
    return String(v).trim();
  };

  const validOrders: any[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const customerName = getCell(row, mapping.name);
    const product = getCell(row, mapping.product);
    const rawQty = getCell(row, mapping.quantity);
    const rawPrice = getCell(row, mapping.price).replace(/,/g, "");
    const phone = getCell(row, mapping.phone) || null;
    const address = getCell(row, mapping.address) || null;
    const color = getCell(row, mapping.color) || null;
    const size = getCell(row, mapping.size) || null;
    const notes = getCell(row, mapping.notes) || null;

    // Skip completely empty rows
    if (!customerName && !product && !rawQty) continue;

    if (!customerName) { errors.push(`الصف ${rowNum}: اسم العميل مطلوب`); continue; }
    if (!product) { errors.push(`الصف ${rowNum}: اسم المنتج مطلوب`); continue; }

    const quantity = parseInt(rawQty || "1");
    if (isNaN(quantity) || quantity < 1) { errors.push(`الصف ${rowNum}: الكمية غير صحيحة ("${rawQty}")`); continue; }

    const unitPrice = rawPrice ? parseFloat(rawPrice) : 0;
    if (rawPrice && isNaN(unitPrice)) { errors.push(`الصف ${rowNum}: السعر غير صحيح ("${rawPrice}")`); continue; }

    validOrders.push({
      customerName,
      product,
      color,
      size,
      quantity,
      unitPrice: unitPrice || 0,
      totalPrice: quantity * (unitPrice || 0),
      phone,
      address,
      notes,
      status: "pending" as const,
    });
  }

  let inserted: any[] = [];
  if (validOrders.length > 0) {
    inserted = await db.insert(ordersTable).values(validOrders).returning();
  }

  res.json({
    imported: inserted.length,
    failed: errors.length,
    errors: errors.slice(0, 30),
    orders: inserted,
  });
});

// ─── Products Import: Parse ─────────────────────────────────────────────────────
// Reuses the same parse endpoint since parsing is format-agnostic
router.post("/products/import/parse", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "لم يتم رفع ملف" }); return; }
  try {
    const { headers, rows } = await parseFileToRaw(req.file.buffer, req.file.originalname);
    if (!headers.length) { res.status(400).json({ error: "الملف فارغ أو غير مدعوم" }); return; }
    res.json({ headers, sample: rows.slice(0, 5), totalRows: rows.length, allRows: rows });
  } catch (err: any) {
    res.status(500).json({ error: `فشل قراءة الملف: ${err.message}` });
  }
});

// ─── Products Import: Execute ───────────────────────────────────────────────────
router.post("/products/import/execute", async (req, res): Promise<void> => {
  const { headers, rows, mapping } = req.body as {
    headers: string[];
    rows: any[][];
    mapping: {
      name: string;
      sku?: string;
      unitPrice?: string;
      costPrice?: string;
      totalQuantity?: string;
      lowStockThreshold?: string;
      color?: string;
      size?: string;
    };
  };

  if (!headers?.length || !rows?.length || !mapping) {
    res.status(400).json({ error: "بيانات غير مكتملة" }); return;
  }

  const headerIdx: Record<string, number> = {};
  headers.forEach((h, i) => { headerIdx[h] = i; });

  const getCell = (row: any[], colName: string | undefined): string => {
    if (!colName) return "";
    const idx = headerIdx[colName];
    if (idx === undefined) return "";
    const v = row[idx];
    if (v === null || v === undefined) return "";
    return String(v).trim();
  };

  const errors: string[] = [];
  let importedProducts = 0;
  let importedVariants = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const name = getCell(row, mapping.name);
    if (!name) { errors.push(`الصف ${rowNum}: اسم المنتج مطلوب`); continue; }

    const rawUnitPrice = getCell(row, mapping.unitPrice).replace(/,/g, "");
    const unitPrice = rawUnitPrice ? parseFloat(rawUnitPrice) : 0;
    if (rawUnitPrice && isNaN(unitPrice)) { errors.push(`الصف ${rowNum}: سعر البيع غير صحيح`); continue; }

    const rawCostPrice = getCell(row, mapping.costPrice).replace(/,/g, "");
    const costPrice = rawCostPrice ? parseFloat(rawCostPrice) : null;

    const rawQty = getCell(row, mapping.totalQuantity);
    const totalQuantity = rawQty ? parseInt(rawQty) : 0;

    const rawThreshold = getCell(row, mapping.lowStockThreshold);
    const lowStockThreshold = rawThreshold ? parseInt(rawThreshold) : 5;

    const sku = getCell(row, mapping.sku) || null;
    const color = getCell(row, mapping.color) || null;
    const size = getCell(row, mapping.size) || null;

    // Find or create product by name (case-insensitive)
    let [product] = await db.select().from(productsTable).where(ilike(productsTable.name, name)).limit(1);
    if (!product) {
      const [created] = await db.insert(productsTable).values({
        name,
        sku,
        unitPrice,
        costPrice,
        totalQuantity: (!color && !size) ? totalQuantity : 0,
        lowStockThreshold,
      }).returning();
      product = created;
      importedProducts++;
    } else {
      // Update pricing if provided
      const updates: any = {};
      if (unitPrice) updates.unitPrice = unitPrice;
      if (costPrice !== null) updates.costPrice = costPrice;
      await db.update(productsTable).set({ ...updates, updatedAt: new Date() }).where(eq(productsTable.id, product.id));
    }

    // Create variant if color/size provided
    if (color && size) {
      const [existingVariant] = await db.select().from(productVariantsTable)
        .where(and(
          eq(productVariantsTable.productId, product.id),
          ilike(productVariantsTable.color, color),
          ilike(productVariantsTable.size, size),
        )).limit(1);

      if (!existingVariant) {
        const variantSku = sku || `${name.substring(0, 3).toUpperCase()}-${color.substring(0, 3).toUpperCase()}-${size.toUpperCase()}`;
        await db.insert(productVariantsTable).values({
          productId: product.id,
          color,
          size,
          sku: variantSku,
          totalQuantity,
          lowStockThreshold,
          unitPrice: unitPrice || product.unitPrice,
          costPrice: costPrice ?? product.costPrice,
          reservedQuantity: 0,
          soldQuantity: 0,
        });
        importedVariants++;
      } else {
        const updates: any = {};
        if (totalQuantity) updates.totalQuantity = totalQuantity;
        if (unitPrice) updates.unitPrice = unitPrice;
        if (costPrice !== null) updates.costPrice = costPrice;
        await db.update(productVariantsTable).set({ ...updates, updatedAt: new Date() }).where(eq(productVariantsTable.id, existingVariant.id));
      }
    }
  }

  res.json({
    imported: importedProducts + importedVariants,
    importedProducts,
    importedVariants,
    failed: errors.length,
    errors: errors.slice(0, 30),
  });
});

// ─── Returns Import: Parse ──────────────────────────────────────────────────────
router.post("/returns/import/parse", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "لم يتم رفع ملف" }); return; }
  try {
    const { headers, rows } = await parseFileToRaw(req.file.buffer, req.file.originalname);
    if (!headers.length) { res.status(400).json({ error: "الملف فارغ أو غير مدعوم" }); return; }
    res.json({ headers, sample: rows.slice(0, 5), totalRows: rows.length, allRows: rows });
  } catch (err: any) {
    res.status(500).json({ error: `فشل قراءة الملف: ${err.message}` });
  }
});

// ─── Returns Import: Execute ────────────────────────────────────────────────────
router.post("/returns/import/execute", async (req, res): Promise<void> => {
  const { headers, rows, mapping } = req.body as {
    headers: string[];
    rows: any[][];
    mapping: { orderId?: string; customerName?: string; product?: string; reason?: string };
  };

  if (!headers?.length || !rows?.length || !mapping) {
    res.status(400).json({ error: "بيانات غير مكتملة" }); return;
  }

  const headerIdx: Record<string, number> = {};
  headers.forEach((h, i) => { headerIdx[h] = i; });

  const getCell = (row: any[], colName: string | undefined): string => {
    if (!colName) return "";
    const idx = headerIdx[colName];
    if (idx === undefined) return "";
    const v = row[idx];
    if (v === null || v === undefined) return "";
    return String(v).trim();
  };

  const errors: string[] = [];
  let importedReturns = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const orderIdRaw = getCell(row, mapping.orderId);
    const customerName = getCell(row, mapping.customerName);
    const product = getCell(row, mapping.product);
    const reason = getCell(row, mapping.reason) || "مرتجع مستورد";

    if (!orderIdRaw && !customerName && !product) continue;

    let order: any = null;

    if (orderIdRaw) {
      const orderId = parseInt(orderIdRaw);
      if (!isNaN(orderId)) {
        const [found] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
        order = found;
      }
    }

    if (!order && customerName && product) {
      const [found] = await db.select().from(ordersTable)
        .where(and(ilike(ordersTable.customerName, customerName), ilike(ordersTable.product, product)))
        .limit(1);
      order = found;
    }

    if (!order) {
      const id = orderIdRaw ? `#${orderIdRaw}` : `${customerName}/${product}`;
      errors.push(`الصف ${rowNum}: لم يتم إيجاد الطلب (${id})`);
      continue;
    }

    if (order.status === "returned") {
      // Already returned, skip silently
      importedReturns++;
      continue;
    }

    await db.update(ordersTable)
      .set({ status: "returned", notes: reason, updatedAt: new Date() })
      .where(eq(ordersTable.id, order.id));

    importedReturns++;
  }

  res.json({ imported: importedReturns, failed: errors.length, errors: errors.slice(0, 30) });
});

// ─── Legacy endpoint (kept for backward compat) ────────────────────────────────
router.post("/orders/import", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  try {
    const { headers, rows: rawRows } = await parseFileToRaw(req.file.buffer, req.file.originalname);
    if (!rawRows.length) { res.status(400).json({ error: "Empty file or unsupported format" }); return; }

    const headerIdx: Record<string, number> = {};
    headers.forEach((h, i) => { headerIdx[h] = i; });

    const getCell = (row: any[], ...names: string[]) => {
      for (const name of names) {
        const idx = headerIdx[name];
        if (idx !== undefined && row[idx] !== undefined) return String(row[idx]).trim();
      }
      return "";
    };

    const validOrders: any[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2;
      const customerName = getCell(row, "اسم العميل", "customerName", "customer_name", "name", "الاسم");
      const product = getCell(row, "المنتج", "product");
      const rawQty = getCell(row, "الكمية", "quantity");
      const rawPrice = getCell(row, "سعر الوحدة", "unitPrice", "unit_price", "السعر").replace(/,/g, "");
      const phone = getCell(row, "رقم الهاتف", "phone") || null;
      const address = getCell(row, "العنوان", "address") || null;
      const color = getCell(row, "اللون", "color") || null;
      const size = getCell(row, "المقاس", "size") || null;
      const notes = getCell(row, "ملاحظات", "notes") || null;

      if (!customerName && !product) continue;
      if (!customerName) { errors.push(`الصف ${rowNum}: اسم العميل مطلوب`); continue; }
      if (!product) { errors.push(`الصف ${rowNum}: اسم المنتج مطلوب`); continue; }

      const quantity = parseInt(rawQty || "1");
      if (isNaN(quantity) || quantity < 1) { errors.push(`الصف ${rowNum}: الكمية غير صحيحة`); continue; }

      const unitPrice = rawPrice ? parseFloat(rawPrice) : 0;
      if (rawPrice && isNaN(unitPrice)) { errors.push(`الصف ${rowNum}: السعر غير صحيح`); continue; }

      validOrders.push({
        customerName, product, color, size,
        quantity, unitPrice: unitPrice || 0,
        totalPrice: quantity * (unitPrice || 0),
        phone, address, notes, status: "pending" as const,
      });
    }

    let inserted: any[] = [];
    if (validOrders.length > 0) {
      inserted = await db.insert(ordersTable).values(validOrders).returning();
    }

    res.json({ imported: inserted.length, failed: errors.length, errors: errors.slice(0, 20), orders: inserted });
  } catch (err: any) {
    res.status(500).json({ error: `فشل قراءة الملف: ${err.message}` });
  }
});

export default router;
