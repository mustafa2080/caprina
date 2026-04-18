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
- **Import (3 modes)**:
  - **Orders**: Upload CSV/XLSX to bulk-import customer orders with dynamic column mapping wizard
  - **Products**: Bulk-import products with costPrice+unitPrice+color+size; upserts by name, auto-creates variants
  - **Returns**: Bulk-mark existing orders as "returned" by orderId or customerName+product
- **Shipping Companies**: Manage courier company records

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
