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

- **Profit Engine Dashboard**: Real profit calculation per period (today/week/month/all-time), top profitable products with margin%, losing products (high return rate), low-stock alerts, inventory value, order status summary, recent orders, quick actions
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

- **Profit Calculation**: Per-order profit = revenue - (costPrice × qty) - shippingCost. Returned orders = -(cost + shipping). Partial received uses partialQuantity.
- **Analytics Endpoint**: `GET /api/analytics/profit` returns today/week/month/allTime stats with revenue, cost, shippingCost, netProfit, returnRate, topProducts, losingProducts, inventoryValue.
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
