import re, sys

path = r"C:\Users\musta\Desktop\pro\Caprina-Orders الاصداؤ الاخير_2\Caprina-Orders\artifacts\api-server\src\routes\orders.ts"

with open(path, encoding="utf-8") as f:
    src = f.read()

# ─── Locate the block by unique ASCII anchors ─────────────────────────────────
# The block starts after "const allInvRows = await db..." query and ends before
# the "if (matchingInvNums.length > 0" part

OLD = r"""      const invStatusMap = new Map<string, Set<string>>();
      const soloIds = new Set<number>();
      for (const r of allInvRows) {
        if (r.invoiceNumber) {
          if (!invStatusMap.has(r.invoiceNumber)) invStatusMap.set(r.invoiceNumber, new Set());
          invStatusMap.get(r.invoiceNumber)!.add(r.status);
        } else if (r.status === params.data.status) {
          soloIds.add(r.id);
        }
      }"""

if OLD not in src:
    print("❌ OLD block not found — dumping snippet for debug:")
    idx = src.find("const invStatusMap")
    print(repr(src[idx-10:idx+300]))
    sys.exit(1)

NEW = """      // نفس منطق chart: invoice بتاخد حالة الأنشط (أولوية)
      const STATUS_PRIORITY_FILTER: Record<string, number> = {
        pending: 1, in_shipping: 2, warehouse_ready: 3, delayed: 4,
        partial_received: 5, received: 6, returned: 7,
      };
      const invStatusMap = new Map<string, Set<string>>();
      const soloMap = new Map<number, string>();
      for (const r of allInvRows) {
        if (r.invoiceNumber) {
          if (!invStatusMap.has(r.invoiceNumber)) invStatusMap.set(r.invoiceNumber, new Set());
          invStatusMap.get(r.invoiceNumber)!.add(r.status);
        } else {
          soloMap.set(r.id, r.status);
        }
      }
      const resolveStatus = (statuses: Set<string>): string => {
        if (statuses.size === 1) return Array.from(statuses)[0];
        return Array.from(statuses).sort(
          (a, b) => (STATUS_PRIORITY_FILTER[a] ?? 99) - (STATUS_PRIORITY_FILTER[b] ?? 99)
        )[0];
      };"""

src = src.replace(OLD, NEW, 1)

# ─── Fix matchingInvNums: change size===1 condition + add soloIds from soloMap ─
OLD2 = """      const matchingInvNums: string[] = [];
      for (const [inv, statuses] of invStatusMap.entries()) {
        if (statuses.has(params.data.status) && statuses.size === 1) {
          matchingInvNums.push(inv);
        }
      }"""

if OLD2 not in src:
    print("❌ OLD2 block not found")
    sys.exit(1)

NEW2 = """      const matchingInvNums: string[] = [];
      for (const [inv, statuses] of invStatusMap.entries()) {
        if (resolveStatus(statuses) === params.data.status) {
          matchingInvNums.push(inv);
        }
      }
      const soloIds = new Set<number>();
      for (const [id, status] of soloMap.entries()) {
        if (status === params.data.status) soloIds.add(id);
      }"""

src = src.replace(OLD2, NEW2, 1)

with open(path, "w", encoding="utf-8") as f:
    f.write(src)

print("✅ orders.ts patched successfully")
