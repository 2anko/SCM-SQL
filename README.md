# SCM — Supply Chain Management (WIP)

A desktop application for managing a company's supply chain. Built with Electron (frontend), Node.js/Fastify (backend), and PostgreSQL (database). Packaged as a self-contained `.exe` — no cloud, no subscriptions.

---

## Concept

Sold as a one-time license to companies that already have a PostgreSQL server. Employees use the app to manually track inventory, orders, and supplier relationships. The system acts as a structured notebook — making it easy to record, update, and extract information across the entire company's supply chain.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Electron (not started) |
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
- Request body validation on all routes (required fields, types, enum values)
- `created_by` tracked on all inventory transactions
- Business-rule guards on delete (e.g. can't deactivate a warehouse with stock, can't delete a supplier with open POs)

---

## Local development setup

**Prerequisites:** Docker Desktop, Node.js

```bash
# 1. Start the database
docker compose up -d

# 2. Install backend dependencies
cd backend
npm install

# 3. Set up environment
cp .env.example .env
# Fill in DATABASE_URL and JWT_SECRET in .env

# 4. Apply migrations (run each file in order 001–012 via your DB client)

# 5. Start the backend
npm run dev
```

**Connect a DB client** (e.g. Database Client extension in VSCode):
- Host: `localhost`, Port: `5433`, Database: `scm`, User: `scm_user`

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
├── sql/
│   ├── migrations/              # schema changes (001–012, run in order)
│   ├── schema/                  # reference schema
│   └── seeds/                   # sample data for testing
├── db/init/                     # bootstrap script (runs on first docker start)
└── docker-compose.yml           # local dev database
```

---

## Planned

- **Electron frontend** — the main remaining work; UI for all CRUD operations and workflows
- **First-run setup** — screen to create the initial `it_service` account on fresh install
- **Reporting endpoints** — inventory value by warehouse, low stock alerts, PO/SO summaries (built alongside the frontend as screens are designed)
- **Packaging** — bundle backend + Electron into a single `.exe` using Electron Forge or electron-builder
