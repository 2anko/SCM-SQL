CREATE SCHEMA IF NOT EXISTS scm;

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
    id                  SERIAL PRIMARY KEY,
    txn_type            inventory_txn_type NOT NULL,
    item_id             INT NOT NULL REFERENCES items(id),
    warehouse_id        INT NOT NULL REFERENCES warehouses(id),
    -- For transfers, track the counterpart warehouse
    related_warehouse_id INT REFERENCES warehouses(id),
    quantity            NUMERIC(12, 4) NOT NULL,  -- always positive; direction implied by txn_type
    -- Optional references to source documents
    purchase_order_id   INT REFERENCES purchase_orders(id),
    sales_order_id      INT REFERENCES sales_orders(id),
    notes               TEXT,
    created_by          INT REFERENCES users(id),-- FK to a users table if you add one
    created_at          TIMESTAMPTZ DEFAULT now()
);