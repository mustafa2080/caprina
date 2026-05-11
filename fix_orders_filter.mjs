import { readFileSync, writeFileSync } from "fs";

const filePath = new URL(
  "./artifacts/api-server/src/routes/orders.ts",
  import.meta.url
).pathname.replace(/^\/([A-Z]:)/, "$1");

let src = readFileSync(filePath, "utf8");

// ─── Find & replace the old filter block ────────────────────────────────────
// We locate by the unique anchor lines around the block

const OLD_BLOCK_START = `      const invStatusMap = new Map<string, Set<string>>();
      const soloIds = new Set<number>();
      for (const r of allInvRows) {
        if (r.invoiceNumber) {
          if (!invStatusMap.has(r.invoiceNumber)) invStatusMap.set(r.invoiceNumber, new Set());
          invStatusMap.get(r.invoiceNumber)!.add(r.status);
        } else if (r.status === params.data.status) {
          soloIds.add(r.id);
        }
      }`;

// The second part (matchingInvNums logic with size === 1)
const OLD_MATCH_BLOCK = `      const matchingInvNums: string[] = [];
      for (const [inv, statuses] of invStatusMap.entries()) {
        if (statuses.has(params.data.status) && statuses.size === 1) {
          matchingInvNums.push(inv);
        }
      }`;

const NEW_BLOCK_START = `      // نفس منطق الـ chart: invoice بتتحسب بحالة الأنشط (أولوية)
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
      };`;

const NEW_MATCH_BLOCK = `      const matchingInvNums: string[] = [];
      for (const [inv, statuses] of invStatusMap.entries()) {
        if (resolveStatus(statuses) === params.data.status) {
          matchingInvNums.push(inv);
        }
      }
      const soloIds = new Set<number>();
      for (const [id, status] of soloMap.entries()) {
        if (status === params.data.status) soloIds.add(id);
      }`;

// Replace
if (!src.includes(OLD_MATCH_BLOCK)) {
  console.error("❌ Could not find OLD_MATCH_BLOCK — check encoding");
  process.exit(1);
}

// Replace OLD_BLOCK_START first (build map part)
src = src.replace(OLD_BLOCK_START, NEW_BLOCK_START);
// Then replace the matchingInvNums block
src = src.replace(OLD_MATCH_BLOCK, NEW_MATCH_BLOCK);

writeFileSync(filePath, src, "utf8");
console.log("✅ orders.ts patched successfully");
