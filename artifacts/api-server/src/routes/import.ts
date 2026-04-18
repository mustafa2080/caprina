import { Router, type IRouter } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { db, ordersTable } from "@workspace/db";
import { adjustOrderInventory } from "../lib/inventory.js";

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

    await Promise.all(
      inserted.map(order =>
        adjustOrderInventory(
          {
            variantId: order.variantId ?? null,
            productId: order.productId ?? null,
            product: order.product,
            color: order.color,
            size: order.size,
            quantity: order.quantity,
          },
          "none",
          "pending",
          null, null,
          order.id,
        ),
      ),
    );
  }

  res.json({
    imported: inserted.length,
    failed: errors.length,
    errors: errors.slice(0, 30),
    orders: inserted,
  });
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
      await Promise.all(
        inserted.map(order => adjustOrderInventory({ variantId: null, productId: null, product: order.product, color: order.color, size: order.size, quantity: order.quantity }, "none", "pending", null, null, order.id)),
      );
    }

    res.json({ imported: inserted.length, failed: errors.length, errors: errors.slice(0, 20), orders: inserted });
  } catch (err: any) {
    res.status(500).json({ error: `فشل قراءة الملف: ${err.message}` });
  }
});

export default router;
