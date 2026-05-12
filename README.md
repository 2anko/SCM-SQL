# SCM — Supply Chain Management

A desktop application for managing a company's supply chain. Built with Electron + React (frontend), Node.js/Fastify (backend), and PostgreSQL (database). Packaged as a self-contained `.exe` — no cloud, no subscriptions.

---

## Concept

Sold as a one-time license to companies that already have a PostgreSQL server. Employees use the app to manually track inventory, orders, and supplier relationships. The system acts as a structured notebook — making it easy to record, update, and extract information across the entire company's supply chain.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Electron, React, Vite, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Fastify |
| Database | PostgreSQL |
| Auth | JWT + bcrypt |
| Dev DB | Docker (local only, not shipped) |

---

## What's built

### Database schema (12 migrations)

- **Entities**: `customers`, `suppliers`, `supplier_factories`, `factory_rep`, `items`, `warehouses`
- **Inventory**: `inventory` (running balance per item per warehouse), `inventory_transactions` (full movement log)
- **Orders**: `purchase_orders` + `purchase_order_lines`, `sales_orders` + `sales_order_lines`
- **Users**: `users` with role-based access (`head_manager`, `section_manager`, `employee`, `it_service`)
- Soft delete (`is_active`) on customers, suppliers, factories, warehouses
- All FK constraints resolved in correct migration order

### Backend (Node.js / Fastify)

- JWT authentication — login with email + password, token carries `userId` and `role`
- Role-based authorization on every endpoint:
  - `head_manager` — read only
  - `section_manager` — read, edit, delete
  - `employee` — read, add new records
  - `it_service` — manage user accounts only
- Full CRUD for all entities including nested factory/rep management under suppliers
- Inventory operations: stock levels, transaction history, manual adjustments, warehouse transfers
- Purchase order workflow: create → confirm → receive goods (auto-updates inventory)
- Sales order workflow: create → confirm → ship goods (auto-updates inventory, checks stock)
- Per-supplier cost and per-customer price via `supplier_items` / `customer_items` junction tables
- Request body validation on all routes (required fields, types, enum values)
- `created_by` tracked on all inventory transactions
- Business-rule guards on delete (e.g. can't deactivate a warehouse with stock, can't delete a supplier with open POs)

### Frontend (Electron + React)

- **Auth** — login screen with JWT stored in memory; role drives all UI permissions
- **Dashboard** — live stat cards (open POs/SOs, low-stock items, overdue orders) with recent order feeds
- **Items** — catalogue with per-item pricing breakdown (all supplier costs + customer prices)
- **Warehouses** — stock levels per warehouse; create/edit/soft-delete
- **Suppliers** — full management including nested factories and factory reps; per-supplier item cost management
- **Customers** — full management with per-customer item price management
- **Inventory** — current stock levels + full transaction history with warehouse/item filters; transfer and manual adjustment dialogs
- **Purchase Orders** — multi-line creation (with inline new-item/new-factory shortcuts), DRAFT → SENT → RECEIVED flow, overdue warnings, post-receive cost-update prompt, date-range Summary Report
- **Sales Orders** — multi-line creation with source warehouse assignment per line, DRAFT → CONFIRMED → SHIPPED flow, atomic stock deduction on ship
- **Users** — `it_service` only: create accounts, assign roles, reset passwords (self-edit protected)

---

## Local development setup

**Prerequisites:** Docker Desktop, Node.js 18+

### 1. Database

```bash
# Start the local PostgreSQL container
docker compose up -d
```

**Connect a DB client** (e.g. Database Client extension in VSCode):
- Host: `localhost`, Port: `5433`, Database: `scm`, User: `scm_user`

Apply all migrations in order (001–013) via your DB client or psql.

### 2. Backend

```bash
cd backend
npm install

# Copy and fill in environment variables
cp .env.example .env
# Set DATABASE_URL and JWT_SECRET in .env

npm run dev
# Fastify listens on http://localhost:3000
```

### 3. Frontend (Electron + Vite)

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

This starts the Vite dev server and launches the Electron window. Hot-reload is active for all renderer (React) code — save a file and the UI updates instantly without restarting Electron.

> **Note:** The frontend expects the backend at `http://localhost:3000`. If you change the backend port, update `VITE_API_BASE` in `frontend/.env`.

---

## Project structure

```
SCM-SQL/
├── backend/
│   └── src/
│       ├── app.js               # entry point, auth, route registration
│       ├── config/db.js         # postgres connection pool
│       ├── middleware/
│       │   └── authorize.js     # RBAC permission checks
│       ├── queries/             # SQL query functions
│       └── routes/              # Fastify route handlers
├── frontend/
│   ├── electron.vite.config.js  # Vite + Electron build config
│   └── src/
│       ├── main/                # Electron main process
│       ├── preload/             # contextBridge preload script
│       └── renderer/src/
│           ├── App.jsx          # root router + auth context
│           ├── api/             # fetch helpers (api.js)
│           ├── components/      # shared UI components (shadcn/ui base)
│           └── pages/           # one file per page (Items, Warehouses, …)
├── sql/
│   ├── migrations/              # schema changes (001–013, run in order)
│   ├── schema/                  # reference schema
│   └── seeds/                   # sample data for testing
├── db/init/                     # bootstrap script (runs on first docker start)
└── docker-compose.yml           # local dev database
```

---

## Planned

- **First-run setup** — screen to create the initial `it_service` account on a fresh install
- **Low-stock alerts** — configurable reorder-point notifications on the Dashboard
- **Packaging** — bundle backend + Electron into a single `.exe` using electron-builder
