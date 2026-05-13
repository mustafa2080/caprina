/**
 * seed-finance.mjs
 * بيانات وهمية لقسم الماليات
 * تشغيل: node scripts/seed-finance.mjs
 */

import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── قراءة .env ──────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(__dirname, "../.env");
  try {
    const lines = readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const [k, ...v] = line.split("=");
      if (k && v.length) process.env[k.trim()] = v.join("=").trim();
    }
  } catch { /* .env مش موجود */ }
}
loadEnv();

const DB_URL = process.env.DATABASE_URL || process.env.DB_URL;

function parseDbUrl(url) {
  const m = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d+)?\/(.+)/);
  if (!m) throw new Error("DATABASE_URL format invalid");
  return { user: m[1], password: m[2], host: m[3], port: parseInt(m[4] || "3306"), database: m[5].split("?")[0] };
}

const now = new Date();
function d(daysAgo, h = 10) {
  const dt = new Date(now);
  dt.setDate(dt.getDate() - daysAgo);
  dt.setHours(h, 0, 0, 0);
  return dt;
}
function fmt(dt) {
  return dt.toISOString().slice(0, 19).replace("T", " ");
}

async function main() {
  if (!DB_URL) throw new Error("DATABASE_URL غير موجود في .env");
  const config = parseDbUrl(DB_URL);
  const conn = await createConnection({ ...config, multipleStatements: false });
  console.log("✅ اتصلنا بقاعدة البيانات\n");

  // ══════════════════════════════════════════════════════
  // 1. الموردون
  // ══════════════════════════════════════════════════════
  console.log("👥 الموردون...");
  const suppliers = [
    { name: "شركة النيل للتغليف",        phone: "01001234567", email: "nile@pack.com",    category: "packaging",     paymentTerms: "30 يوم", balance: 4500  },
    { name: "مصنع الأهرام للخامات",      phone: "01112345678", email: "ahram@raw.com",    category: "raw_materials", paymentTerms: "نقداً",  balance: 12000 },
    { name: "توريدات الدلتا",             phone: "01223456789", email: "delta@supply.com", category: "products",      paymentTerms: "60 يوم", balance: 0     },
    { name: "شركة الفجر للطباعة",        phone: "01334567890", email: "fajr@print.com",   category: "packaging",     paymentTerms: "15 يوم", balance: 2200  },
    { name: "مؤسسة القاهرة للمستلزمات", phone: "01445678901", email: "cairo@sup.com",    category: "raw_materials", paymentTerms: "نقداً",  balance: 8750  },
  ];
  const supIds = [];
  for (const s of suppliers) {
    const [r] = await conn.execute(
      `INSERT INTO suppliers (name,phone,email,category,payment_terms,balance,is_active,created_at,updated_at)
       VALUES (?,?,?,?,?,?,1,?,?)`,
      [s.name, s.phone, s.email, s.category, s.paymentTerms, s.balance, fmt(d(90)), fmt(d(5))]
    );
    supIds.push(r.insertId);
  }
  console.log(`   ✅ ${supIds.length} مورد`);

  // ══════════════════════════════════════════════════════
  // 2. الخزن
  // ══════════════════════════════════════════════════════
  console.log("💰 الخزن...");
  const registers = [
    { name: "الخزنة الرئيسية",   type: "main",   balance: 85000, description: "الخزنة المركزية للشركة" },
    { name: "خزنة الفرع الأول",  type: "branch", balance: 12500, description: "فرع المعادي"            },
    { name: "خزنة الفرع الثاني", type: "branch", balance: 8200,  description: "فرع مدينة نصر"          },
  ];
  const regIds = [];
  for (const reg of registers) {
    const [r] = await conn.execute(
      `INSERT INTO cash_registers (name,type,balance,description,is_active,created_by_name,created_at,updated_at)
       VALUES (?,?,?,?,1,?,?,?)`,
      [reg.name, reg.type, reg.balance, reg.description, "الإدارة", fmt(d(60)), fmt(d(1))]
    );
    regIds.push(r.insertId);
  }
  const [mainId, br1Id, br2Id] = regIds;
  console.log(`   ✅ ${regIds.length} خزنة`);

  // ══════════════════════════════════════════════════════
  // 3. حركات الخزنة
  // ══════════════════════════════════════════════════════
  console.log("🔄 حركات الخزنة...");
  const DEBIT = new Set(["withdrawal","expense_paid","purchase_paid","transfer_out"]);
  const txRows = [];
  function addTx(regId, type, amount, balBefore, desc, daysAgo, ref = null) {
    const balAfter = DEBIT.has(type) ? balBefore - amount : balBefore + amount;
    txRows.push([regId, type, amount, balBefore, balAfter, desc, ref, fmt(d(daysAgo)), "الإدارة", fmt(d(daysAgo))]);
    return balAfter;
  }

  let bal = 0;
  bal = addTx(mainId, "deposit",           50000, 0,   "رصيد افتتاحي",                              60);
  bal = addTx(mainId, "shipping_transfer", 18500, bal, "تحصيل بيان شحن MNF-1-001 - شركة بريد مصر", 28, "FIN-MNF-1-001");
  bal = addTx(mainId, "shipping_transfer", 22300, bal, "تحصيل بيان شحن MNF-1-002 - J&T Express",   21, "FIN-MNF-1-002");
  bal = addTx(mainId, "expense_paid",       3500, bal, "إيجار مخزن - يناير",                        20);
  bal = addTx(mainId, "purchase_paid",      8000, bal, "دفعة مورد - شركة النيل للتغليف",             18);
  bal = addTx(mainId, "shipping_transfer", 31000, bal, "تحصيل بيان شحن MNF-1-003 - Aramex",         14, "FIN-MNF-1-003");
  bal = addTx(mainId, "expense_paid",       2200, bal, "مصاريف تسويق - إعلانات فيسبوك",             12);
  bal = addTx(mainId, "expense_paid",       1800, bal, "فاتورة كهرباء المخزن",                       10);
  bal = addTx(mainId, "transfer_out",       8000, bal, "تحويل لخزنة الفرع الأول",                     8);
  bal = addTx(mainId, "transfer_in",        3000, bal, "تحويل من خزنة الفرع الثاني",                  6);
  bal = addTx(mainId, "shipping_transfer", 27500, bal, "تحصيل بيان شحن MNF-1-004 - شركة بريد مصر",  4, "FIN-MNF-1-004");
  bal = addTx(mainId, "expense_paid",       4500, bal, "مرتب موظف المخزن",                            2);
  bal = addTx(mainId, "expense_paid",       1200, bal, "مستلزمات تغليف إضافية",                       1);

  let bal1 = 0;
  bal1 = addTx(br1Id, "transfer_in",  8000, 0,    "تحويل من الخزنة الرئيسية", 8);
  bal1 = addTx(br1Id, "cash_sale",    2500, bal1, "مبيعات يومية نقدية",        7);
  bal1 = addTx(br1Id, "cash_sale",    3100, bal1, "مبيعات يومية نقدية",        6);
  bal1 = addTx(br1Id, "expense_paid",  900, bal1, "مصاريف نثرية",              5);
  bal1 = addTx(br1Id, "cash_sale",    1800, bal1, "مبيعات يومية نقدية",        3);

  let bal2 = 0;
  bal2 = addTx(br2Id, "deposit",      5000, 0,    "رصيد افتتاحي فرع مدينة نصر", 30);
  bal2 = addTx(br2Id, "cash_sale",    2200, bal2, "مبيعات يومية نقدية",           10);
  bal2 = addTx(br2Id, "expense_paid",  500, bal2, "مصاريف نثرية",                  8);
  bal2 = addTx(br2Id, "transfer_out", 3000, bal2, "تحويل للخزنة الرئيسية",         6);
  bal2 = addTx(br2Id, "cash_sale",    4500, bal2, "مبيعات يومية نقدية",             3);

  for (const tx of txRows) {
    await conn.execute(
      `INSERT INTO cash_transactions
         (register_id,type,amount,balance_before,balance_after,description,reference_number,transaction_date,created_by_name,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      tx
    );
  }
  console.log(`   ✅ ${txRows.length} حركة`);

  // ══════════════════════════════════════════════════════
  // 4. المصروفات
  // ══════════════════════════════════════════════════════
  console.log("🧾 المصروفات...");
  const expenses = [
    { title: "إيجار المخزن الرئيسي - يناير",  cat: "warehouse_rent", amount: 3500, days: 20, regId: mainId },
    { title: "إيجار المخزن الرئيسي - فبراير", cat: "warehouse_rent", amount: 3500, days: 0,  regId: mainId },
    { title: "مرتب موظف المخزن",              cat: "salary",         amount: 4500, days: 2,  regId: mainId },
    { title: "إعلانات فيسبوك - يناير",         cat: "marketing",      amount: 2200, days: 12, regId: mainId },
    { title: "إعلانات جوجل",                  cat: "marketing",      amount: 1800, days: 8,  regId: mainId },
    { title: "كهرباء المخزن",                 cat: "utilities",      amount: 1800, days: 10, regId: mainId },
    { title: "مياه وإنترنت",                  cat: "utilities",      amount: 350,  days: 10, regId: br1Id  },
    { title: "مستلزمات تغليف كارتون",          cat: "packaging",      amount: 1200, days: 1,  regId: mainId },
    { title: "صيانة طابعة الباركود",           cat: "maintenance",    amount: 650,  days: 15, regId: br1Id  },
    { title: "مصاريف شحن داخلية",             cat: "shipping_fees",  amount: 800,  days: 5,  regId: mainId },
    { title: "خسارة مرتجعات تالفة",           cat: "returns_loss",   amount: 2100, days: 7,  regId: mainId },
    { title: "مصاريف متنوعة",                 cat: "other",          amount: 420,  days: 3,  regId: br2Id  },
  ];
  for (const e of expenses) {
    await conn.execute(
      `INSERT INTO expenses (title,category,amount,cash_register_id,expense_date,created_by_name,created_at)
       VALUES (?,?,?,?,?,?,?)`,
      [e.title, e.cat, e.amount, e.regId, fmt(d(e.days)), "الإدارة", fmt(d(e.days))]
    );
  }
  console.log(`   ✅ ${expenses.length} مصروف`);

  // ══════════════════════════════════════════════════════
  // 5. أوامر الشراء
  // ══════════════════════════════════════════════════════
  console.log("🛒 أوامر الشراء...");
  const pos = [
    {
      poNumber: "PO-2025-001", supIdx: 0, status: "received", payStatus: "paid",
      total: 8000, paid: 8000, days: 25,
      items: [
        { name: "كرتون مقاس A4", qty: 500, rcv: 500, unit: 8,  total: 4000 },
        { name: "كرتون مقاس A5", qty: 500, rcv: 500, unit: 8,  total: 4000 },
      ],
    },
    {
      poNumber: "PO-2025-002", supIdx: 1, status: "received", payStatus: "partial",
      total: 22000, paid: 12000, days: 18,
      items: [
        { name: "خامة قطن 100%",  qty: 200, rcv: 200, unit: 45, total: 9000  },
        { name: "خامة بوليستر",    qty: 260, rcv: 260, unit: 50, total: 13000 },
      ],
    },
    {
      poNumber: "PO-2025-003", supIdx: 2, status: "ordered", payStatus: "unpaid",
      total: 15500, paid: 0, days: 5,
      items: [
        { name: "منتج A - مقاس M", qty: 100, rcv: 0, unit: 75, total: 7500 },
        { name: "منتج A - مقاس L", qty: 80,  rcv: 0, unit: 75, total: 6000 },
        { name: "منتج B",          qty: 40,  rcv: 0, unit: 50, total: 2000 },
      ],
    },
    {
      poNumber: "PO-2025-004", supIdx: 3, status: "received", payStatus: "paid",
      total: 4400, paid: 4400, days: 10,
      items: [
        { name: "أكياس هدايا صغيرة", qty: 1000, rcv: 1000, unit: 2.2, total: 2200 },
        { name: "أكياس هدايا كبيرة", qty: 1000, rcv: 1000, unit: 2.2, total: 2200 },
      ],
    },
    {
      poNumber: "PO-2025-005", supIdx: 4, status: "draft", payStatus: "unpaid",
      total: 9500, paid: 0, days: 1,
      items: [
        { name: "ورق طباعة A4 (ريم)", qty: 50, rcv: 0, unit: 80,   total: 4000 },
        { name: "أحبار طابعة",         qty: 10, rcv: 0, unit: 150,  total: 1500 },
        { name: "مستلزمات متنوعة",     qty: 1,  rcv: 0, unit: 4000, total: 4000 },
      ],
    },
  ];

  for (const po of pos) {
    const supId = supIds[po.supIdx];
    const supName = suppliers[po.supIdx].name;
    const [r] = await conn.execute(
      `INSERT INTO purchase_orders
         (po_number,supplier_id,supplier_name,status,payment_status,total_amount,paid_amount,created_by_name,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [po.poNumber, supId, supName, po.status, po.payStatus, po.total, po.paid, "الإدارة", fmt(d(po.days)), fmt(d(po.days))]
    );
    const poId = r.insertId;
    for (const item of po.items) {
      await conn.execute(
        `INSERT INTO purchase_order_items (purchase_order_id,product_name,quantity,received_quantity,unit_cost,total_cost)
         VALUES (?,?,?,?,?,?)`,
        [poId, item.name, item.qty, item.rcv, item.unit, item.total]
      );
    }
  }
  console.log(`   ✅ ${pos.length} أمر شراء`);

  // ══════════════════════════════════════════════════════
  // 6. فواتير الشحن المالية
  // ══════════════════════════════════════════════════════
  console.log("🚚 فواتير الشحن المالية...");
  const [shippingRows] = await conn.execute("SELECT id FROM shipping_companies LIMIT 3");

  if (shippingRows.length > 0) {
    const scIds = shippingRows.map(r => r.id);
    const shippingInvs = [
      { num: "FIN-MNF-1-001", scIdx: 0, tot: 85,  del: 72,  ret: 13, gross: 21250, sFees: 1800, rFees: 950,  net: 18500, paid: 18500, status: "paid",    days: 28 },
      { num: "FIN-MNF-1-002", scIdx: 1, tot: 112, del: 98,  ret: 14, gross: 26500, sFees: 2800, rFees: 1400, net: 22300, paid: 22300, status: "paid",    days: 21 },
      { num: "FIN-MNF-1-003", scIdx: 2, tot: 140, del: 125, ret: 15, gross: 35800, sFees: 3100, rFees: 1700, net: 31000, paid: 31000, status: "paid",    days: 14 },
      { num: "FIN-MNF-1-004", scIdx: 0, tot: 95,  del: 82,  ret: 13, gross: 31200, sFees: 2400, rFees: 1300, net: 27500, paid: 27500, status: "paid",    days: 4  },
      { num: "FIN-MNF-1-005", scIdx: 1, tot: 78,  del: 60,  ret: 10, gross: 18000, sFees: 1600, rFees: 800,  net: 15600, paid: 0,     status: "pending", days: 1  },
    ];

    for (const inv of shippingInvs) {
      const scId = scIds[Math.min(inv.scIdx, scIds.length - 1)];
      const paidAt = inv.status === "paid" ? fmt(d(inv.days)) : null;
      await conn.execute(
        `INSERT INTO shipping_financial_invoices
           (invoice_number,shipping_company_id,total_orders,delivered_orders,returned_orders,
            gross_revenue,shipping_fees,return_fees,net_due,paid_amount,status,
            invoice_date,paid_at,created_by_name,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [inv.num, scId, inv.tot, inv.del, inv.ret,
         inv.gross, inv.sFees, inv.rFees, inv.net, inv.paid, inv.status,
         fmt(d(inv.days)), paidAt, "النظام", fmt(d(inv.days)), fmt(d(inv.days))]
      );
    }
    console.log(`   ✅ ${shippingInvs.length} فاتورة شحن مالية`);
  } else {
    console.log("   ⚠️  لا توجد شركات شحن — تخطي فواتير الشحن");
  }

  await conn.end();
  console.log("\n🎉 تم إدراج كل البيانات الوهمية بنجاح!");
}

main().catch(e => { console.error("❌ خطأ:", e); process.exit(1); });
