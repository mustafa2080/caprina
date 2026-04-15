# CAPRINA Order Management System

## Overview

A full-stack order management system for CAPRINA, an artisan goods company. Built with a pnpm workspace monorepo using TypeScript.

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

## Features

- **Dashboard**: Overview with revenue, order counts by status, and recent activity
- **Order List**: Searchable, filterable table of all orders with status badges
- **Create Order**: Form to create new orders with validation
- **Order Detail**: View and edit individual orders, update status

## Data Model

- **Orders**: id, customerName, product, quantity, unitPrice, totalPrice, status (pending/processing/shipped/delivered/cancelled), notes, createdAt, updatedAt

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## API Endpoints

- `GET /api/orders` — list orders (optional query params: status, search)
- `POST /api/orders` — create an order
- `GET /api/orders/:id` — get a single order
- `PATCH /api/orders/:id` — update an order
- `GET /api/orders/summary` — order statistics summary
- `GET /api/orders/recent` — 5 most recent orders

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
