# CAPRINA Order Management System

## Overview

A full-stack order management system for CAPRINA, an artisan goods company. Built with a pnpm workspace monorepo using TypeScript. Currency is Egyptian Pound (EGP / جنيه مصري).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Excel parsing**: exceljs (replaces vulnerable xlsx@0.18.5)

## Features

- **Financial Engine Dashboard**: Real financial system — صافي الربح الحقيقي banner with net margin%, cash flow grid (cash in / cost of goods / shipping spend / return losses), period cards (today/week/month), top products by profit, losing products (high return rate), inventory value at cost vs sell price with potential profit, full cash flow statement P&L, return impact card, pending revenue pipeline, low-stock alerts, recent orders
- **Order List**: Search by name/product/phone, filter by status, filter by date (from), total count
- **Create Order**: Form with customer info, product/variant selection, cost price + shipping cost fields, live profit preview in sidebar
- **Order Detail**: View/edit individual orders, update status, delete with confirmation, **profit breakdown card** showing revenue/cost/shipping/net profit/margin (shown when cost data exists)
- **Invoices**: Select orders and print 4-per-A4 page professional invoices
- **Inventory**: Manage products and variants with costPrice, margin%, inventory value at cost. Professional KPI cards (total products, available units, low-stock count, inventory value). Per-variant table with selling price / cost price / margin% / status badges. Product + variant dialogs with live profit preview (unit profit, margin%, ROI).
- **Inventory Movements**: Timeline of all stock movements (sale/partial_sale/return/manual) with KPI cards
- **Soft Delete / Archive**: Orders deleted via trash button are soft-deleted (deletedAt timestamp set). Archive page `/archive` shows all deleted orders with restore functionality. All queries filter out soft-deleted records.
- **Tracking Number**: Orders table has `trackingNumber` field. Order detail edit form includes a tracking number field (displayed under shipping company).
- **Shipping Follow-Up Page** (`/shipping-followup`): Shows in_shipping orders pending > 3 days grouped by urgency (critical 10+, urgent 7-10, late 3-7). Includes tracking number display and direct phone links.
- **Import (4 modes)**:
  - **Orders**: Upload CSV/XLSX to bulk-import customer orders with dynamic column mapping wizard
  - **Products**: Bulk-import products with costPrice+unitPrice+color+size; upserts by name, auto-creates variants
  - **Returns**: Bulk-mark existing orders as "returned" by orderId or customerName+product
  - **Inventory** (Bulk stock update): Upload SKU+Quantity (±cost) CSV/XLSX — matches by SKU, adds to existing stock, no column mapping step needed
- **Shipping Companies**: Manage courier company records with delivery rate stats and per-company manifest history
- **Shipping Manifests**: Bundle `in_shipping` orders into manifests per courier. Per-order delivery settlement (مسلَّم/مؤجل/مرتجع/استلم جزئي + reason). Editable invoice price + notes. Settlement card: delivered gross − shipping fees = net owed. Closing statement dialog with summary before locking.
- **Multi-Warehouse**: `warehouses` table + `warehouse_stock` table (per warehouse stock tracking). Each warehouse shows total units, SKU count, order count. Stock management UI with add/update per product/variant. Orders linked to warehouseId.
- **Team Performance**: `/analytics/team-performance` endpoint + page. Per-employee: orders assigned, delivered, returned, profit generated, delivery rate, return rate. Sorted by profit. Trophy for top performer. Unassigned orders shown separately.
- **Ads Tracking**: Orders have `adSource` (facebook/tiktok/instagram/organic/whatsapp/other) and `adCampaign` fields. Order form includes tracking card.
- **Campaign Analytics**: `/analytics/campaigns` endpoint + `/ads-analytics` page. Per source+campaign: orders, revenue, cost, profit, ROI, delivery rate. Source breakdown summary. Date filter + source filter.
- **Smart Analytics & Growth** (`/smart`): Comprehensive decision-making dashboard. (1) Ad Attribution — best platform by net profit + full platform breakdown with profit bars; (2) Stars vs Dead Stock — top 5 profitable products + inventory with <5 units sold in 30 days + frozen capital; (3) Return Insights — return reasons bar chart + ⚠️ High Return Alert for products ≥50% return rate; (4) Stock Predictor — products running out in ≤14 days with urgency color coding (red ≤3d, orange ≤7d, amber ≤14d). Dashboard includes 4 quick-insight tiles linking to /smart.
- **Order Assignment**: Orders have `assignedUserId` field. Order form includes employee dropdown. Team performance analytics aggregates per assignedUserId.
- **Employee Management System** (`/team`): Full HR + KPI system. `employee_profiles` + `employee_kpis` + `employee_daily_logs` tables. KPI metrics: delivery_rate/return_rate/total_orders/profit/revenue (auto-computed) + manual. Weighted KPI scoring. Monthly report with printable A4. **Daily Tracker tab**: per-KPI daily progress with ✅/❌ vs daily target (monthly_target/30), manual KPI input, 7-day achievement heatmap. **Add Member Wizard**: 2-step dialog (create user → set profile) without leaving the Team page.

## Profit Engine

- **Dynamic Cost Resolution**: `resolveCost()` in analytics.ts uses CURRENT costPrice from variant → product → order fallback. Changing a product's costPrice updates ALL profit calculations automatically.
- **Profit Calculation**: Per-order profit = revenue - (costPrice × qty) - shippingCost. Returned orders = -(cost + shipping). Partial received uses partialQuantity.
- **Auto-populate costPrice**: On order creation, if costPrice not provided, it's auto-fetched from the linked variant or product.
- **Analytics Endpoints**:
  - `GET /api/analytics/profit` — period stats (today/week/month/allTime), topProducts, losingProducts, inventoryValue
  - `GET /api/analytics/financial-summary` — comprehensive P&L + order metrics (avgProfitPerOrder, avgOrderValue, avgCostPerOrder)
  - `GET /api/analytics/product-performance` — full per-product: revenue, profit, returnCostLoss, netProfit, margin, ROI, returnRate, avgSalePrice; sorted byProfit/byLoss/byReturns
  - `GET /api/analytics/alerts` — smart alerts engine: HIGH_RETURN, LOSING_PRODUCT, LOW_STOCK, LOW_MARGIN, NO_COST_DATA; severity high/medium/low
  - `GET /api/analytics/stock-intelligence` — stock velocity (units/day last 30d), daysUntilStockout, category (fast/medium/slow/stale/out), frozenCapital
  - `GET /api/analytics/smart-insights` — comprehensive smart analytics: adAttribution (best source + breakdown), stars (top 5 by profit), deadStock (inventory with <5 sales/30d), returnInsights (byReason breakdown + highReturnProducts ≥50%), stockPredictor (products running out ≤14 days)
- **Cost Fields**: Orders have `costPrice` (per unit) and `shippingCost` (per order). Products have `costPrice`. Variants have `costPrice`.

## Data Model

- **Orders**: id, customerName, phone, address, product, color, size, quantity, unitPrice, totalPrice, costPrice, shippingCost, status, partialQuantity, shippingCompanyId, productId, variantId, notes, returnReason, returnNote, createdAt, updatedAt
- **Statuses**: pending | in_shipping | received | delayed | returned | partial_received

## Inventory Logic

Inventory adjusts automatically on every status change. The core `computeInventoryDeltas` function reverses the old status effect then applies the new one (idempotent):

| Status | reservedQty | soldQty |
|---|---|---|
| pending | +qty | — |
| in_shipping | +qty (stays reserved) | — |
| delayed | +qty | — |
| received | — | +qty |
| partial_received | — | +partialQty (remaining freed) |
| returned / deleted | (old effect reversed, nothing new) | |

Inventory target is resolved in priority order: variantId → productId → SKU lookup (product name + color + size match against the inventory tables).

## Security Layer

### Authentication
- **JWT-based auth**: Tokens stored in localStorage, 7-day expiry, bcrypt password hashing
- **Login**: `POST /api/auth/login` → returns `{ token, user }`. Token injected as `Bearer` in all API requests.
- **Default admin**: `admin / admin123` (seeded on startup if no users exist)
- **Auth guard**: Frontend redirects to `/login` for unauthenticated users; auto-redirects on 401

### Roles & Permissions
| Role | Default Permissions |
|---|---|
| admin | All permissions (full access) |
| employee | dashboard, orders |
| warehouse | dashboard, inventory, movements |

Permission keys: `dashboard`, `orders`, `inventory`, `movements`, `shipping`, `invoices`, `import`, `analytics`, `users`, `audit`

Custom permissions can be toggled per-user in the Users management page.

### Order Locking
- Orders with status `received` or `partial_received` are **locked** for non-admins
- Locked orders show a `مقفل` (locked) amber badge in the order detail header
- Edit and Delete buttons are disabled with tooltip "مقفل — فقط المدير يمكنه التعديل/الحذف"
- Backend also enforces locking (403 for non-admin on PATCH/DELETE)

### Audit Logging
- All create/update/delete/status-change operations are logged to `audit_logs` table
- Logged for: orders, products, variants (add_stock too), users
- Each entry includes: action, entityType, entityId, entityName, changesBefore, changesAfter, userId, userName
- Viewable at `/audit-logs` (admin only) with filter/search and expandable diff view

### New Routes
- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/change-password`
- `GET/POST /api/users`, `PATCH/DELETE /api/users/:id` (admin only)
- `GET /api/audit-logs` (admin only)

### New Tables
- `users`: id, username, password_hash, display_name, role, permissions (jsonb), is_active, created_at, updated_at
- `audit_logs`: id, action, entity_type, entity_id, entity_name, changes_before, changes_after, user_id, user_name, created_at

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## API Endpoints

- `GET /api/orders` — list orders (query params: status, search, dateFrom)
- `POST /api/orders` — create an order
- `GET /api/orders/:id` — get a single order
- `PATCH /api/orders/:id` — update an order
- `DELETE /api/orders/:id` — delete an order (reverses inventory adjustments)
- `GET /api/orders/summary` — all-time order statistics
- `GET /api/orders/recent` — 8 most recent orders
- `GET /api/orders/stats` — today/week/month breakdowns + best product
- `GET /api/analytics/profit` — Profit Engine: per-period revenue/cost/netProfit/returnRate, topProducts, losingProducts, inventoryValue
- `GET /api/inventory/movements` — list all inventory movements
- `POST /api/inventory/movements` — create a manual inventory movement
- `GET /api/inventory/movements/totals` — movement totals by product
- `POST /api/orders/import/parse` — parse Excel/CSV and return column headers
- `POST /api/orders/import/execute` — execute bulk import with column mapping

## Important Zod Schema Note

All API request/response schemas are manually maintained in `lib/api-zod/src/generated/api.ts` (originally from Orval codegen but now manually extended). When adding new fields to the DB schema, update:
1. `lib/db/src/schema/*.ts` → run `pnpm --filter @workspace/db run push`
2. `lib/api-zod/src/generated/api.ts` → update both request and response schemas
3. `lib/api-zod/src/generated/types/*.ts` → update TypeScript interfaces
4. Restart API server to pick up compiled changes

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
