import { Router, type IRouter } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { db, ordersTable } from "@workspace/db";
import { adjustOrderInventory } from "../lib/inventory.js";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function parseFile(buffer: Buffer, mimetype: string, originalname: string): Promise<Record<string, any>[]> {
  const isCSV = originalname.match(/\.csv$/i) || mimetype === "text/csv";
  const workbook = new ExcelJS.Workbook();

  if (isCSV) {
    const { Readable } = await import("stream");
    const stream = Readable.from(buffer.toString("utf-8"));
    await workbook.csv.read(stream);
  } else {
    await workbook.xlsx.load(buffer);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const rows: Record<string, any>[] = [];
  let headers: string[] = [];

  worksheet.eachRow((row, rowNum) => {
    const values = (row.values as any[]).slice(1);
    if (rowNum === 1) {
      headers = values.map((v) => String(v ?? "").trim());
    } else {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => { obj[h] = values[i] ?? ""; });
      rows.push(obj);
    }
  });

  return rows;
}

router.post("/orders/import", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  try {
    const rows = await parseFile(req.file.buffer, req.file.mimetype, req.file.originalname);

    if (!rows.length) {
      res.status(400).json({ error: "Empty file or unsupported format" });
      return;
    }

    const validOrders: any[] = [];
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const customerName = String(row["اسم العميل"] || row["customerName"] || row["customer_name"] || "").trim();
      const product = String(row["المنتج"] || row["product"] || "").trim();
      const color = String(row["اللون"] || row["color"] || "").trim() || null;
      const size = String(row["المقاس"] || row["size"] || "").trim() || null;
      const quantity = parseInt(String(row["الكمية"] || row["quantity"] || "1"));
      const unitPrice = parseFloat(String(row["سعر الوحدة"] || row["unitPrice"] || row["unit_price"] || "0").replace(/,/g, ""));
      const phone = String(row["رقم الهاتف"] || row["phone"] || "").trim() || null;
      const address = String(row["العنوان"] || row["address"] || "").trim() || null;
      const notes = String(row["ملاحظات"] || row["notes"] || "").trim() || null;

      if (!customerName) { errors.push(`الصف ${rowNum}: اسم العميل مطلوب`); continue; }
      if (!product) { errors.push(`الصف ${rowNum}: اسم المنتج مطلوب`); continue; }
      if (isNaN(quantity) || quantity < 1) { errors.push(`الصف ${rowNum}: الكمية غير صحيحة`); continue; }
      if (isNaN(unitPrice) || unitPrice < 0) { errors.push(`الصف ${rowNum}: السعر غير صحيح`); continue; }

      validOrders.push({
        customerName,
        product,
        color,
        size,
        quantity,
        unitPrice,
        totalPrice: quantity * unitPrice,
        phone,
        address,
        notes,
        status: "pending" as const,
      });
    }

    let inserted: any[] = [];
    if (validOrders.length > 0) {
      inserted = await db.insert(ordersTable).values(validOrders).returning();

      // Reserve inventory for every imported order (all start as pending)
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
          ),
        ),
      );
    }

    res.json({
      imported: inserted.length,
      failed: errors.length,
      errors: errors.slice(0, 20),
      orders: inserted,
    });
  } catch (err: any) {
    res.status(500).json({ error: `فشل قراءة الملف: ${err.message}` });
  }
});

export default router;
