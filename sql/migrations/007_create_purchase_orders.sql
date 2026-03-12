CREATE SCHEMA IF NOT EXISTS scm;

CREATE TYPE po_status AS ENUM ('DRAFT', 'SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

CREATE TABLE purchase_orders (
    id              SERIAL PRIMARY KEY,
    supplier_id     INT NOT NULL REFERENCES suppliers(id),
    factory_id      INT REFERENCES supplier_factories(id),  -- which factory fulfills it
    status          po_status NOT NULL DEFAULT 'DRAFT',
    expected_date   DATE,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE purchase_order_lines (
    id              SERIAL PRIMARY KEY,
    po_id           INT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    item_id         INT NOT NULL REFERENCES items(id),
    quantity_ordered    NUMERIC(12, 4) NOT NULL,
    quantity_received   NUMERIC(12, 4) NOT NULL DEFAULT 0,
    unit_cost           NUMERIC(12, 2) NOT NULL,
    destination_warehouse_id INT REFERENCES warehouses(id)
);
