-- Performance indexes for the high-volume tables.
--
-- Postgres does NOT auto-create indexes on foreign-key columns, so joins and
-- filters on order lines / transactions were doing sequential scans. These
-- back the paginated list queries, the join-heavy detail/summary queries, and
-- the transaction-history filters.
--
-- Plain CREATE INDEX (not CONCURRENTLY) because the migration runner wraps
-- each file in a transaction, and CONCURRENTLY can't run inside one. On a
-- fresh DB the tables are empty so this is instant; on an existing DB it's a
-- one-time build at upgrade. IF NOT EXISTS keeps it re-runnable.

-- Order lists: paginated, ORDER BY created_at DESC, optionally filtered by status.
CREATE INDEX IF NOT EXISTS idx_po_status_created ON purchase_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_created        ON purchase_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_so_status_created ON sales_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_so_created        ON sales_orders(created_at DESC);

-- Order lines: joined by parent id (detail view, summary aggregation) and by
-- item_id (summary group-by, item-delete guard).
CREATE INDEX IF NOT EXISTS idx_pol_po_id   ON purchase_order_lines(po_id);
CREATE INDEX IF NOT EXISTS idx_pol_item_id ON purchase_order_lines(item_id);
CREATE INDEX IF NOT EXISTS idx_sol_so_id   ON sales_order_lines(so_id);
CREATE INDEX IF NOT EXISTS idx_sol_item_id ON sales_order_lines(item_id);

-- Transaction history: paginated ORDER BY created_at DESC, filtered by item or
-- warehouse. Composite (filter, created_at) serves filter + sort together.
CREATE INDEX IF NOT EXISTS idx_txn_created   ON inventory_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_txn_item      ON inventory_transactions(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_txn_warehouse ON inventory_transactions(warehouse_id, created_at DESC);

-- Inventory: the UNIQUE(warehouse_id, item_id) index already covers warehouse
-- lookups (leading column). Add item_id for the inventory-summary group-by-item
-- and item-delete guard.
CREATE INDEX IF NOT EXISTS idx_inventory_item ON inventory(item_id);
