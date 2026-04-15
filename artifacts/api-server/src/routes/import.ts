import { Router, type IRouter } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { db, ordersTable } from "@workspace/db";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/orders/import", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  try {
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

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
