CREATE TYPE inventory_txn_type AS ENUM (
    'RECEIPT',      -- goods in from supplier (tied to PO)
    'SHIPMENT',     -- goods out to customer (tied to SO)
    'TRANSFER_IN',  -- received from another warehouse
    'TRANSFER_OUT', -- sent to another warehouse
    'ADJUSTMENT',   -- manual stock correction
    'RETURN_IN',    -- customer return
    'RETURN_OUT'    -- return to supplier
);

CREATE TABLE inventory_transactions (
    id                   SERIAL PRIMARY KEY,
    txn_type             inventory_txn_type NOT NULL,
    item_id              INT NOT NULL REFERENCES items(id),
    warehouse_id         INT NOT NULL REFERENCES warehouses(id),
    related_warehouse_id INT REFERENCES warehouses(id),
    quantity             NUMERIC(12, 4) NOT NULL,
    purchase_order_id    INT,
    sales_order_id       INT,
    notes                TEXT,
    created_by           INT,
    created_at           TIMESTAMPTZ DEFAULT now()
);
