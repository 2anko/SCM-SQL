# SCM (Supply Chain Management) — Postgres Schema + Minimal API

This repo is a learning-focused Supply Chain Management (SCM) backend:

- **PostgreSQL schema** (namespace: `scm`) for customers, suppliers, items, warehouses, procurement, sales, and inventory movements.
- **ASP.NET Core Minimal API** (Npgsql) to validate connectivity and expose starter endpoints.

## What exists right now

### Database (Postgres)
The schema is centered around **master data**, **orders**, and an **inventory ledger**:

- **Master data**
  - `scm.customers`
  - `scm.suppliers`
  - `scm.items` (with `item_type` = `RAW` or `FINISHED`)
  - `scm.warehouses`

- **Procurement**
  - `scm.purchase_orders`
  - `scm.purchase_order_lines`

- **Sales**
  - `scm.sales_orders`
  - `scm.sales_order_lines`

- **Inventory ledger**
  - `scm.inventory_transactions`
    - Uses **signed `qty`**: `+` means stock in, `-` means stock out.
    - `reference_type` / `reference_id` can link a transaction back to a PO or SO.

> Primary keys are mostly `BIGSERIAL`, and relationships are defined with `REFERENCES` foreign keys.

### API (ASP.NET Core)
A starter Minimal API is set up in `Program.cs` with a shared `NpgsqlDataSource` and a few endpoints:

- `GET /db/health` — runs `SELECT 1`
- `GET /db/whoami` — returns `current_user` and `current_database()`
- `GET /customers` — lists up to 100 customers

## Project layout

### Current (what’s in the repo today)
- `docker-compose.yml` — local Postgres (port **5433 → 5432**) with a persistent named volume
- `001_create_*.sql` — table DDL scripts (currently stored at repo root)
- `001_seed_demo.sql` — small demo seed data
- `001_end_to_end_test.sql` — end-to-end test scenario (wraps everything in a transaction and **ROLLBACKs**)
- `ScmApi.csproj`, `Program.cs` — Minimal API
- `.env` — local secret for `POSTGRES_PASSWORD` (gitignored)

### Planned structure (what I’m moving toward)
`001_bootstrap.sql` already assumes this structure inside the container at `/sql/*`:

- `sql/schema/` — base init (ex: `001_init.sql`)
- `sql/migrations/` — incremental table changes (ex: `001_create_customers.sql`, ...)
- `sql/seeds/` — demo data
- `sql/tests/` — test scenarios / end-to-end scripts
- `docs/` — ERD + notes

If you don’t have `./db/init` and `./sql` directories yet, the plan is to create them and move the scripts into the structure above (so Docker init + `001_bootstrap.sql` work out-of-the-box).

## Run locally (Docker)

### 1) Set your env vars
Create a `.env` file (not committed) with:

- `POSTGRES_PASSWORD=...`

### 2) Start Postgres
```bash
docker compose up -d
