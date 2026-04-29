/**
 * seed-old-orders.mjs
 * ينشئ أوردرات قديمة في قاعدة البيانات لاختبار إحصائيات الداشبورد
 * 
 * التشغيل من مجلد lib/db:
 *   node --experimental-vm-modules seed-old-orders.mjs
 *   أو مع عدد مخصص:
 *   SEED_DAYS=60 node seed-old-orders.mjs
 */

import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ── قراءة DATABASE_URL من .env ─────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "../../.env");
const envContent = readFileSync(envPath, "utf-8");
const match = envContent.match(/^DATABASE_URL=(.+)$/m);
if (!match) { console.error("❌ DATABASE_URL مش موجود في .env"); process.exit(1); }
const DATABASE_URL = match[1].trim();

const SEED_DAYS = parseInt(process.env.SEED_DAYS ?? "28");
const ORDERS_PER_DAY_MIN = 3;
const ORDERS_PER_DAY_MAX = 12;

const PRODUCTS = [
  { name: "كابرينا كلاسيك", unitPrice: 320, costPrice: 150 },
  { name: "كابرينا برو", unitPrice: 450, costPrice: 200 },
  { name: "كابرينا لايت", unitPrice: 280, costPrice: 120 },
  { name: "كابرينا سبورت", unitPrice: 390, costPrice: 180 },
  { name: "كابرينا إكسترا", unitPrice: 520, costPrice: 240 },
];

const CITIES = ["القاهرة", "الجيزة", "الإسكندرية", "المنصورة", "طنطا", "أسيوط", "سوهاج", "الفيوم", "بني سويف", "المنيا", "الأقصر", "أسوان"];

const STATUSES_W = [
  { status: "received",         w: 50 },
  { status: "returned",         w: 15 },
  { status: "partial_received", w: 10 },
  { status: "in_shipping",      w: 15 },
  { status: "pending",          w: 7  },
  { status: "delayed",          w: 3  },
];

const AD_SOURCES_W = [
  { source: "facebook",   w: 40 },
  { source: "tiktok",     w: 25 },
  { source: "instagram",  w: 15 },
  { source: "organic",    w: 10 },
  { source: "whatsapp",   w: 7  },
  { source: "other",      w: 3  },
];

const NAMES = [
  "أحمد محمد","محمود علي","خالد إبراهيم","عمر حسن","يوسف عبدالله",
  "فاطمة أحمد","مريم محمود","نورا خالد","سارة عمر","هبة يوسف",
  "محمد عبدالرحمن","علي مصطفى","حسن سيد","كريم طه","إسلام جمال",
];

function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr) { const t = arr.reduce((s,i)=>s+i.w,0); let r=Math.random()*t; for(const i of arr){r-=i.w;if(r<=0)return i;} return arr[arr.length-1]; }
function phone() { return ["010","011","012","015"][rand(0,3)] + String(rand(10000000,99999999)); }
function fmtDate(d) { return d.toISOString().slice(0,19).replace("T"," "); }

const orders = [];
let inv = 2000 + rand(1,99);

for (let ago = SEED_DAYS; ago >= 1; ago--) {
  const n = rand(ORDERS_PER_DAY_MIN, ORDERS_PER_DAY_MAX);
  for (let i = 0; i < n; i++) {
    const p = PRODUCTS[rand(0, PRODUCTS.length-1)];
    const st = pick(STATUSES_W);
    const ad = pick(AD_SOURCES_W);
    const qty = rand(1, 3);
    const up = p.unitPrice + rand(-20, 20);
    const d = new Date(); d.setDate(d.getDate()-ago); d.setHours(rand(8,23),rand(0,59),rand(0,59));
    const u = new Date(d.getTime() + rand(0, 8*3600*1000));
    inv++;
    orders.push([
      NAMES[rand(0,NAMES.length-1)],     // customer_name
      phone(),                            // phone
      CITIES[rand(0,CITIES.length-1)],   // city
      p.name,                            // product
      qty,                               // quantity
      up,                                // unit_price
      qty * up,                          // total_price
      st.status,                         // status
      st.status==="partial_received" ? rand(1,qty) : null, // partial_quantity
      ad.source,                         // ad_source
      p.costPrice,                       // cost_price
      rand(0,1)?rand(25,60):0,           // shipping_cost
      `INV-SEED-${String(inv).padStart(5,"0")}`, // invoice_number
      fmtDate(d),                        // created_at
      fmtDate(u),                        // updated_at
    ]);
  }
}

console.log(`\n📦 جاهز لـ insert ${orders.length} أوردر على مدار ${SEED_DAYS} يوم...\n`);

const pool = mysql.createPool(DATABASE_URL);
const conn = await pool.getConnection();

try {
  const BATCH = 50;
  let done = 0;
  for (let i = 0; i < orders.length; i += BATCH) {
    const batch = orders.slice(i, i + BATCH);
    const ph = batch.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
    await conn.execute(
      `INSERT INTO orders (customer_name,phone,city,product,quantity,unit_price,total_price,status,partial_quantity,ad_source,cost_price,shipping_cost,invoice_number,created_at,updated_at) VALUES ${ph}`,
      batch.flat()
    );
    done += batch.length;
    process.stdout.write(`\r✅ ${done}/${orders.length}`);
  }

  const byStatus = {};
  orders.forEach(o => { byStatus[o[7]] = (byStatus[o[7]]??0)+1; });
  const totalRev = orders.filter(o=>o[7]==="received"||o[7]==="partial_received").reduce((s,o)=>s+o[6],0);

  console.log(`\n\n🎉 تم! ${orders.length} أوردر اتضافوا.\n`);
  for(const [s,c] of Object.entries(byStatus)) console.log(`   ${s.padEnd(20)}: ${c}`);
  console.log(`\n💰 إجمالي الإيرادات: ${Math.round(totalRev).toLocaleString()} ج.م`);
  console.log(`\n✨ افتح الداشبورد وشوف الإحصائيات!\n`);

} catch(e) {
  console.error("\n❌ خطأ:", e.message);
} finally {
  conn.release();
  await pool.end();
}
