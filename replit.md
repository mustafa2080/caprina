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

- **Dashboard**: KPI cards (today/week/month orders & revenue), all-time summary, best-selling product, low-stock alert, recent orders
- **Order List**: Search by name/product/phone, filter by status, filter by date (from), total count
- **Create Order**: Form to create new orders with validation
- **Order Detail**: View and edit individual orders, update status, delete with confirmation dialog
- **Invoices**: Select orders and print 4-per-A4 page professional invoices
- **Inventory**: Manage products and variants with stock tracking
- **Import**: Upload CSV/XLSX to bulk-import orders
- **Shipping Companies**: Manage courier company records

## Data Model

- **Orders**: id, customerName, phone, address, product, color, size, quantity, unitPrice, totalPrice, status, partialQuantity, shippingCompanyId, productId, variantId, notes, createdAt, updatedAt
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

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
