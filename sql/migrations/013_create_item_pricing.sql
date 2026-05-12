-- Per-supplier item costs and per-customer item prices.
-- The items.unit_cost / items.unit_price columns stay as the default fallback
-- when no relationship-specific row exists.

CREATE TABLE supplier_items (
    id              SERIAL PRIMARY KEY,
    supplier_id     INT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    item_id         INT NOT NULL REFERENCES items(id)     ON DELETE CASCADE,
    unit_cost       NUMERIC(12, 2) NOT NULL,
    supplier_sku    VARCHAR(100),
    lead_time_days  INT,
    is_preferred    BOOLEAN NOT NULL DEFAULT false,
    notes           TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (supplier_id, item_id)
);

CREATE INDEX idx_supplier_items_supplier ON supplier_items(supplier_id);
CREATE INDEX idx_supplier_items_item     ON supplier_items(item_id);

CREATE TABLE customer_items (
    id              SERIAL PRIMARY KEY,
    customer_id     INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    item_id         INT NOT NULL REFERENCES items(id)     ON DELETE CASCADE,
    unit_price      NUMERIC(12, 2) NOT NULL,
    customer_sku    VARCHAR(100),
    notes           TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (customer_id, item_id)
);

CREATE INDEX idx_customer_items_customer ON customer_items(customer_id);
CREATE INDEX idx_customer_items_item     ON customer_items(item_id);
