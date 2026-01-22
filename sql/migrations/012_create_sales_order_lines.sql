CREATE SCHEMA IF NOT EXISTS scm;

CREATE TABLE IF NOT EXISTS scm.sales_order_lines (
  so_line_id     BIGSERIAL PRIMARY KEY,
  sales_order_id BIGINT NOT NULL REFERENCES scm.sales_orders(sales_order_id) ON DELETE CASCADE,
  item_id        BIGINT NOT NULL REFERENCES scm.items(item_id),

  qty_ordered    NUMERIC(18,4) NOT NULL CHECK (qty_ordered > 0),
  unit_price     NUMERIC(18,4) NOT NULL CHECK (unit_price >= 0),

  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_so_line UNIQUE (sales_order_id, item_id)
);

CREATE INDEX IF NOT EXISTS ix_so_lines_so
ON scm.sales_order_lines (sales_order_id);

CREATE INDEX IF NOT EXISTS ix_so_lines_item
ON scm.sales_order_lines (item_id);
