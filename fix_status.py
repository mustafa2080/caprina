import pathlib, re

filepath = r'C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\caprina\src\pages\finance-sale-detail.tsx'
content = pathlib.Path(filepath).read_text(encoding='utf-8')

# 1. تغيير STATUS_MAP labels
old_map = '''const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  draft:      { label: "مسودة",        bg: "#F5F5F5", color: "#757575" },
  confirmed:  { label: "مؤكد",         bg: "#E3F2FD", color: "#1565C0" },
  processing: { label: "جاري التجهيز", bg: "#FFF8E1", color: "#F57F17" },
  delivered:  { label: "تم التسليم",   bg: "#E8F5E9", color: "#2E7D32" },
  closed:     { label: "مُغلَق",        bg: "#EDE7F6", color: "#4527A0" },
  cancelled:  { label: "ملغي",         bg: "#FFEBEE", color: "#B71C1C" },
};'''
new_map = '''const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  draft:      { label: "جاري الإعداد",  bg: "#FFF8E1", color: "#E65100" },
  confirmed:  { label: "جاري الإعداد",  bg: "#FFF8E1", color: "#E65100" },
  processing: { label: "جاري الإعداد",  bg: "#FFF8E1", color: "#E65100" },
  delivered:  { label: "جاري الإعداد",  bg: "#FFF8E1", color: "#E65100" },
  closed:     { label: "تم ✓",          bg: "#E8F5E9", color: "#1B5E20" },
  cancelled:  { label: "ملغي",          bg: "#FFEBEE", color: "#B71C1C" },
};'''
content = content.replace(old_map, new_map, 1)

# 2. شيل QuickChangeDropdown للحالة واستبدله بـ badge
old_status_dd = '''          {/* ── تغيير حالة الأمر ── */}
          <QuickChangeDropdown
            label="الحالة"
            options={statusOptions}
            current={order.status}
            onSelect={v => handleStatusChange("status", v)}
            disabled={saving || order.status === "closed"}
          />'''
new_status_badge = '''          {/* ── حالة الأمر (badge فقط) ── */}
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ background: statusInfo.bg + "33", color: statusInfo.color, border: `1px solid ${statusInfo.color}44` }}>
            {statusInfo.label}
          </span>'''
content = content.replace(old_status_dd, new_status_badge, 1)

# 3. تبسيط نص زر الإغلاق بعد اكتماله
old_closed = '''          {order.status === "closed" && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: "#E8F5E9", color: "#2E7D32" }}>
              ✓ مُغلَقة — تم التحويل للخزينة
            </span>
          )}'''
new_closed = '''          {order.status === "closed" && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: "#E8F5E9", color: "#1B5E20", border: "1px solid #A5D6A7" }}>
              ✓ تم
            </span>
          )}'''
content = content.replace(old_closed, new_closed, 1)

pathlib.Path(filepath).write_text(content, encoding='utf-8')
print('SUCCESS - lines:', content.count('\n'))

# تحقق
if 'جاري الإعداد' in content and 'تم ✓' in content:
    print('Labels OK')
if 'QuickChangeDropdown' not in content.split('// ── تغيير حالة الأمر')[0].split('label="الحالة"')[0]:
    print('Dropdown for status removed')
