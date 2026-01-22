CREATE SCHEMA IF NOT EXISTS scm;

CREATE TABLE IF NOT EXISTS scm.sales_orders (
  sales_order_id BIGSERIAL PRIMARY KEY,
  so_number      TEXT NOT NULL UNIQUE,     -- e.g., "SO-2026-0001"

  customer_id    BIGINT NOT NULL REFERENCES scm.customers(customer_id),
  ship_from_warehouse_id BIGINT NOT NULL REFERENCES scm.warehouses(warehouse_id),

  order_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  requested_ship_date DATE,

  status         TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'CONFIRMED', 'PARTIALLY_SHIPPED', 'SHIPPED', 'CANCELLED')),

  ship_to_address TEXT,    -- optional override (otherwise use customer address)
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_so_customer
ON scm.sales_orders (customer_id);

CREATE INDEX IF NOT EXISTS ix_so_status_date
ON scm.sales_orders (status, order_date);
