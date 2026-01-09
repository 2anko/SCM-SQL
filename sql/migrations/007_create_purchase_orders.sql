CREATE SCHEMA IF NOT EXISTS scm;

CREATE TABLE IF NOT EXISTS scm.purchase_orders (
  purchase_order_id BIGSERIAL PRIMARY KEY,
  po_number         TEXT NOT NULL UNIQUE,  -- e.g., "PO-2026-0001"

  supplier_id       BIGINT NOT NULL REFERENCES scm.suppliers(supplier_id),
  ship_to_warehouse_id BIGINT NOT NULL REFERENCES scm.warehouses(warehouse_id),

  order_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date     DATE,

  status            TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'SUBMITTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED')),

  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_po_supplier
ON scm.purchase_orders (supplier_id);

CREATE INDEX IF NOT EXISTS ix_po_status_date
ON scm.purchase_orders (status, order_date);
