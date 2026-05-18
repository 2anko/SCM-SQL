-- 014: collapse items.unit_cost + items.unit_price into a single items.value.
--
-- Rationale: the two "default" columns served the same role (a per-item reference
-- amount). Per-supplier costs live in supplier_items.unit_cost and per-customer
-- prices live in customer_items.unit_price — those stay untouched.
--
-- After this migration, items.value is the manually-entered worth of one unit.
-- It is also auto-updated by the application code after each PO is RECEIVED, to
-- the weighted-average of every cost paid for that item across all RECEIVED PO
-- lines: SUM(qty_received * unit_cost) / SUM(qty_received).

BEGIN;

ALTER TABLE items ADD COLUMN value NUMERIC(12, 2);

-- Backfill from whatever's there. If both exist, average them; otherwise fall
-- back to whichever is set, then 0.
UPDATE items
SET value = COALESCE(
    (unit_cost + unit_price)::numeric / 2,
    unit_cost,
    unit_price,
    0
);

ALTER TABLE items DROP COLUMN unit_cost;
ALTER TABLE items DROP COLUMN unit_price;

COMMIT;
