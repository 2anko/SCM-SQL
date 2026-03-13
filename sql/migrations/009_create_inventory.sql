CREATE SCHEMA IF NOT EXISTS scm;

-- One row per item per warehouse — the "ledger balance"
CREATE TABLE inventory (
    id            SERIAL PRIMARY KEY,
    warehouse_id  INT NOT NULL REFERENCES warehouses(id),
    item_id       INT NOT NULL REFERENCES items(id),
    quantity      NUMERIC(12, 4) NOT NULL DEFAULT 0,
    updated_at    TIMESTAMPTZ DEFAULT now(),
    UNIQUE (warehouse_id, item_id)
);