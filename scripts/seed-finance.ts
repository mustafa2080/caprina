/**
 * seed-finance.ts
 * بيانات وهمية لقسم الماليات — تشغيل مرة واحدة بس
 * npx tsx scripts/seed-finance.ts
 */
import { db } from "@workspace/db";
import {
  cashRegistersTable, cashTransactionsTable,
  suppliersTable, purchaseOrdersTable, purchaseOrderItemsTable,
  expensesTable, shippingFinancialInvoicesTable,
} from "@workspace/db";

const now   = new Date();
const d = (daysAgo: number, h = 10) => {
  const dt = new Date(now);
  dt.setDate(dt.getDate() - daysAgo);
  dt.setHours(h, 0, 0, 0);
  return dt;
};

async function main() {
  console.log("🌱 بدء إدراج البيانات الوهمية للماليات...\n");

  // ══════════════════════════════════════════════════════
  //  1. الموردون
  // ══════════════════════════════════════════════════════
  console.log("👥 الموردون...");
  const suppliers = [
    { name: "شركة النيل للتغليف",      phone: "01001234567", email: "nile@pack.com",      category: "packaging",     paymentTerms: "30 يوم",  balance: "4500.00"  },
    { name: "مصنع الأهرام للخامات",    phone: "01112345678", email: "ahram@raw.com",      category: "raw_materials", paymentTerms: "نقداً",   balance: "12000.00" },
    { name: "توريدات الدلتا",           phone: "01223456789", email: "delta@supply.com",   category: "products",      paymentTerms: "60 يوم",  balance: "0.00"     },
    { name: "شركة الفجر للطباعة",      phone: "01334567890", email: "fajr@print.com",     category: "packaging",     paymentTerms: "15 يوم",  balance: "2200.00"  },
    { name: "مؤسسة القاهرة للمستلزمات", phone: "01445678901", email: "cairo@supply.com",  category: "raw_materials", paymentTerms: "نقداً",   balance: "8750.00"  },
  ];

  const insertedSuppliers: number[] = [];
  for (const s of suppliers) {
    const [r] = await db.insert(suppliersTable).values({ ...s, isActive: true, createdAt: d(90), updatedAt: d(5) });
    insertedSuppliers.push((r as any).insertId);
  }
  console.log(`   ✅ ${insertedSuppliers.length} مورد`);

  // ══════════════════════════════════════════════════════
  //  2. الخزنة الرئيسية + فرعية
  // ══════════════════════════════════════════════════════
  console.log("💰 الخزن...");
  const registers = [
    { name: "الخزنة الرئيسية",  type: "main",   balance: "85000.00", description: "الخزنة المركزية للشركة" },
    { name: "خزنة الفرع الأول", type: "branch", balance: "12500.00", description: "فرع المعادي"            },
    { name: "خزنة الفرع الثاني",type: "branch", balance: "8200.00",  description: "فرع مدينة نصر"          },
  ];

  const insertedRegisters: number[] = [];
  for (const reg of registers) {
    const [r] = await db.insert(cashRegistersTable).values({
      ...reg, isActive: true, createdByName: "الإدارة", createdAt: d(60), updatedAt: d(1),
    });
    insertedRegisters.push((r as any).insertId);
  }
  console.log(`   ✅ ${insertedRegisters.length} خزنة`);

  const mainRegId    = insertedRegisters[0];
  const branch1RegId = insertedRegisters[1];
  const branch2RegId = insertedRegisters[2];

  // ══════════════════════════════════════════════════════
  //  3. حركات الخزنة الرئيسية (آخر 30 يوم)
  // ══════════════════════════════════════════════════════
  console.log("🔄 حركات الخزنة...");

  const transactions: any[] = [];
  const addTx = (registerId: number, type: string, amount: number, balBefore: number,
                 desc: string, daysAgo: number, ref?: string) => {
    const balAfter = ["withdrawal","expense_paid","purchase_paid","transfer_out"].includes(type)
      ? balBefore - amount : balBefore + amount;
    transactions.push({
      registerId, type, amount: String(amount),
      balanceBefore: String(balBefore), balanceAfter: String(balAfter),
      description: desc, referenceNumber: ref ?? null,
      transactionDate: d(daysAgo), createdByName: "الإدارة", createdAt: d(daysAgo),
    });
    return balAfter;
  };

  // الخزنة الرئيسية
  let bal = 50000;
  bal = addTx(mainRegId, "deposit",           50000, 0,     "رصيد افتتاحي",                              60);
  bal = addTx(mainRegId, "shipping_transfer", 18500, bal,   "تحصيل بيان شحن MNF-1-001 - شركة بريد مصر",  28, "FIN-MNF-1-001");
  bal = addTx(mainRegId, "shipping_transfer", 22300, bal,   "تحصيل بيان شحن MNF-1-002 - J&T Express",    21, "FIN-MNF-1-002");
  bal = addTx(mainRegId, "expense_paid",       3500, bal,   "إيجار مخزن - يناير",                         20);
  bal = addTx(mainRegId, "purchase_paid",      8000, bal,   "دفعة مورد - شركة النيل للتغليف",              18);
  bal = addTx(mainRegId, "shipping_transfer", 31000, bal,   "تحصيل بيان شحن MNF-1-003 - Aramex",          14, "FIN-MNF-1-003");
  bal = addTx(mainRegId, "expense_paid",       2200, bal,   "مصاريف تسويق - إعلانات فيسبوك",              12);
  bal = addTx(mainRegId, "expense_paid",       1800, bal,   "فاتورة كهرباء المخزن",                        10);
  bal = addTx(mainRegId, "transfer_out",       8000, bal,   "تحويل لخزنة الفرع الأول",                      8);
  bal = addTx(mainRegId, "transfer_in",        3000, bal,   "تحويل من خزنة الفرع الثاني",                   6);
  bal = addTx(mainRegId, "shipping_transfer", 27500, bal,   "تحصيل بيان شحن MNF-1-004 - شركة بريد مصر",   4, "FIN-MNF-1-004");
  bal = addTx(mainRegId, "expense_paid",       4500, bal,   "مرتب موظف المخزن",                             2);
  bal = addTx(mainRegId, "expense_paid",       1200, bal,   "مستلزمات تغليف إضافية",                        1);

  // خزنة الفرع الأول
  let bal1 = 0;
  bal1 = addTx(branch1RegId, "transfer_in",  8000, 0,    "تحويل من الخزنة الرئيسية",  8);
  bal1 = addTx(branch1RegId, "cash_sale",    2500, bal1, "مبيعات يومية نقدية",         7);
  bal1 = addTx(branch1RegId, "cash_sale",    3100, bal1, "مبيعات يومية نقدية",         6);
  bal1 = addTx(branch1RegId, "expense_paid",  900, bal1, "مصاريف نثرية",               5);
  bal1 = addTx(branch1RegId, "cash_sale",    1800, bal1, "مبيعات يومية نقدية",         3);

  // خزنة الفرع الثاني
  let bal2 = 0;
  bal2 = addTx(branch2RegId, "deposit",      5000, 0,    "رصيد افتتاحي فرع مدينة نصر", 30);
  bal2 = addTx(branch2RegId, "cash_sale",    2200, bal2, "مبيعات يومية نقدية",           10);
  bal2 = addTx(branch2RegId, "expense_paid",  500, bal2, "مصاريف نثرية",                  8);
  bal2 = addTx(branch2RegId, "transfer_out", 3000, bal2, "تحويل للخزنة الرئيسية",         6);
  bal2 = addTx(branch2RegId, "cash_sale",    4500, bal2, "مبيعات يومية نقدية",             3);

  for (const tx of transactions) {
    await db.insert(cashTransactionsTable).values(tx);
  }
  console.log(`   ✅ ${transactions.length} حركة`);

  // ══════════════════════════════════════════════════════
  //  4. المصروفات
  // ══════════════════════════════════════════════════════
  console.log("🧾 المصروفات...");
  const expenses = [
    { title: "إيجار المخزن الرئيسي - يناير",      category: "warehouse_rent", amount: "3500.00",  daysAgo: 20, cashRegisterId: mainRegId },
    { title: "إيجار المخزن الرئيسي - فبراير",     category: "warehouse_rent", amount: "3500.00",  daysAgo: 0,  cashRegisterId: mainRegId },
    { title: "مرتب موظف المخزن",                  category: "salary",         amount: "4500.00",  daysAgo: 2,  cashRegisterId: mainRegId },
    { title: "إعلانات فيسبوك - يناير",             category: "marketing",      amount: "2200.00",  daysAgo: 12, cashRegisterId: mainRegId },
    { title: "إعلانات جوجل",                      category: "marketing",      amount: "1800.00",  daysAgo: 8,  cashRegisterId: mainRegId },
    { title: "كهرباء المخزن",                     category: "utilities",      amount: "1800.00",  daysAgo: 10, cashRegisterId: mainRegId },
    { title: "مياه وإنترنت",                      category: "utilities",      amount: "350.00",   daysAgo: 10, cashRegisterId: branch1RegId },
    { title: "مستلزمات تغليف كارتون",              category: "packaging",      amount: "1200.00",  daysAgo: 1,  cashRegisterId: mainRegId },
    { title: "صيانة طابعة الباركود",               category: "maintenance",    amount: "650.00",   daysAgo: 15, cashRegisterId: branch1RegId },
    { title: "مصاريف شحن داخلية",                 category: "shipping_fees",  amount: "800.00",   daysAgo: 5,  cashRegisterId: mainRegId },
    { title: "خسارة مرتجعات تالفة",               category: "returns_loss",   amount: "2100.00",  daysAgo: 7,  cashRegisterId: mainRegId },
    { title: "مصاريف متنوعة",                     category: "other",          amount: "420.00",   daysAgo: 3,  cashRegisterId: branch2RegId },
  ];

  for (const exp of expenses) {
    const { daysAgo, ...rest } = exp;
    await db.insert(expensesTable).values({
      ...rest, expenseDate: d(daysAgo), createdByName: "الإدارة", createdAt: d(daysAgo),
    });
  }
  console.log(`   ✅ ${expenses.length} مصروف`);

  // ══════════════════════════════════════════════════════
  //  5. أوامر الشراء
  // ══════════════════════════════════════════════════════
  console.log("🛒 أوامر الشراء...");
  const purchaseOrders = [
    {
      poNumber: "PO-2025-001", supplierId: insertedSuppliers[0], supplierName: "شركة النيل للتغليف",
      status: "received", paymentStatus: "paid",
      totalAmount: "8000.00", paidAmount: "8000.00",
      notes: "كراتين تغليف مقاس A4 و A5", daysAgo: 25,
      items: [
        { productName: "كرتون مقاس A4",   quantity: 500, receivedQuantity: 500, unitCost: "8.00",  totalCost: "4000.00" },
        { productName: "كرتون مقاس A5",   quantity: 500, receivedQuantity: 500, unitCost: "8.00",  totalCost: "4000.00" },
      ],
    },
    {
      poNumber: "PO-2025-002", supplierId: insertedSuppliers[1], supplierName: "مصنع الأهرام للخامات",
      status: "received", paymentStatus: "partial",
      totalAmount: "22000.00", paidAmount: "12000.00",
      notes: "خامات إنتاج الدورة الثانية", daysAgo: 18,
      items: [
        { productName: "خامة قطن 100%",   quantity: 200, receivedQuantity: 200, unitCost: "45.00", totalCost: "9000.00"  },
        { productName: "خامة بوليستر",     quantity: 260, receivedQuantity: 260, unitCost: "50.00", totalCost: "13000.00" },
      ],
    },
    {
      poNumber: "PO-2025-003", supplierId: insertedSuppliers[2], supplierName: "توريدات الدلتا",
      status: "ordered", paymentStatus: "unpaid",
      totalAmount: "15500.00", paidAmount: "0.00",
      notes: "منتجات جاهزة للبيع", daysAgo: 5,
      items: [
        { productName: "منتج A - مقاس M",  quantity: 100, receivedQuantity: 0, unitCost: "75.00",  totalCost: "7500.00" },
        { productName: "منتج A - مقاس L",  quantity: 80,  receivedQuantity: 0, unitCost: "75.00",  totalCost: "6000.00" },
        { productName: "منتج B",           quantity: 40,  receivedQuantity: 0, unitCost: "50.00",  totalCost: "2000.00" },
      ],
    },
    {
      poNumber: "PO-2025-004", supplierId: insertedSuppliers[3], supplierName: "شركة الفجر للطباعة",
      status: "received", paymentStatus: "paid",
      totalAmount: "4400.00", paidAmount: "4400.00",
      notes: "أكياس هدايا مطبوعة بشعار الشركة", daysAgo: 10,
      items: [
        { productName: "أكياس هدايا صغيرة",  quantity: 1000, receivedQuantity: 1000, unitCost: "2.20", totalCost: "2200.00" },
        { productName: "أكياس هدايا كبيرة",  quantity: 1000, receivedQuantity: 1000, unitCost: "2.20", totalCost: "2200.00" },
      ],
    },
    {
      poNumber: "PO-2025-005", supplierId: insertedSuppliers[4], supplierName: "مؤسسة القاهرة للمستلزمات",
      status: "draft", paymentStatus: "unpaid",
      totalAmount: "9500.00", paidAmount: "0.00",
      notes: "مستلزمات مكتبية وطباعة", daysAgo: 1,
      items: [
        { productName: "ورق طباعة A4 (ريم)",  quantity: 50,  receivedQuantity: 0, unitCost: "80.00",  totalCost: "4000.00" },
        { productName: "أحبار طابعة",          quantity: 10,  receivedQuantity: 0, unitCost: "150.00", totalCost: "1500.00" },
        { productName: "مستلزمات متنوعة",      quantity: 1,   receivedQuantity: 0, unitCost: "4000.00",totalCost: "4000.00" },
      ],
    },
  ];

  for (const po of purchaseOrders) {
    const { items, daysAgo, ...poData } = po;
    const [r] = await db.insert(purchaseOrdersTable).values({
      ...poData, createdByName: "الإدارة",
      createdAt: d(daysAgo), updatedAt: d(daysAgo),
    });
    const poId = (r as any).insertId;
    for (const item of items) {
      await db.insert(purchaseOrderItemsTable).values({ purchaseOrderId: poId, ...item });
    }
  }
  console.log(`   ✅ ${purchaseOrders.length} أمر شراء`);

  // ══════════════════════════════════════════════════════
  //  6. فواتير الشحن المالية (وهمية — بدون بيانات فعلية)
  // ══════════════════════════════════════════════════════
  console.log("🚚 فواتير الشحن المالية...");

  // نجيب أول شركة شحن موجودة
  const { shippingCompaniesTable } = await import("@workspace/db");
  const shippingCos = await db.select().from(shippingCompaniesTable).limit(3);

  if (shippingCos.length > 0) {
    const shippingInvoices = [
      {
        invoiceNumber: "FIN-MNF-1-001", shippingCompanyId: shippingCos[0].id,
        totalOrders: 85, deliveredOrders: 72, returnedOrders: 13,
        grossRevenue: "21250.00", shippingFees: "1800.00", returnFees: "950.00",
        netDue: "18500.00", paidAmount: "18500.00", status: "paid",
        invoiceDate: d(28), paidAt: d(28), daysAgo: 28,
      },
      {
        invoiceNumber: "FIN-MNF-1-002", shippingCompanyId: shippingCos.length > 1 ? shippingCos[1].id : shippingCos[0].id,
        totalOrders: 112, deliveredOrders: 98, returnedOrders: 14,
        grossRevenue: "26500.00", shippingFees: "2800.00", returnFees: "1400.00",
        netDue: "22300.00", paidAmount: "22300.00", status: "paid",
        invoiceDate: d(21), paidAt: d(21), daysAgo: 21,
      },
      {
        invoiceNumber: "FIN-MNF-1-003", shippingCompanyId: shippingCos.length > 2 ? shippingCos[2].id : shippingCos[0].id,
        totalOrders: 140, deliveredOrders: 125, returnedOrders: 15,
        grossRevenue: "35800.00", shippingFees: "3100.00", returnFees: "1700.00",
        netDue: "31000.00", paidAmount: "31000.00", status: "paid",
        invoiceDate: d(14), paidAt: d(14), daysAgo: 14,
      },
      {
        invoiceNumber: "FIN-MNF-1-004", shippingCompanyId: shippingCos[0].id,
        totalOrders: 95, deliveredOrders: 82, returnedOrders: 13,
        grossRevenue: "31200.00", shippingFees: "2400.00", returnFees: "1300.00",
        netDue: "27500.00", paidAmount: "27500.00", status: "paid",
        invoiceDate: d(4), paidAt: d(4), daysAgo: 4,
      },
      {
        invoiceNumber: "FIN-MNF-1-005", shippingCompanyId: shippingCos.length > 1 ? shippingCos[1].id : shippingCos[0].id,
        totalOrders: 78, deliveredOrders: 60, returnedOrders: 10,
        grossRevenue: "18000.00", shippingFees: "1600.00", returnFees: "800.00",
        netDue: "15600.00", paidAmount: "0.00", status: "pending",
        invoiceDate: d(1), paidAt: null, daysAgo: 1,
      },
    ];

    for (const inv of shippingInvoices) {
      const { daysAgo, ...rest } = inv;
      await db.insert(shippingFinancialInvoicesTable).values({
        ...rest,
        grossRevenue: rest.grossRevenue,
        shippingFees: rest.shippingFees,
        returnFees: rest.returnFees,
        netDue: rest.netDue,
        paidAmount: rest.paidAmount,
        createdByName: "النظام",
        createdAt: d(daysAgo),
        updatedAt: d(daysAgo),
      });
    }
    console.log(`   ✅ ${shippingInvoices.length} فاتورة شحن مالية`);
  } else {
    console.log("   ⚠️  لا توجد شركات شحن — تخطي فواتير الشحن");
  }

  // ══════════════════════════════════════════════════════
  console.log("\n🎉 تم إدراج كل البيانات الوهمية بنجاح!");
}

main().catch(e => { console.error("❌ خطأ:", e); process.exit(1); });
