CREATE SCHEMA IF NOT EXISTS scm;

CREATE TABLE IF NOT EXISTS scm.inventory_transactions (
  txn_id        BIGSERIAL PRIMARY KEY,
  txn_ts        TIMESTAMPTZ NOT NULL DEFAULT now(),

  warehouse_id  BIGINT NOT NULL REFERENCES scm.warehouses(warehouse_id),
  item_id       BIGINT NOT NULL REFERENCES scm.items(item_id),

  -- Use signed quantity:
  --   + = stock IN (receive, transfer_in, adjustment_up)
  --   - = stock OUT (ship, transfer_out, adjustment_down)
  qty           NUMERIC(18,4) NOT NULL CHECK (qty <> 0),

  txn_type      TEXT NOT NULL CHECK (
    txn_type IN (
      'RECEIPT',        -- received from supplier / production company
      'ISSUE',          -- issued/consumed internally
      'SALE_SHIP',      -- shipped to customer
      'ADJUSTMENT',     -- manual correction
      'TRANSFER_IN',    -- moved into this warehouse
      'TRANSFER_OUT'    -- moved out of this warehouse
    )
  ),

  -- Optional fields to link to future tables (POs, SOs, etc.)
  reference_type TEXT,          -- e.g., 'PO', 'SO'
  reference_id   BIGINT,        -- e.g., purchase_order_id
  note           TEXT
);

-- Helpful indexes for reporting
CREATE INDEX IF NOT EXISTS ix_inv_txn_wh_item_ts
ON scm.inventory_transactions (warehouse_id, item_id, txn_ts);

CREATE INDEX IF NOT EXISTS ix_inv_txn_item_ts
ON scm.inventory_transactions (item_id, txn_ts);
