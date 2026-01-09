CREATE SCHEMA IF NOT EXISTS scm;

CREATE TABLE IF NOT EXISTS scm.purchase_order_lines (
  po_line_id        BIGSERIAL PRIMARY KEY,
  purchase_order_id BIGINT NOT NULL REFERENCES scm.purchase_orders(purchase_order_id) ON DELETE CASCADE,
  item_id           BIGINT NOT NULL REFERENCES scm.items(item_id),

  qty_ordered       NUMERIC(18,4) NOT NULL CHECK (qty_ordered > 0),
  unit_cost         NUMERIC(18,4) NOT NULL CHECK (unit_cost >= 0),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- prevents duplicate item lines on the same PO
  CONSTRAINT uq_po_line UNIQUE (purchase_order_id, item_id)
);

CREATE INDEX IF NOT EXISTS ix_po_lines_po
ON scm.purchase_order_lines (purchase_order_id);

CREATE INDEX IF NOT EXISTS ix_po_lines_item
ON scm.purchase_order_lines (item_id);
