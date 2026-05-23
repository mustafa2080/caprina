const fs = require('fs');
const base = 'C:/Users/musta/Desktop/pro/Caprina-Orders الاصداؤ الاخير_2/Caprina-Orders';
const analyticsPath = base + '/artifacts/api-server/src/routes/analytics.ts';
let f = fs.readFileSync(analyticsPath, 'utf8');

// النص الفعلي من line 999-1001 بـ \r\n
const oldText = '  const variantMap = new Map<number, number | null>(variants.map(v => [v.id, v.costPrice]));\r\n  const productMap = new Map<number, number | null>(products.map(p => [p.id, p.costPrice]));\r\n\r\n  // بناء map: orderId';

const newText = '  const variantMap = new Map<number, number | null>(variants.map(v => [v.id, v.costPrice]));\r\n  const productMap = new Map<number, number | null>(products.map(p => [p.id, p.costPrice]));\r\n  const productImageMap = new Map<string, string | null>(\r\n    products.filter(p => p && p.name).map(p => [String(p.name).trim(), (p as any).image ?? null])\r\n  );\r\n\r\n  // بناء map: orderId';

if (f.includes(oldText)) {
  f = f.replace(oldText, newText);
  console.log('✅ replaced with \\r\\n');
} else {
  // جرب بدون \r
  const old2 = '  const variantMap = new Map<number, number | null>(variants.map(v => [v.id, v.costPrice]));\n  const productMap = new Map<number, number | null>(products.map(p => [p.id, p.costPrice]));\n\n  // بناء map: orderId';
  if (f.includes(old2)) {
    f = f.replace(old2,
      '  const variantMap = new Map<number, number | null>(variants.map(v => [v.id, v.costPrice]));\n  const productMap = new Map<number, number | null>(products.map(p => [p.id, p.costPrice]));\n  const productImageMap = new Map<string, string | null>(\n    products.filter(p => p && p.name).map(p => [String(p.name).trim(), (p as any).image ?? null])\n  );\n\n  // بناء map: orderId'
    );
    console.log('✅ replaced with \\n');
  } else {
    console.log('❌ not found — will inject at line 1001');
    // inject بطريقة line-based
    const lines = f.split('\n');
    // line 1000 (0-indexed: 999) هي productMap line
    // line 1001 (0-indexed: 1000) هي السطر الفاضي
    // نضيف بعد line 1000
    const insertAfter = 999; // 0-indexed: productMap line
    const newLine = '  const productImageMap = new Map<string, string | null>(\r\n    products.filter(p => p && p.name).map(p => [String(p.name).trim(), (p as any).image ?? null])\r\n  );';
    lines.splice(insertAfter + 1, 0, newLine);
    f = lines.join('\n');
    console.log('✅ injected at line 1001');
  }
}

fs.writeFileSync(analyticsPath, f, 'utf8');

// تحقق - عدد مرات productImageMap بعد line 999
const finalLines = fs.readFileSync(analyticsPath, 'utf8').split('\n');
let found = false;
finalLines.forEach((l, i) => {
  if (i >= 995 && i <= 1010 && l.includes('productImageMap')) {
    console.log('Found at line ' + (i+1) + ': ' + l.replace('\r',''));
    found = true;
  }
});
if (!found) console.log('❌ Still not found near line 1000!');
