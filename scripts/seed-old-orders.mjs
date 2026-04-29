/**
 * seed-old-orders.mjs
 * ينشئ أوردرات قديمة في قاعدة البيانات لاختبار إحصائيات الداشبورد
 * 
 * التشغيل:
 *   node scripts/seed-old-orders.mjs
 *   أو مع عدد مخصص:
 *   SEED_DAYS=60 node scripts/seed-old-orders.mjs
 */

import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ── قراءة DATABASE_URL من .env ─────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "../.env");
const envContent = readFileSync(envPath, "utf-8");
const match = envContent.match(/^DATABASE_URL=(.+)$/m);
if (!match) { console.error("❌ DATABASE_URL مش موجود في .env"); process.exit(1); }
const DATABASE_URL = match[1].trim();

// ── إعدادات ─────────────────────────────────────────────────────────────────
const SEED_DAYS = parseInt(process.env.SEED_DAYS ?? "28"); // عدد الأيام اللي هيرجع لها الـ seed
const ORDERS_PER_DAY_MIN = 3;
const ORDERS_PER_DAY_MAX = 12;

const PRODUCTS = [
  { name: "كابرينا كلاسيك", unitPrice: 320, costPrice: 150 },
  { name: "كابرينا برو", unitPrice: 450, costPrice: 200 },
  { name: "كابرينا لايت", unitPrice: 280, costPrice: 120 },
  { name: "كابرينا سبورت", unitPrice: 390, costPrice: 180 },
  { name: "كابرينا إكسترا", unitPrice: 520, costPrice: 240 },
];

const CITIES = ["القاهرة", "الجيزة", "الإسكندرية", "المنصورة", "طنطا", "أسيوط", "سوهاج", "الفيوم", "بني سويف", "المنيا", "الأقصر", "أسوان", "الزقازيق", "دمياط", "الإسماعيلية"];

const STATUSES = [
  { status: "received",          weight: 50 },
  { status: "returned",          weight: 15 },
  { status: "partial_received",  weight: 10 },
  { status: "in_shipping",       weight: 15 },
  { status: "pending",           weight: 7  },
  { status: "delayed",           weight: 3  },
];

const AD_SOURCES = [
  { source: "facebook",   weight: 40 },
  { source: "tiktok",     weight: 25 },
  { source: "instagram",  weight: 15 },
  { source: "organic",    weight: 10 },
  { source: "whatsapp",   weight: 7  },
  { source: "other",      weight: 3  },
];

const CUSTOMER_NAMES = [
  "أحمد محمد", "محمود علي", "خالد إبراهيم", "عمر حسن", "يوسف عبدالله",
  "فاطمة أحمد", "مريم محمود", "نورا خالد", "سارة عمر", "هبة يوسف",
  "محمد عبدالرحمن", "علي مصطفى", "حسن سيد", "كريم طه", "إسلام جمال",
  "دينا وليد", "رنا سامي", "منى حسين", "أسماء كمال", "ولاء فتحي",
];

// ── Helper functions ────────────────────────────────────────────────────────
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeighted(items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function randomPhone() {
  const prefixes = ["010", "011", "012", "015"];
  return prefixes[rand(0, prefixes.length - 1)] + String(rand(10000000, 99999999));
}

function randomDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  // وقت عشوائي في اليوم
  d.setHours(rand(8, 23), rand(0, 59), rand(0, 59));
  return d;
}

function formatDate(d) {
  return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
}

// ── إنشاء الأوردرات ──────────────────────────────────────────────────────────
const orders = [];
let invoiceCounter = 1000 + rand(1, 99); // ابدأ من رقم عشوائي

for (let dayAgo = SEED_DAYS; dayAgo >= 1; dayAgo--) {
  const ordersToday = rand(ORDERS_PER_DAY_MIN, ORDERS_PER_DAY_MAX);
  
  for (let i = 0; i < ordersToday; i++) {
    const product = PRODUCTS[rand(0, PRODUCTS.length - 1)];
    const statusItem = pickWeighted(STATUSES);
    const adSourceItem = pickWeighted(AD_SOURCES);
    const customerName = CUSTOMER_NAMES[rand(0, CUSTOMER_NAMES.length - 1)];
    const city = CITIES[rand(0, CITIES.length - 1)];
    const quantity = rand(1, 3);
    const unitPrice = product.unitPrice + rand(-30, 30); // تغيير بسيط في السعر
    const totalPrice = quantity * unitPrice;
    const shippingCost = rand(0, 1) === 1 ? rand(25, 60) : 0;
    
    const partialQuantity = statusItem.status === "partial_received" ? rand(1, quantity) : null;
    
    const createdAt = randomDate(dayAgo);
    const updatedAt = new Date(createdAt.getTime() + rand(0, 24 * 60 * 60 * 1000)); // محدث بعد ساعات

    invoiceCounter++;
    const invoiceNumber = `INV-SEED-${String(invoiceCounter).padStart(5, "0")}`;

    orders.push({
      customerName,
      phone: randomPhone(),
      city,
      address: `شارع ${rand(1, 200)} - ${city}`,
      product: product.name,
      quantity,
      unitPrice,
      totalPrice,
      status: statusItem.status,
      partialQuantity,
      adSource: adSourceItem.source,
      costPrice: product.costPrice,
      shippingCost,
      invoiceNumber,
      createdAt: formatDate(createdAt),
      updatedAt: formatDate(updatedAt),
    });
  }
}

console.log(`\n📦 جاهز لـ insert ${orders.length} أوردر على مدار ${SEED_DAYS} يوم...\n`);

// ── الاتصال بقاعدة البيانات والـ Insert ─────────────────────────────────────
const pool = mysql.createPool(DATABASE_URL);

async function run() {
  const conn = await pool.getConnection();
  try {
    // Insert in batches of 50
    const BATCH = 50;
    let inserted = 0;
    
    for (let i = 0; i < orders.length; i += BATCH) {
      const batch = orders.slice(i, i + BATCH);
      
      const placeholders = batch.map(() =>
        "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())"
      ).join(", ");

      const values = batch.flatMap(o => [
        o.customerName,
        o.phone,
        o.city,
        o.address,
        o.product,
        o.quantity,
        o.unitPrice,
        o.totalPrice,
        o.status,
        o.partialQuantity,
        o.adSource,
        o.costPrice,
        o.shippingCost,
        o.invoiceNumber,
        o.createdAt,
        // updatedAt = NOW() في الـ placeholder
      ]);

      // استخدام INSERT مع كل الأعمدة بالترتيب الصح
      await conn.execute(
        `INSERT INTO orders 
          (customer_name, phone, city, address, product, quantity, unit_price, total_price, 
           status, partial_quantity, ad_source, cost_price, shipping_cost, invoice_number, 
           created_at, updated_at)
         VALUES ${placeholders}`,
        values
      );
      
      inserted += batch.length;
      process.stdout.write(`\r✅ تم insert ${inserted}/${orders.length} أوردر`);
    }
    
    console.log(`\n\n🎉 تم بنجاح! ${orders.length} أوردر اتضافوا لقاعدة البيانات.`);
    console.log(`\n📊 ملخص الداتا المضافة:`);
    
    const byStatus = {};
    for (const o of orders) {
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
    }
    for (const [status, count] of Object.entries(byStatus)) {
      console.log(`   ${status.padEnd(20)}: ${count} أوردر`);
    }
    
    const totalRevenue = orders
      .filter(o => o.status === "received" || o.status === "partial_received")
      .reduce((s, o) => s + o.totalPrice, 0);
    console.log(`\n💰 إجمالي الإيرادات المتوقعة: ${Math.round(totalRevenue).toLocaleString()} ج.م`);
    console.log(`\n✨ افتح الداشبورد وشوف الإحصائيات دلوقتي!\n`);

  } catch (err) {
    console.error("\n❌ خطأ:", err.message);
    if (err.message.includes("created_at")) {
      console.error("💡 تلميح: تأكد إن الـ created_at بيتبعت وفي الـ insert\n");
    }
  } finally {
    conn.release();
    await pool.end();
  }
}

run();
